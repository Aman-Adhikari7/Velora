"""
routes/orchestrator_routes.py
------------------------------
Velora API Routes — with SSE streaming endpoint for live workflow stages
"""

import json
import asyncio
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, AsyncGenerator
import time

from router.orchestrator import run_orchestrator
from router.streaming_orchestrator import run_orchestrator_streaming
from memory.manager import (
    load_memory,
    delete_memory,
    memory_exists,
    list_all_users,
)

router = APIRouter(tags=["Velora Orchestrator"])


class RunRequest(BaseModel):
    prompt:  str = Field(..., min_length=1, max_length=4000)
    user_id: str = Field(default="default_user")


class ResponseSection(BaseModel):
    title:      str
    content:    str
    model_used: str
    task_type:  str
    elapsed_ms: float = 0.0
    success:    bool  = True


class RunResponse(BaseModel):
    success:               bool
    output:                str
    task_type:             str
    model_used:            str
    confidence:            float
    tokens_saved:          int
    elapsed_ms:            float
    user_id:               str
    secondary_output:      Optional[str] = None
    error:                 Optional[str] = None
    classification_reason: Optional[str] = None
    workflow_stages:       list = []
    sections:              List[ResponseSection] = []
    memory_loaded:         bool = False
    project_goal:          str  = ""


@router.post("/run", response_model=RunResponse, summary="Send a prompt to Velora orchestrator")
async def run_prompt(body: RunRequest) -> RunResponse:
    result = await run_orchestrator(prompt=body.prompt, user_id=body.user_id)

    sections = [
        ResponseSection(
            title=s["title"],
            content=s["content"],
            model_used=s["model_used"],
            task_type=s["task_type"],
            elapsed_ms=s.get("elapsed_ms", 0.0),
            success=s.get("success", True),
        )
        for s in (result.sections or [])
    ]

    return RunResponse(
        success=result.success,
        output=result.output,
        task_type=result.task_type,
        model_used=result.model_used,
        confidence=result.confidence,
        tokens_saved=result.tokens_saved,
        elapsed_ms=result.elapsed_ms,
        user_id=result.user_id,
        secondary_output=result.secondary_output,
        error=result.error,
        classification_reason=(result.classification.reason if result.classification else None),
        workflow_stages=result.workflow_stages,
        sections=sections,
        memory_loaded=result.memory_loaded,
        project_goal=result.project_goal,
    )


@router.post("/run/stream", summary="Stream live workflow stages via SSE")
async def run_prompt_stream(body: RunRequest):
    """
    Server-Sent Events endpoint.
    Emits events as each agent starts and finishes — in real time.
    
    Event types:
      - stage_update   { stage: WorkflowStage }
      - section_done   { section: ResponseSection }
      - complete       { result: RunResponse }
      - error          { error: string }
    """
    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async for event in run_orchestrator_streaming(
                prompt=body.prompt,
                user_id=body.user_id,
            ):
                event_type = event.get("type", "unknown")
                data = json.dumps(event)
                yield f"event: {event_type}\ndata: {data}\n\n"
        except Exception as e:
            error_data = json.dumps({"type": "error", "error": str(e)})
            yield f"event: error\ndata: {error_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/memory/{user_id}", summary="Get user's project memory")
async def get_memory(user_id: str) -> dict:
    if not memory_exists(user_id):
        raise HTTPException(status_code=404, detail=f"No memory for user '{user_id}'.")
    memory = load_memory(user_id)
    return {
        "success": True,
        "user_id": user_id,
        "data": {
            "project_goal": memory.project_goal,
            "created_at":   memory.created_at,
            "updated_at":   memory.updated_at,
            "context": {
                "has_backend":         bool(memory.context.backend),
                "has_frontend":        bool(memory.context.frontend),
                "has_explanation":     bool(memory.context.explanation),
                "backend_snippet":     (memory.context.backend or "")[:300],
                "frontend_snippet":    (memory.context.frontend or "")[:300],
                "explanation_snippet": (memory.context.explanation or "")[:300],
            },
            "stats": {
                "total_prompts":  memory.stats.total_prompts,
                "claude_calls":   memory.stats.claude_calls,
                "gpt_calls":      memory.stats.gpt_calls,
                "frontend_calls": memory.stats.frontend_calls,
                "tokens_saved":   memory.stats.tokens_saved,
            },
        },
    }


