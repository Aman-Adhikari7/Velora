"""
agents/test_claude_agent.py
----------------------------
Tests for the Claude agent — two modes:

MODE 1 — DRY RUN (default, no API key needed):
    Validates all logic EXCEPT the actual API call:
        - System prompt builds correctly with memory context
        - Token savings estimation works
        - Error handling for missing API key
        - AgentResult shape is correct

MODE 2 — LIVE RUN (requires ANTHROPIC_API_KEY in .env):
    Makes a real API call and prints Claude's response.
    Run with: python -m agents.test_claude_agent --live

Usage:
    cd ai-orchestrator
    python -m agents.test_claude_agent           # dry run
    python -m agents.test_claude_agent --live    # real API call
"""

import sys
import asyncio

# ── Mock setup (so tests run without installing packages) ──────────────────────
import types

# Mock pydantic-dependent modules
config_mock = types.ModuleType("config")
config_mock.ANTHROPIC_API_KEY = ""   # empty by default for dry run
config_mock.CLAUDE_MODEL = "claude-sonnet-4-20250514"
config_mock.MEMORY_DIR = "memory/store"
config_mock.MAX_HISTORY = 20
config_mock.BACKEND_KEYWORDS = set()
config_mock.FRONTEND_KEYWORDS = set()
config_mock.EXPLANATION_KEYWORDS = set()
sys.modules.setdefault("config", config_mock)

# Minimal Pydantic-free memory stubs
class _ContextBlock:
    def __init__(self):
        self.backend = None
        self.frontend = None
        self.explanation = None

class _HistoryMsg:
    def __init__(self, content):
        self.content = content

class _Stats:
    def __init__(self):
        self.total_prompts = 0
        self.claude_calls = 0
        self.gpt_calls = 0
        self.frontend_calls = 0
        self.tokens_saved = 0

class _UserMemory:
    def __init__(self, user_id="test_user"):
        self.user_id = user_id
        self.project_goal = None
        self.context = _ContextBlock()
        self.history = []
        self.stats = _Stats()

# Inject memory stubs
mem_schema = types.ModuleType("memory.schema")
mem_schema.UserMemory = _UserMemory
sys.modules["memory.schema"] = mem_schema

def _build_context_summary(memory):
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

mem_manager = types.ModuleType("memory.manager")
mem_manager.build_context_summary = _build_context_summary
sys.modules["memory.manager"] = mem_manager

# ── Now import the real agent ──────────────────────────────────────────────────
from agents.claude_agent import (
    run_claude_agent,
    _build_system_prompt,
    _estimate_tokens_saved,
    AgentResult,
)

# ── Colors ─────────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
CYAN   = "\033[96m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"


# ── Dry run tests ──────────────────────────────────────────────────────────────

def test_system_prompt_empty_memory():
    memory = _UserMemory()
    prompt = _build_system_prompt(memory)
    assert "senior backend engineer" in prompt
    assert "No prior context" in prompt
    print(f"{GREEN}✓{RESET} System prompt builds correctly with empty memory")

def test_system_prompt_with_context():
    memory = _UserMemory()
    memory.project_goal = "Build a task manager API"
    memory.context.backend = "FastAPI app with /tasks endpoint"
    memory.context.frontend = "React TaskList component"
    prompt = _build_system_prompt(memory)
    assert "Build a task manager API" in prompt
    assert "FastAPI app with /tasks endpoint" in prompt
    assert "React TaskList component" in prompt
    print(f"{GREEN}✓{RESET} System prompt injects memory context correctly")

def test_token_savings_empty_history():
    memory = _UserMemory()
    saved = _estimate_tokens_saved(memory)
    assert saved == 0
    print(f"{GREEN}✓{RESET} Token savings = 0 for empty history")

def test_token_savings_with_history():
    memory = _UserMemory()
    memory.project_goal = "Build login API"
    # Simulate long history
    memory.history = [_HistoryMsg("x" * 500) for _ in range(10)]  # 5000 chars
    memory.context.backend = "Short summary"
    saved = _estimate_tokens_saved(memory)
    assert saved > 0, "Should save tokens when history is long"
    print(f"{GREEN}✓{RESET} Token savings > 0 with long history (saved ~{saved} tokens)")

async def test_missing_api_key():
    import sys
    sys.modules["config"].ANTHROPIC_API_KEY = ""
    memory = _UserMemory()
    result = await run_claude_agent("Build a login endpoint", memory)
    assert result.success == False
    assert "ANTHROPIC_API_KEY" in result.error
    assert result.model == "claude-sonnet-4-20250514"
    print(f"{GREEN}✓{RESET} Missing API key returns AgentResult(success=False) gracefully")

def test_agent_result_shape():
    result = AgentResult(
        success=True,
        output="Here is your FastAPI code...",
        model="claude-sonnet-4-20250514",
        tokens_saved=120,
    )
    assert result.success == True
    assert result.tokens_saved == 120
    assert result.error is None
    print(f"{GREEN}✓{RESET} AgentResult dataclass shape is correct")


async def run_dry_tests():
    print(f"\n{BOLD}{'='*60}")
    print(f"  CLAUDE AGENT — DRY RUN TESTS (no API key needed)")
    print(f"{'='*60}{RESET}\n")

    test_system_prompt_empty_memory()
    test_system_prompt_with_context()
    test_token_savings_empty_history()
    test_token_savings_with_history()
    await test_missing_api_key()
    test_agent_result_shape()

    print(f"\n{GREEN}{BOLD}All dry-run tests passed ✓{RESET}")
    print(f"\n{YELLOW}Tip: Run with --live flag to make a real API call{RESET}\n")


# ── Live run test ──────────────────────────────────────────────────────────────

async def run_live_test():
    import os
    from dotenv import load_dotenv
    load_dotenv()

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        print(f"{RED}✗ No ANTHROPIC_API_KEY found in .env — cannot run live test{RESET}")
        return

    # Patch the key into our mock config
    sys.modules["config"].ANTHROPIC_API_KEY = api_key

    print(f"\n{BOLD}{'='*60}")
    print(f"  CLAUDE AGENT — LIVE API TEST")
    print(f"{'='*60}{RESET}\n")

    # Build a memory object with some context
    memory = _UserMemory(user_id="test_live")
    memory.project_goal = "Build a task manager REST API"
    memory.context.explanation = "Tasks have: id, title, description, status (todo/done), created_at"

    prompt = "Create a FastAPI POST /tasks endpoint that creates a new task. Include the Pydantic model and input validation."

    print(f"{CYAN}Prompt:{RESET} {prompt}")
    print(f"{CYAN}Memory context:{RESET} project_goal='{memory.project_goal}'")
    print(f"\n{YELLOW}Calling Claude API...{RESET}\n")

    result = await run_claude_agent(prompt=prompt, memory=memory)

    if result.success:
        print(f"{GREEN}✓ Claude responded successfully{RESET}")
        print(f"  Model        : {result.model}")
        print(f"  Tokens saved : ~{result.tokens_saved}")
        print(f"\n{BOLD}── Claude's Output ──────────────────────────────────────{RESET}")
        print(result.output[:1500])
        if len(result.output) > 1500:
            print(f"\n{YELLOW}... (truncated, full output is {len(result.output)} chars){RESET}")
    else:
        print(f"{RED}✗ Agent failed: {result.error}{RESET}")


# ── Entry point ────────────────────────────────────────────────────────────────

async def main():
    if "--live" in sys.argv:
        await run_live_test()
    else:
        await run_dry_tests()

if __name__ == "__main__":
    asyncio.run(main())
