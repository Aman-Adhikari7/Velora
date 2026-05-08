"""
router/streaming_orchestrator.py
----------------------------------
Velora — STREAMING version of the orchestrator.

Yields SSE events in real-time as each agent starts and completes:
  - stage_update: emitted when a workflow stage changes (pending→running→complete/skipped)
  - section_done: emitted when an agent finishes and has output to show
  - complete:     emitted at the very end with the full result

The frontend listens to these events and updates the UI live — no more waiting
for the full response before anything appears. Each agent's output appears
as soon as IT finishes, not when ALL agents finish.

Event contract:
  { type: "stage_update", stage: { name, agent, status, label, elapsed_ms? } }
  { type: "section_done", section: { title, content, model_used, task_type, elapsed_ms, success } }
  { type: "complete", result: { ...full RunResponse fields... } }
  { type: "error", error: "message" }
"""

import time
from typing import AsyncGenerator

from classifier.task_classifier import classify_task, ClassificationResult
from agents.claude_agent import run_claude_agent, AgentResult
from agents.gpt_agent import run_gpt_agent
from agents.frontend_agent import run_frontend_agent
from memory.manager import (
    load_memory,
    save_memory,
    add_to_history,
    update_context,
    update_stats,
    set_project_goal,
    build_context_summary,
)
from memory.schema import UserMemory
from logger.workflow_logger import log_decision, log_stage


def _model_display_label(model_str: str) -> str:
    lower = (model_str or "").lower()
    if "groq" in lower or "llama" in lower:
        return "Claude"
    if "gemini" in lower:
        return "Gemini"
    if "gpt" in lower:
        return "GPT"
    return model_str


def _stage_event(name: str, agent: str, status: str, label: str, elapsed_ms: float = 0.0) -> dict:
    stage = {"name": name, "agent": agent, "status": status, "label": label}
    if elapsed_ms:
        stage["elapsed_ms"] = round(elapsed_ms, 1)
    return {"type": "stage_update", "stage": stage}


def _section_event(title: str, content: str, model_used: str, task_type: str,
                   elapsed_ms: float = 0.0, success: bool = True) -> dict:
    return {
        "type": "section_done",
        "section": {
            "title": title,
            "content": content,
            "model_used": model_used,
            "task_type": task_type,
            "elapsed_ms": round(elapsed_ms, 1),
            "success": success,
        }
    }