@router.get("/history/{user_id}", summary="Get conversation history")
async def get_history(user_id: str, limit: int = Query(default=20, ge=1, le=100)) -> dict:
    if not memory_exists(user_id):
        raise HTTPException(status_code=404, detail=f"No history for user '{user_id}'.")
    memory = load_memory(user_id)
    history = memory.history
    if len(history) > limit:
        history = history[-limit:]
    return {
        "success":     True,
        "user_id":     user_id,
        "total_count": len(memory.history),
        "returned":    len(history),
        "messages": [
            {
                "id":           msg.id,
                "role":         msg.role,
                "content":      msg.content[:500],
                "full_length":  len(msg.content),
                "task_type":    msg.task_type,
                "model_used":   msg.model_used,
                "timestamp":    msg.timestamp,
                "tokens_saved": msg.tokens_saved,
            }
            for msg in history
        ],
    }


@router.post("/reset/{user_id}", summary="Reset project memory")
async def reset_memory(user_id: str) -> dict:
    was_deleted = delete_memory(user_id)
    if not was_deleted:
        return {"success": True, "user_id": user_id,
                "message": "No memory existed — nothing to reset.", "had_memory": False}
    return {"success": True, "user_id": user_id,
            "message": "Memory wiped. Next prompt starts fresh.", "had_memory": True}


@router.get("/stats/{user_id}", summary="Get efficiency metrics")
async def get_stats(user_id: str) -> dict:
    if not memory_exists(user_id):
        raise HTTPException(status_code=404, detail=f"No stats for user '{user_id}'.")
    memory = load_memory(user_id)
    s = memory.stats
    estimated_cost_saved = round((s.tokens_saved / 1_000_000) * 1.5, 4)
    total_calls = s.claude_calls + s.gpt_calls + s.frontend_calls
    prompt_reduction = min(round((s.tokens_saved / max(s.total_prompts * 500, 1)) * 100, 1), 85.0)
    context_reuse = min(round((total_calls / max(s.total_prompts, 1)) * 30, 1), 90.0)
    api_calls_saved = max(0, s.total_prompts - total_calls)
    return {
        "success": True,
        "user_id": user_id,
        "stats": {
            "total_prompts":        s.total_prompts,
            "claude_calls":         s.claude_calls,
            "gpt_calls":            s.gpt_calls,
            "frontend_calls":       s.frontend_calls,
            "tokens_saved":         s.tokens_saved,
            "estimated_cost_saved": f"${estimated_cost_saved}",
            "prompt_reduction_pct": prompt_reduction,
            "context_reuse_pct":    context_reuse,
            "api_calls_saved":      api_calls_saved,
        },
        "project_goal": memory.project_goal,
    }


@router.get("/users", summary="List all users")
async def list_users() -> dict:
    users = list_all_users()
    return {"success": True, "user_count": len(users), "users": users}


@router.get("/chat-history/{user_id}", summary="Get user prompt history for sidebar")
async def get_chat_history(user_id: str) -> dict:
    if not memory_exists(user_id):
        return {"success": True, "user_id": user_id, "prompts": []}
    memory = load_memory(user_id)
    user_msgs = [m for m in memory.history if m.role == "user"]
    return {
        "success":      True,
        "user_id":      user_id,
        "project_goal": memory.project_goal,
        "prompts": [
            {
                "id":         msg.id,
                "content":    msg.content,
                "task_type":  msg.task_type,
                "model_used": msg.model_used,
                "timestamp":  msg.timestamp,
            }
            for msg in reversed(user_msgs[-10:])
        ],
    }
