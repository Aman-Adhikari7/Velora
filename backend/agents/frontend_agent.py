"""
agents/frontend_agent.py  (now powered by Gemini Flash — REAL code generation)
--------------------------------------------------------------------------------
Handles ALL frontend/UI tasks.
NOW: Actually calls Gemini 1.5 Flash to generate real, working React + Tailwind code.

Previous version just built a static spec document.
This version DECIDES what to build based on prompt + memory, then calls Gemini.

Get your free Gemini key: https://aistudio.google.com/app/apikey
"""

import httpx
import json
from typing import Optional

import config as _config
from memory.schema import UserMemory
from memory.manager import build_context_summary
from agents.claude_agent import AgentResult


def _extract_routes(backend_ctx: str) -> str:
    """Extract API route hints from backend context."""
    if not backend_ctx:
        return ""
    import re
    routes = re.findall(r'@(?:app|router)\.\w+\(["\']([^"\']+)["\']', backend_ctx)
    methods = re.findall(r'@(?:app|router)\.(\w+)\(', backend_ctx)
    if not routes:
        return ""
    lines = ["Base URL: http://localhost:8000"]
    for i, route in enumerate(routes[:10]):
        method = methods[i].upper() if i < len(methods) else "GET"
        lines.append(f"  {method} {route}")
    return "\n".join(lines)


def _build_system_prompt(memory: UserMemory) -> str:
    context = build_context_summary(memory)
    backend_ctx = memory.context.backend or ""
    api_routes = _extract_routes(backend_ctx)

    return f"""You are Gemini — Frontend Engineering AI in a 3-model AI orchestration system.

[ ROLE ] Gemini handles ALL frontend engineering: React components, UI layouts, forms, dashboards, design systems.

── CONTEXT FROM MEMORY ──────────────────────────────────────────────────────
{context}
─────────────────────────────────────────────────────────────────────────────
{f"── BACKEND API (connect your components to these) ──────────────────────────{chr(10)}{api_routes}{chr(10)}─────────────────────────────────────────────────────────────────────────────" if api_routes else ""}

── EXECUTION RULES ──────────────────────────────────────────────────────────
1. Generate COMPLETE, production-ready React code — never pseudocode or stubs
2. Default stack: React 18 (hooks) + Tailwind CSS + lucide-react icons
3. Always generate working JSX — include controlled state, loading, error, empty states
4. Connect to backend API endpoints from memory if they exist
5. Structure output with clear component sections and file comments
6. Include a [ GEMINI LOG ] section at end listing all components generated
7. Make it look PROFESSIONAL — proper spacing, visual hierarchy, responsive design
8. If extending existing frontend from memory — build on it, don't restart
─────────────────────────────────────────────────────────────────────────────
"""


async def run_frontend_agent(
    prompt: str,
    memory: UserMemory,
    max_tokens: int = 2048,
) -> AgentResult:
    """
    Call Gemini 1.5 Flash to generate REAL frontend code.
    This is fully dynamic — Gemini decides what to build and generates it.
    """
    api_key = _config.GEMINI_API_KEY
    model = _config.GEMINI_MODEL

    if not api_key:
        return AgentResult(
            success=False, output="", model=model,
            error="GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/app/apikey",
        )

    system_prompt = _build_system_prompt(memory)

    tokens_saved = 0
    if memory.history:
        full_chars = sum(len(msg.content) for msg in memory.history)
        compressed = build_context_summary(memory)
        saved_chars = max(0, full_chars - len(compressed))
        tokens_saved = saved_chars // 4

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7},
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers={"Content-Type": "application/json"}, json=payload)

        raw = response.json()

        if response.status_code != 200:
            err = raw.get("error", {}).get("message", f"HTTP {response.status_code}")
            return AgentResult(success=False, output="", model=model,
                               error=f"Gemini API error (frontend): {err}", raw_response=raw)

        candidates = raw.get("candidates", [])
        if not candidates:
            return AgentResult(success=False, output="", model=model,
                               error="Gemini returned no candidates for frontend.", raw_response=raw)

        parts = candidates[0].get("content", {}).get("parts", [])
        output_text = " ".join(p.get("text", "") for p in parts).strip()

        if not output_text:
            return AgentResult(success=False, output="", model=model,
                               error="Gemini returned empty response for frontend.", raw_response=raw)

        return AgentResult(
            success=True, output=output_text,
            model=f"gemini/{model}", tokens_saved=tokens_saved, raw_response=raw,
        )

    except httpx.TimeoutException:
        return AgentResult(success=False, output="", model=model,
                           error="Gemini API timed out after 60s (frontend).")
    except httpx.RequestError as e:
        return AgentResult(success=False, output="", model=model,
                           error=f"Network error calling Gemini (frontend): {str(e)}")
    except (json.JSONDecodeError, KeyError) as e:
        return AgentResult(success=False, output="", model=model,
                           error=f"Failed to parse Gemini response (frontend): {str(e)}")
