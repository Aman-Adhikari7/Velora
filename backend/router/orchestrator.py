"""
router/orchestrator.py
-----------------------
Velora — THE MAIN BRAIN
Sequential multi-AI orchestration with unified memory and structured logging.

KEY CHANGE v2: Returns `sections` list so UI renders each agent output as
a separate named section inside the same chat response.

Execution order:
    1. Planner (classify + build plan, load memory)
    2. Backend Agent (Claude)    — if task_type in (backend, full)
    3. Frontend Agent (Stitch)   — if task_type in (frontend, full)
    4. Explanation Agent (GPT-4) — if task_type in (explanation, full)
    5. Memory persisted after each agent, then again at end
    6. Log Decision
"""

import time
from dataclasses import dataclass, field
from typing import Optional

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
)
from memory.schema import UserMemory
from logger.workflow_logger import log_decision, log_stage


def _model_display_label(model_str: str) -> str:
    """Map internal model names to UI display labels per the 3-model system."""
    lower = (model_str or "").lower()
    if "groq" in lower or "llama" in lower:
        return "Claude"                  # Claude = Backend Engineering
    if "gemini" in lower:
        return "Gemini"                  # Gemini = Frontend/UI Engineering
    if "gpt" in lower:
        return "GPT"                     # GPT = Orchestration + Explanation
    if "stitch" in lower or "frontend" in lower or "cursor" in lower:
        return "Gemini"                  # Frontend builder = Gemini slot
    return model_str


@dataclass
class OrchestratorResult:
    success:          bool
    output:           str                        # combined plain text (legacy compat)
    task_type:        str
    model_used:       str
    confidence:       float
    tokens_saved:     int             = 0
    elapsed_ms:       float           = 0.0
    user_id:          str             = ""
    secondary_output: Optional[str]   = None     # legacy compat
    error:            Optional[str]   = None
    classification:   Optional[ClassificationResult] = None
    workflow_stages:  list = field(default_factory=list)
    sections:         list = field(default_factory=list)   # NEW — per-agent sections
    memory_loaded:    bool = False
    project_goal:     str  = ""


