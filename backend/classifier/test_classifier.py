"""
classifier/test_classifier.py
------------------------------
Run this to verify the classifier is working correctly.

Usage:
    cd ai-orchestrator
    python -m classifier.test_classifier

Expected output: all 12 tests pass with correct task_types printed.
"""

from classifier.task_classifier import classify_task, classify_many

# ── Color codes for terminal output ──────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"


def run_test(prompt: str, expected: str) -> bool:
    result = classify_task(prompt)
    passed = result.task_type == expected

    icon = f"{GREEN}✓{RESET}" if passed else f"{RED}✗{RESET}"
    color = GREEN if passed else RED

    print(f"\n{icon} [{color}{result.task_type.upper()}{RESET}] (confidence={result.confidence})")
    print(f"   Prompt   : \"{prompt}\"")
    print(f"   Expected : {expected}")
    print(f"   Scores   : backend={result.scores['backend']}, frontend={result.scores['frontend']}, explanation={result.scores['explanation']}")
    print(f"   Reason   : {result.reason}")

    return passed


def main():
    print(f"\n{BOLD}{'='*60}")
    print(f"  TASK CLASSIFIER — TEST SUITE")
    print(f"{'='*60}{RESET}\n")

    tests = [
        # ── Backend prompts ────────────────────────────────────────────
        ("Create a FastAPI endpoint for user authentication with JWT",         "backend"),
        ("Write a Python function to query the database and return user data", "backend"),
        ("Build a REST API with CRUD operations for a blog post model",        "backend"),
        ("Add middleware to validate JWT tokens on every route",               "backend"),

        # ── Frontend prompts ───────────────────────────────────────────
        ("Build a React dashboard with a sidebar and Tailwind CSS",            "frontend"),
        ("Create a responsive navbar component with a mobile menu button",     "frontend"),
        ("Design a login form with email and password fields",                 "frontend"),

        # ── Explanation prompts ────────────────────────────────────────
        ("What is JWT and why do we use it?",                                  "explanation"),
        ("Explain the difference between REST and GraphQL",                    "explanation"),
        ("How does OAuth 2.0 work?",                                           "explanation"),

        # ── Full stack prompts ─────────────────────────────────────────
        ("Build a full login system with a FastAPI backend and React frontend", "full"),
        ("Create a dashboard: Python API for data + React UI to display it",   "full"),
    ]

    passed = 0
    for prompt, expected in tests:
        if run_test(prompt, expected):
            passed += 1

    total = len(tests)
    print(f"\n{BOLD}{'='*60}")
    color = GREEN if passed == total else YELLOW
    print(f"  Results: {color}{passed}/{total} tests passed{RESET}{BOLD}")
    print(f"{'='*60}{RESET}\n")

    # ── Edge case demo ────────────────────────────────────────────────
    print(f"{CYAN}Edge case — empty prompt:{RESET}")
    r = classify_task("")
    print(f"  task_type={r.task_type}, confidence={r.confidence}, reason={r.reason}\n")

    print(f"{CYAN}Edge case — totally ambiguous prompt:{RESET}")
    r = classify_task("help me with my project")
    print(f"  task_type={r.task_type}, confidence={r.confidence}")
    print(f"  reason={r.reason}\n")


if __name__ == "__main__":
    main()
