"""
agents/claude_agent.py  (now powered by Groq — free tier)
----------------------------------------------------------
Handles ALL backend/code tasks.
Was Claude Sonnet → now Groq llama3-70b (free, fast, great at code).

Groq API is OpenAI-compatible format, so the call shape is nearly identical
to the old OpenAI call. Base URL changes, key changes, that's it.

Get your free Groq key: https://console.groq.com
"""

import httpx
import json
from dataclasses import dataclass
from typing import Optional

import config as _config
from memory.schema import UserMemory
from memory.manager import build_context_summary


@dataclass
class AgentResult:
    """Standardized result returned by every agent."""
    success:       bool
    output:        str
    model:         str
    tokens_saved:  int = 0
    error:         Optional[str] = None
    raw_response:  Optional[dict] = None


def _build_system_prompt(memory: UserMemory) -> str:
    context = build_context_summary(memory)
    return f"""You are Claude — Backend Engineering AI in a 3-model AI orchestration system.

[ ROLE ] Claude handles ALL backend engineering: APIs, databases, auth, server logic, validation, security.

── CONTEXT FROM MEMORY ──────────────────────────────────────────────────────
{context}
─────────────────────────────────────────────────────────────────────────────

── EXECUTION RULES ──────────────────────────────────────────────────────────
1. Generate COMPLETE, production-ready backend code — never pseudocode or stubs
2. Default stack: Python + FastAPI + SQLAlchemy unless context specifies otherwise
3. Always include: imports, type hints, docstrings, error handling
4. Structure output with clear file sections: models, routes, auth, config, main
5. Include a brief [ CLAUDE LOG ] section at the end listing all files generated
6. Flag security considerations inline with # SECURITY: comments
7. If extending existing code from memory — build on it, don't restart
─────────────────────────────────────────────────────────────────────────────
"""


def _estimate_tokens_saved(memory: UserMemory) -> int:
    if not memory.history:
        return 0
    full_chars = sum(len(msg.content) for msg in memory.history)
    compressed = build_context_summary(memory)
    saved_chars = max(0, full_chars - len(compressed))
    return saved_chars // 4


async def run_claude_agent(
    prompt: str,
    memory: UserMemory,
    max_tokens: int = 2048,
) -> AgentResult:
    """Call Groq (llama3-70b) for backend/code tasks."""
    api_key = _config.GROQ_API_KEY
    model   = _config.GROQ_MODEL

    if not api_key:
        return AgentResult(
            success=False, output="", model=model,
            error="GROQ_API_KEY is not set. Get a free key at https://console.groq.com and add it to .env",
        )

    system_prompt = _build_system_prompt(memory)
    tokens_saved  = _estimate_tokens_saved(memory)

    # Groq uses OpenAI-compatible format
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": prompt},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            )

        raw = response.json()

        if response.status_code != 200:
            err = raw.get("error", {}).get("message", f"HTTP {response.status_code}")
            return AgentResult(success=False, output="", model=model,
                               error=f"Groq API error: {err}", raw_response=raw)

        choices = raw.get("choices", [])
        if not choices:
            return AgentResult(success=False, output="", model=model,
                               error="Groq returned no choices.", raw_response=raw)

        output_text = choices[0].get("message", {}).get("content", "").strip()
        if not output_text:
            return AgentResult(success=False, output="", model=model,
                               error="Groq returned empty response.", raw_response=raw)

        return AgentResult(success=True, output=output_text, model=f"groq/{model}",
                           tokens_saved=tokens_saved, raw_response=raw)

    except httpx.TimeoutException:
        return AgentResult(success=False, output="", model=model,
                           error="Groq API timed out after 60s.")
    except httpx.RequestError as e:
        return AgentResult(success=False, output="", model=model,
                           error=f"Network error calling Groq: {str(e)}")
    except (json.JSONDecodeError, KeyError) as e:
        return AgentResult(success=False, output="", model=model,
                           error=f"Failed to parse Groq response: {str(e)}")
