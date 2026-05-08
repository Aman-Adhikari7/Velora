"""
memory/schema.py
----------------
Defines the exact shape of a memory file.
Every user gets their own JSON file that looks exactly like this.

Think of this like a Mongoose schema in Node — it defines
what fields exist, what type they are, and their default values.

A real file saved to disk looks like:
{
    "user_id": "user_123",
    "project_goal": "Build a login system",
    "created_at": "2025-01-01T10:00:00",
    "updated_at": "2025-01-01T10:05:00",
    "context": {
        "backend":     "...Claude's output...",
        "frontend":    "...Stitch's output...",
        "explanation": "...GPT's output..."
    },
    "history": [
        {
            "id": "msg_001",
            "role": "user",
            "content": "Build a login system",
            "task_type": "full",
            "model_used": "claude+gpt",
            "timestamp": "2025-01-01T10:00:00",
            "tokens_saved": 120
        }
    ],
    "stats": {
        "total_prompts": 3,
        "claude_calls":  1,
        "gpt_calls":     2,
        "frontend_calls":1,
        "tokens_saved":  340
    }
}
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ContextBlock(BaseModel):
    """
    Stores the latest output from each agent.
    These get passed into every new AI call so agents
    always know what the others have already done.
    """
    backend:     Optional[str] = None   # Claude's last output
    frontend:    Optional[str] = None   # Stitch/Cursor's last output
    explanation: Optional[str] = None   # GPT's last output


class HistoryMessage(BaseModel):
    model_config = {"protected_namespaces": ()}
    """
    One entry in the conversation history.
    Like a MongoDB document for a single message.
    """
    id:          str                          # unique message ID
    role:        str                          # "user" or "assistant"
    content:     str                          # the actual text
    task_type:   Optional[str] = None         # backend | frontend | explanation | full
    model_used:  Optional[str] = None         # which AI handled this
    timestamp:   str = Field(
        default_factory=lambda: datetime.utcnow().isoformat()
    )
    tokens_saved: int = 0                     # estimated tokens saved by smart routing


class UsageStats(BaseModel):
    """
    Running totals — used to show the demo value:
    'We saved X tokens by routing to the right model'
    """
    total_prompts:   int = 0
    claude_calls:    int = 0
    gpt_calls:       int = 0
    frontend_calls:  int = 0
    tokens_saved:    int = 0


class UserMemory(BaseModel):
    """
    The full memory object for one user.
    Serialized to JSON and saved as memory/store/{user_id}.json
    """
    user_id:       str
    project_goal:  Optional[str] = None       # set on first prompt
    created_at:    str = Field(
        default_factory=lambda: datetime.utcnow().isoformat()
    )
    updated_at:    str = Field(
        default_factory=lambda: datetime.utcnow().isoformat()
    )
    context:       ContextBlock  = Field(default_factory=ContextBlock)
    history:       list[HistoryMessage] = Field(default_factory=list)
    stats:         UsageStats    = Field(default_factory=UsageStats)