async def _run_sequential_workflow(
    prompt:    str,
    task_type: str,
    memory:    UserMemory,
) -> tuple:
    """
    Execute agents in sequence. Returns (agent_results, sections, stages, updated_memory).
    Memory is updated after EACH agent so subsequent agents see prior outputs.
    """
    stages = []
    sections = []
    agent_results = []

    # ── Stage 1: Planner / Memory check ──────────────────────────────────────
    has_prior = bool(memory.project_goal or memory.context.backend or memory.context.frontend)
    if has_prior:
        planner_label = "[ GPT ORCHESTRATOR ] Memory loaded → Existing project context detected → Continuing workflow"
    else:
        planner_label = "[ GPT ORCHESTRATOR ] Analyzing request → Detecting technologies → Planning architecture → Selecting AI models"

    stages.append({
        "name": "[ GPT ORCHESTRATOR ]",
        "agent": "GPT",
        "status": "complete",
        "label": planner_label,
    })
    log_stage("Planner", "complete", f"Task: {task_type}, Memory: {has_prior}")

    # ── Stage 2: Backend Generation ───────────────────────────────────────────
    if task_type in ("backend", "full"):
        log_stage("Backend Generation", "running", "[ MODEL SWITCH ] GPT → Claude | Backend Engineering")
        t0 = time.perf_counter()
        backend_result = await run_claude_agent(prompt=prompt, memory=memory)
        elapsed = (time.perf_counter() - t0) * 1000

        ok = backend_result.success
        stages.append({
            "name": "Backend Generation",
            "agent": "Claude",
            "status": "complete" if ok else "error",
            "label": f"[ CLAUDE ] Backend engineering complete in {elapsed:.0f}ms" if ok else f"[Claude] Error: {backend_result.error}",
            "elapsed_ms": round(elapsed, 1),
        })

        if ok:
            # Persist to memory immediately so frontend/explanation agents can see it
            memory = update_context(memory, "backend", backend_result.output)
            stages.append({
                "name": "Memory Update",
                "agent": "Velora Memory",
                "status": "complete",
                "label": "[ MEMORY ] Claude output saved → Gemini context ready",
            })
            sections.append({
                "title": "[ CLAUDE ] Backend Engineering",
                "content": backend_result.output,
                "model_used": _model_display_label(backend_result.model),
                "task_type": "backend",
                "elapsed_ms": round(elapsed, 1),
                "success": True,
            })
            agent_results.append(backend_result)

        log_stage("Backend Generation", "complete" if ok else "error",
                  f"Claude in {elapsed:.0f}ms")
    else:
        stages.append({
            "name": "Backend Generation",
            "agent": "Claude",
            "status": "skipped",
            "label": "[ ROUTER ] Backend Generation — skipped (Claude not needed for this task)",
        })

    # ── Stage 3: Frontend Generation ──────────────────────────────────────────
    if task_type in ("frontend", "full"):
        log_stage("Frontend Generation", "running", "[ MODEL SWITCH ] Claude → Gemini | Frontend Engineering")
        t0 = time.perf_counter()
        fe_result = await run_frontend_agent(prompt=prompt, memory=memory)
        elapsed = (time.perf_counter() - t0) * 1000

        ok = fe_result.success
        stages.append({
            "name": "Frontend Generation",
            "agent": "Frontend AI",
            "status": "complete" if ok else "error",
            "label": f"[ GEMINI ] Frontend engineering complete in {elapsed:.0f}ms" if ok else f"[Frontend AI] Error: {fe_result.error}",
            "elapsed_ms": round(elapsed, 1),
        })

        if ok:
            memory = update_context(memory, "frontend", fe_result.output)
            stages.append({
                "name": "Memory Update",
                "agent": "Velora Memory",
                "status": "complete",
                "label": "[ MEMORY ] Gemini output saved → GPT context ready",
            })
            sections.append({
                "title": "[ GEMINI ] Frontend Engineering",
                "content": fe_result.output,
                "model_used": _model_display_label(fe_result.model),
                "task_type": "frontend",
                "elapsed_ms": round(elapsed, 1),
                "success": True,
            })
            agent_results.append(fe_result)

        log_stage("Frontend Generation", "complete" if ok else "error",
                  f"Stitch in {elapsed:.0f}ms")
    else:
        stages.append({
            "name": "Frontend Generation",
            "agent": "Frontend AI",
            "status": "skipped",
            "label": "[ ROUTER ] Frontend Generation — skipped (Gemini not needed for this task)",
        })

    # ── Stage 4: Explanation Generation ──────────────────────────────────────
    if task_type in ("explanation", "full"):
        log_stage("Explanation Generation", "running", "[ MODEL SWITCH ] Gemini → GPT | Orchestration & Coordination")
        t0 = time.perf_counter()

        if task_type == "full":
            exp_prompt = (
                f"You are GPT Orchestrator. Analyze the full project just built for: {prompt}. "
                f"Provide: (1) Architecture overview, (2) Backend↔Frontend connection, (3) Folder structure, (4) Deployment steps, (5) Scaling strategy. Be concise and developer-focused."
            )
        else:
            exp_prompt = prompt

        exp_result = await run_gpt_agent(prompt=exp_prompt, memory=memory)
        elapsed = (time.perf_counter() - t0) * 1000

        ok = exp_result.success
        stages.append({
            "name": "Explanation Generation",
            "agent": "GPT-4",
            "status": "complete" if ok else "error",
            "label": f"[ GPT ] Orchestration & architecture analysis complete in {elapsed:.0f}ms" if ok else f"[GPT-4] Error: {exp_result.error}",
            "elapsed_ms": round(elapsed, 1),
        })

        if ok:
            memory = update_context(memory, "explanation", exp_result.output)
            stages.append({
                "name": "Memory Update",
                "agent": "Velora Memory",
                "status": "complete",
                "label": "[ MEMORY ] GPT analysis saved → full project context persisted",
            })
            sections.append({
                "title": "[ GPT ] Orchestration & Architecture",
                "content": exp_result.output,
                "model_used": _model_display_label(exp_result.model),
                "task_type": "explanation",
                "elapsed_ms": round(elapsed, 1),
                "success": True,
            })
            agent_results.append(exp_result)

        log_stage("Explanation Generation", "complete" if ok else "error",
                  f"GPT-4 in {elapsed:.0f}ms")
    else:
        stages.append({
            "name": "Explanation Generation",
            "agent": "GPT-4",
            "status": "skipped",
            "label": "[ ROUTER ] GPT Orchestration — skipped (standalone code task)",
        })

    # ── Final workflow complete ────────────────────────────────────────────────
    stages.append({
        "name": "Workflow Complete",
        "agent": "Velora Memory",
        "status": "complete",
        "label": "[ GPT ORCHESTRATOR ] All 3 models complete → Project context persisted → System ready",
    })

    # Fallback: should never happen but safety net
    if not agent_results:
        log_stage("Fallback", "running", "No agents ran — GPT-4 fallback")
        fallback = await run_gpt_agent(prompt=prompt, memory=memory)
        agent_results.append(fallback)
        sections.append({
            "title": "Response",
            "content": fallback.output,
            "model_used": _model_display_label(fallback.model),
            "task_type": "explanation",
            "elapsed_ms": 0.0,
            "success": fallback.success,
        })

    return agent_results, sections, stages, memory