async def run_orchestrator_streaming(
    prompt: str,
    user_id: str = "default_user",
) -> AsyncGenerator[dict, None]:
    """
    Main streaming orchestrator — yields events as each stage executes.
    The frontend receives these via SSE and updates the UI in real time.
    """
    start_time = time.perf_counter()
    stages = []
    sections = []
    agent_results = []

    # ── Step 1: Load memory ────────────────────────────────────────────────────
    yield _stage_event("Memory Check", "Velora Memory", "running",
                       "[ MEMORY ] Loading project context...")

    try:
        memory = load_memory(user_id)
        memory_loaded = bool(memory.project_goal or memory.context.backend or memory.context.frontend)
    except Exception as e:
        yield {"type": "error", "error": f"Failed to load memory: {str(e)}"}
        return

    yield _stage_event("Memory Check", "Velora Memory", "complete",
                       "[ MEMORY ] Previous context loaded → Ready" if memory_loaded
                       else "[ MEMORY ] Fresh session → Starting new project")

    # ── Step 2: Classify ────────────────────────────────────────────────────────
    yield _stage_event("[ GPT ORCHESTRATOR ]", "GPT", "running",
                       "[ GPT ORCHESTRATOR ] Analyzing request → Detecting task type...")

    classification = classify_task(prompt)
    task_type = classification.task_type
    confidence = classification.confidence

    yield _stage_event("[ GPT ORCHESTRATOR ]", "GPT", "complete",
                       classification.reason)

    stages.append({"name": "[ GPT ORCHESTRATOR ]", "agent": "GPT", "status": "complete",
                   "label": classification.reason})

    # ── Step 3: Backend (Claude via Groq) ──────────────────────────────────────
    if task_type in ("backend", "full"):
        yield _stage_event("Backend Generation", "Claude", "running",
                           "[ CLAUDE ] Backend engineering → APIs, DB, Auth, Logic...")
        log_stage("Backend Generation", "running", "Claude via Groq")

        t0 = time.perf_counter()
        backend_result = await run_claude_agent(prompt=prompt, memory=memory)
        elapsed = (time.perf_counter() - t0) * 1000

        if backend_result.success:
            memory = update_context(memory, "backend", backend_result.output)

            stage_label = f"[ CLAUDE ] Backend engineering complete in {elapsed:.0f}ms"
            yield _stage_event("Backend Generation", "Claude", "complete", stage_label, elapsed)
            yield _stage_event("Memory Update", "Velora Memory", "complete",
                                "[ MEMORY ] Claude output saved → Gemini context ready")

            section = {
                "title": "[ CLAUDE ] Backend Engineering",
                "content": backend_result.output,
                "model_used": _model_display_label(backend_result.model),
                "task_type": "backend",
                "elapsed_ms": round(elapsed, 1),
                "success": True,
            }
            sections.append(section)
            agent_results.append(backend_result)
            yield _section_event(**{k: section[k] for k in
                                   ["title","content","model_used","task_type","elapsed_ms","success"]})
        else:
            yield _stage_event("Backend Generation", "Claude", "error",
                                f"[ CLAUDE ] Error: {backend_result.error}", elapsed)
    else:
        yield _stage_event("Backend Generation", "Claude", "skipped",
                           "[ ROUTER ] Backend Generation — skipped (Claude not needed)")

    # ── Step 4: Frontend (Gemini) ──────────────────────────────────────────────
    if task_type in ("frontend", "full"):
        yield _stage_event("Frontend Generation", "Gemini", "running",
                           "[ GEMINI ] Frontend engineering → UI, Components, Design...")
        log_stage("Frontend Generation", "running", "Gemini")

        t0 = time.perf_counter()
        fe_result = await run_frontend_agent(prompt=prompt, memory=memory)
        elapsed = (time.perf_counter() - t0) * 1000

        if fe_result.success:
            memory = update_context(memory, "frontend", fe_result.output)

            stage_label = f"[ GEMINI ] Frontend engineering complete in {elapsed:.0f}ms"
            yield _stage_event("Frontend Generation", "Gemini", "complete", stage_label, elapsed)
            yield _stage_event("Memory Update", "Velora Memory", "complete",
                                "[ MEMORY ] Gemini output saved → GPT context ready")

            section = {
                "title": "[ GEMINI ] Frontend Engineering",
                "content": fe_result.output,
                "model_used": _model_display_label(fe_result.model),
                "task_type": "frontend",
                "elapsed_ms": round(elapsed, 1),
                "success": True,
            }
            sections.append(section)
            agent_results.append(fe_result)
            yield _section_event(**{k: section[k] for k in
                                   ["title","content","model_used","task_type","elapsed_ms","success"]})
        else:
            yield _stage_event("Frontend Generation", "Gemini", "error",
                                f"[ GEMINI ] Error: {fe_result.error}", elapsed)
    else:
        yield _stage_event("Frontend Generation", "Gemini", "skipped",
                           "[ ROUTER ] Frontend Generation — skipped (Gemini not needed)")

    # ── Step 5: Explanation (Gemini as GPT orchestrator) ────────────────────────
    if task_type in ("explanation", "full"):
        yield _stage_event("Explanation Generation", "GPT", "running",
                           "[ GPT ] Orchestration → Architecture analysis, Coordination...")
        log_stage("Explanation Generation", "running", "Gemini as GPT")

        t0 = time.perf_counter()

        if task_type == "full":
            exp_prompt = (
                f"You are GPT Orchestrator. Analyze the full project just built for: {prompt}. "
                f"Provide: (1) Architecture overview, (2) Backend↔Frontend connection, "
                f"(3) Folder structure, (4) Deployment steps, (5) Scaling strategy. "
                f"Be concise and developer-focused."
            )
        else:
            exp_prompt = prompt

        exp_result = await run_gpt_agent(prompt=exp_prompt, memory=memory)
        elapsed = (time.perf_counter() - t0) * 1000

        if exp_result.success:
            memory = update_context(memory, "explanation", exp_result.output)

            stage_label = f"[ GPT ] Orchestration & architecture analysis complete in {elapsed:.0f}ms"
            yield _stage_event("Explanation Generation", "GPT", "complete", stage_label, elapsed)
            yield _stage_event("Memory Update", "Velora Memory", "complete",
                                "[ MEMORY ] GPT analysis saved → full project context persisted")

            section = {
                "title": "[ GPT ] Orchestration & Architecture",
                "content": exp_result.output,
                "model_used": _model_display_label(exp_result.model),
                "task_type": "explanation",
                "elapsed_ms": round(elapsed, 1),
                "success": True,
            }
            sections.append(section)
            agent_results.append(exp_result)
            yield _section_event(**{k: section[k] for k in
                                   ["title","content","model_used","task_type","elapsed_ms","success"]})
        else:
            yield _stage_event("Explanation Generation", "GPT", "error",
                                f"[ GPT ] Error: {exp_result.error}", elapsed)
    else:
        yield _stage_event("Explanation Generation", "GPT", "skipped",
                           "[ ROUTER ] GPT Orchestration — skipped (standalone code task)")

    # ── Fallback: no agents ran ────────────────────────────────────────────────
    if not agent_results:
        yield _stage_event("Fallback", "GPT", "running", "[ GPT ] Fallback response...")
        fallback = await run_gpt_agent(prompt=prompt, memory=memory)
        agent_results.append(fallback)
        section = {
            "title": "Response",
            "content": fallback.output,
            "model_used": _model_display_label(fallback.model),
            "task_type": "explanation",
            "elapsed_ms": 0.0,
            "success": fallback.success,
        }
        sections.append(section)
        yield _section_event(**{k: section[k] for k in
                               ["title","content","model_used","task_type","elapsed_ms","success"]})

    # ── Finalize memory & emit complete ────────────────────────────────────────
    yield _stage_event("Workflow Complete", "Velora Memory", "complete",
                       "[ GPT ORCHESTRATOR ] All models complete → Project context persisted → System ready")

    try:
        memory = set_project_goal(memory, prompt)
        model_labels = []
        seen = set()
        for s in sections:
            m = s["model_used"]
            if m not in seen:
                model_labels.append(m)
                seen.add(m)
        model_label = " + ".join(model_labels) if model_labels else "unknown"

        total_tokens_saved = sum(r.tokens_saved for r in agent_results)
        combined_output = "\n\n".join(
            f"── {s['title'].upper()} ──\n{s['content']}" for s in sections
        )

        memory = add_to_history(memory, role="user", content=prompt,
                                task_type=task_type, model_used=model_label, tokens_saved=0)
        memory = add_to_history(memory, role="assistant", content=combined_output,
                                task_type=task_type, model_used=model_label,
                                tokens_saved=total_tokens_saved)
        memory = update_stats(memory, model_label, total_tokens_saved)
        save_memory(memory)
    except Exception as e:
        print(f"[WARNING] Memory finalize failed: {e}")
        total_tokens_saved = 0
        combined_output = ""
        model_label = "unknown"

    elapsed_total = (time.perf_counter() - start_time) * 1000

    try:
        log_decision(
            user_id=user_id, prompt=prompt, classification=classification,
            primary_result=agent_results[0] if agent_results else None,
            secondary_result=agent_results[1] if len(agent_results) > 1 else None,
            elapsed_ms=elapsed_total,
        )
    except Exception as e:
        print(f"[WARNING] Logging failed: {e}")

    # Final complete event
    yield {
        "type": "complete",
        "result": {
            "success": True,
            "output": combined_output,
            "task_type": task_type,
            "model_used": model_label,
            "confidence": confidence,
            "tokens_saved": total_tokens_saved,
            "elapsed_ms": round(elapsed_total, 2),
            "user_id": user_id,
            "secondary_output": sections[1]["content"] if len(sections) > 1 else None,
            "error": None,
            "classification_reason": classification.reason,
            "workflow_stages": stages,
            "sections": sections,
            "memory_loaded": memory_loaded,
            "project_goal": memory.project_goal or "",
        }
    }
