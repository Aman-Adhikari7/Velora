"""
memory/manager.py
-----------------
All memory operations live here.
Think of this like a mini database service layer in Node —
instead of mongoose.find() / mongoose.save(), we read/write JSON files.

Every function is pure and explicit — no hidden side effects.
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional

from config import MEMORY_DIR, MAX_HISTORY
from memory.schema import UserMemory, HistoryMessage, ContextBlock, UsageStats


# ── Internal helpers ──────────────────────────────────────────────────────────

def _file_path(user_id: str) -> str:
    """Returns the path to a user's memory file."""
    return os.path.join(MEMORY_DIR, f"{user_id}.json")


def _now() -> str:
    """Returns current UTC time as ISO string."""
    return datetime.utcnow().isoformat()


# ── Core CRUD ─────────────────────────────────────────────────────────────────

def load_memory(user_id: str) -> UserMemory:
    """
    Load a user's memory from disk.
    If the file doesn't exist, create a fresh memory object.

    Like: User.findOne({ id }) || new User({ id })
    """
    path = _file_path(user_id)

    if os.path.exists(path):
        with open(path, "r") as f:
            data = json.load(f)
        return UserMemory(**data)

    # First time this user — create fresh memory
    return UserMemory(user_id=user_id)


def save_memory(memory: UserMemory) -> None:
    """
    Save memory object to disk as JSON.
    Like: await user.save()
    """
    memory.updated_at = _now()
    path = _file_path(memory.user_id)

    os.makedirs(os.path.dirname(path), exist_ok=True)

    with open(path, "w") as f:
        # model_dump() converts Pydantic model → plain dict
        # indent=2 makes it human-readable
        json.dump(memory.model_dump(), f, indent=2)


def delete_memory(user_id: str) -> bool:
    """
    Delete a user's memory file completely.
    Used by the /reset endpoint.
    Returns True if deleted, False if file didn't exist.
    """
    path = _file_path(user_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def memory_exists(user_id: str) -> bool:
    """Check if a user already has saved memory."""
    return os.path.exists(_file_path(user_id))


# ── Context updates ───────────────────────────────────────────────────────────

def update_context(memory: UserMemory, task_type: str, output: str) -> UserMemory:
    """
    Store the output from an agent into the right context slot.

    task_type "backend"     → memory.context.backend     = output
    task_type "frontend"    → memory.context.frontend    = output
    task_type "explanation" → memory.context.explanation = output

    This is what gets passed into future AI calls so they know
    what other agents have already produced.
    """
    if task_type == "backend":
        memory.context.backend = output
    elif task_type == "frontend":
        memory.context.frontend = output
    elif task_type == "explanation":
        memory.context.explanation = output

    return memory


def set_project_goal(memory: UserMemory, goal: str) -> UserMemory:
    """
    Set the project goal on first prompt.
    Only updates if goal isn't set yet — preserves continuity.

    Example:
        Prompt 1: "Build a login system" → goal = "Build a login system"
        Prompt 2: "Add dashboard"        → goal stays "Build a login system"
                                           (continuity preserved)
    """
    if not memory.project_goal:
        memory.project_goal = goal
    return memory


# ── History ───────────────────────────────────────────────────────────────────

def add_to_history(
    memory:      UserMemory,
    role:        str,
    content:     str,
    task_type:   Optional[str] = None,
    model_used:  Optional[str] = None,
    tokens_saved: int = 0,
) -> UserMemory:
    """
    Append a message to the user's history.
    Automatically trims to MAX_HISTORY to prevent files getting huge.

    Like pushing to a capped array in MongoDB.
    """
    message = HistoryMessage(
        id=str(uuid.uuid4())[:8],   # short unique ID like "a3f9b2c1"
        role=role,
        content=content,
        task_type=task_type,
        model_used=model_used,
        timestamp=_now(),
        tokens_saved=tokens_saved,
    )

    memory.history.append(message)

    # Trim oldest messages if over limit
    if len(memory.history) > MAX_HISTORY:
        memory.history = memory.history[-MAX_HISTORY:]

    return memory


def get_recent_history(memory: UserMemory, n: int = 5) -> list[dict]:
    """
    Get the last N messages as plain dicts.
    Used to build context for AI prompts — we don't want to
    send the entire history every time, just recent context.
    """
    recent = memory.history[-n:] if len(memory.history) >= n else memory.history
    return [msg.model_dump() for msg in recent]


# ── Stats ─────────────────────────────────────────────────────────────────────

def update_stats(
    memory:      UserMemory,
    model_used:  str,
    tokens_saved: int = 0,
) -> UserMemory:
    """
    Update usage counters after each agent call.
    This powers the 'tokens saved' demo feature.
    """
    memory.stats.total_prompts += 1
    memory.stats.tokens_saved  += tokens_saved

    if "claude" in model_used.lower():
        memory.stats.claude_calls += 1
    if "gpt" in model_used.lower():
        memory.stats.gpt_calls += 1
    if "frontend" in model_used.lower() or "stitch" in model_used.lower():
        memory.stats.frontend_calls += 1

    return memory


# ── Context builder ───────────────────────────────────────────────────────────

def build_context_summary(memory: UserMemory) -> str:
    """
    Build a compact context string to inject into every AI prompt.
    This is what makes the system 'remember' — each agent gets this
    at the start of their prompt so they know what already exists.

    Example output:
        PROJECT GOAL: Build a login system

        EXISTING BACKEND:
        FastAPI app with /login endpoint using JWT...

        EXISTING FRONTEND:
        Login form component with email/password fields...
    """
    parts = []

    if memory.project_goal:
        parts.append(f"PROJECT GOAL: {memory.project_goal}")

    if memory.context.backend:
        parts.append(f"\nEXISTING BACKEND OUTPUT:\n{memory.context.backend[:800]}")

    if memory.context.frontend:
        parts.append(f"\nEXISTING FRONTEND OUTPUT:\n{memory.context.frontend[:800]}")

    if memory.context.explanation:
        parts.append(f"\nEXISTING EXPLANATION:\n{memory.context.explanation[:400]}")

    if not parts:
        return "No prior context — this is the start of a new project."

    return "\n".join(parts)


# ── List all users ─────────────────────────────────────────────────────────────

def list_all_users() -> list[str]:
    """
    Returns a list of all user_ids that have memory files.
    Used by admin endpoints.
    """
    if not os.path.exists(MEMORY_DIR):
        return []

    return [
        f.replace(".json", "")
        for f in os.listdir(MEMORY_DIR)
        if f.endswith(".json")
    ]