def _build_combined_output(sections: list) -> str:
    parts = []
    for i, sec in enumerate(sections, 1):
        parts.append(f"── SECTION {i}: {sec['title'].upper()} (Model: {sec['model_used']}) ──\n")
        parts.append(sec["content"])
        parts.append("")
    return "\n".join(parts)


def _resolve_model_label(sections: list) -> str:
    models, seen = [], set()
    for sec in sections:
        m = sec["model_used"]
        if m not in seen:
            models.append(m)
            seen.add(m)
    return " + ".join(models) if models else "unknown"


async def run_orchestrator(
    prompt:  str,
    user_id: str = "default_user",
) -> OrchestratorResult:
    """Velora main orchestrator — sequential AI workflow with unified memory."""
    start_time = time.perf_counter()

    # ── Step 1: Load memory ────────────────────────────────────────────────────
    log_stage("Memory Load", "running", f"Loading context for user: {user_id}")
    try:
        memory = load_memory(user_id)
        memory_loaded = bool(memory.project_goal or memory.context.backend or memory.context.frontend)
        log_stage("Memory Load", "complete",
                  "Previous context loaded" if memory_loaded else "Fresh session")
    except Exception as e:
        return OrchestratorResult(
            success=False, output="", task_type="unknown", model_used="none",
            confidence=0.0, user_id=user_id,
            error=f"Failed to load memory for user '{user_id}': {str(e)}",
            elapsed_ms=0.0, workflow_stages=[], sections=[],
        )

    # ── Step 2: Classify ───────────────────────────────────────────────────────
    classification = classify_task(prompt)
    task_type = classification.task_type
    confidence = classification.confidence
    log_stage("Planner", "complete", f"Classified as '{task_type}' ({confidence:.0%})")

    # ── Step 3: Run sequential workflow ───────────────────────────────────────
    try:
        agent_results, sections, stages, memory = await _run_sequential_workflow(
            prompt, task_type, memory
        )
    except Exception as e:
        elapsed = (time.perf_counter() - start_time) * 1000
        return OrchestratorResult(
            success=False, output="", task_type=task_type, model_used="error",
            confidence=confidence, classification=classification, user_id=user_id,
            error=f"Workflow failed: {str(e)}", elapsed_ms=round(elapsed, 2),
            workflow_stages=[], sections=[],
        )

    model_label = _resolve_model_label(sections)

    # ── Step 4: Finalize memory ────────────────────────────────────────────────
    try:
        memory = set_project_goal(memory, prompt)
        total_tokens_saved = sum(r.tokens_saved for r in agent_results)
        combined_output = _build_combined_output(sections)

        memory = add_to_history(memory, role="user", content=prompt,
                                 task_type=task_type, model_used=model_label, tokens_saved=0)
        memory = add_to_history(memory, role="assistant", content=combined_output,
                                 task_type=task_type, model_used=model_label,
                                 tokens_saved=total_tokens_saved)
        memory = update_stats(memory, model_label, total_tokens_saved)
        save_memory(memory)
    except Exception as e:
        print(f"[WARNING] Memory finalize failed for user {user_id}: {e}")
        total_tokens_saved = 0
        combined_output = _build_combined_output(sections)

    # ── Step 5: Log ────────────────────────────────────────────────────────────
    elapsed = (time.perf_counter() - start_time) * 1000
    primary = agent_results[0] if agent_results else None
    secondary = agent_results[1] if len(agent_results) > 1 else None

    try:
        log_decision(user_id=user_id, prompt=prompt, classification=classification,
                     primary_result=primary, secondary_result=secondary, elapsed_ms=elapsed)
    except Exception as e:
        print(f"[WARNING] Logging failed: {e}")

    return OrchestratorResult(
        success=True,
        output=combined_output,
        task_type=task_type,
        model_used=model_label,
        confidence=confidence,
        classification=classification,
        tokens_saved=total_tokens_saved,
        elapsed_ms=round(elapsed, 2),
        user_id=user_id,
        secondary_output=sections[1]["content"] if len(sections) > 1 else None,
        workflow_stages=stages,
        sections=sections,
        memory_loaded=memory_loaded,
        project_goal=memory.project_goal or "",
    )
