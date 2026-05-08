"""
agents/gpt_agent.py  (now powered by Gemini Flash — free tier)
--------------------------------------------------------------
Handles ALL explanation and Q&A tasks.
Was GPT-4o-mini → now Gemini 1.5 Flash (free, fast, excellent at explanations).

Gemini API format is different from OpenAI — uses /v1beta/models/{model}:generateContent
Get your free Gemini key: https://aistudio.google.com/app/apikey

Usage stays identical from orchestrator's perspective — same AgentResult shape.
"""

import httpx
import json
from typing import Optional

import config as _config
from memory.schema import UserMemory
from memory.manager import build_context_summary
from agents.claude_agent import AgentResult


def _build_system_prompt(memory: UserMemory) -> str:
    context = build_context_summary(memory)
    return f"""You are GPT — Orchestrator & Coordinator in a 3-model AI engineering system.

[ ROLE ] GPT handles: project orchestration, architecture analysis, explanations, debugging, coordination.
[ SYSTEM ] The 3-model workflow is: Claude (Backend) → Gemini (Frontend) → GPT (You, Orchestration)

── CONTEXT FROM MEMORY ──────────────────────────────────────────────────────
{context}
─────────────────────────────────────────────────────────────────────────────

── EXECUTION RULES ──────────────────────────────────────────────────────────
1. When analyzing a completed project: give architecture overview, folder structure, API flow
2. When explaining concepts: be clear, reference the actual project context above
3. Provide deployment steps when the project is complete (Docker, env vars, run commands)
4. Suggest scaling strategies and potential optimizations
5. Format with clear sections using [ headers ] so the UI can highlight each part
6. End with a [ GPT SUMMARY ] one-paragraph wrap-up of the entire system built
─────────────────────────────────────────────────────────────────────────────
"""


def _estimate_tokens_saved(memory: UserMemory) -> int:
    if not memory.history:
        return 0
    full_chars = sum(len(msg.content) for msg in memory.history)
    compressed = build_context_summary(memory)
    saved_chars = max(0, full_chars - len(compressed))
    return saved_chars // 4


async def run_gpt_agent(
    prompt: str,
    memory: UserMemory,
    max_tokens: int = 1024,
) -> AgentResult:
    """Call Gemini 1.5 Flash for explanation/Q&A tasks."""
    api_key = _config.GEMINI_API_KEY
    model   = _config.GEMINI_MODEL

    if not api_key:
        return AgentResult(
            success=False, output="", model=model,
            error="GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/app/apikey and add it to .env",
        )

    system_prompt = _build_system_prompt(memory)
    tokens_saved  = _estimate_tokens_saved(memory)

    # Gemini API format — different from OpenAI
    # System prompt goes as first "user" turn with model ack, then real user turn
    # OR use systemInstruction field (v1beta supports it)
    payload = {
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.7,
        }
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
            )

        raw = response.json()

        if response.status_code != 200:
            err = raw.get("error", {}).get("message", f"HTTP {response.status_code}")
            return AgentResult(success=False, output="", model=model,
                               error=f"Gemini API error: {err}", raw_response=raw)

        # Gemini response shape:
        # { "candidates": [{ "content": { "parts": [{ "text": "..." }] } }] }
        candidates = raw.get("candidates", [])
        if not candidates:
            return AgentResult(success=False, output="", model=model,
                               error="Gemini returned no candidates.", raw_response=raw)

        parts = candidates[0].get("content", {}).get("parts", [])
        output_text = " ".join(p.get("text", "") for p in parts).strip()

        if not output_text:
            return AgentResult(success=False, output="", model=model,
                               error="Gemini returned empty response.", raw_response=raw)

        return AgentResult(success=True, output=output_text, model=f"gemini/{model}",
                           tokens_saved=tokens_saved, raw_response=raw)

    except httpx.TimeoutException:
        return AgentResult(success=False, output="", model=model,
                           error="Gemini API timed out after 30s.")
    except httpx.RequestError as e:
        return AgentResult(success=False, output="", model=model,
                           error=f"Network error calling Gemini: {str(e)}")
    except (json.JSONDecodeError, KeyError) as e:
        return AgentResult(success=False, output="", model=model,
                           error=f"Failed to parse Gemini response: {str(e)}")
