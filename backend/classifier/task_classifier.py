"""
classifier/task_classifier.py
------------------------------
Velora Task Classifier — routes prompts to the right AI agent.

Task types:
    "backend"     → Claude (APIs, logic, databases, code)
    "frontend"    → Stitch (UI, components, design)
    "explanation" → GPT-4 (questions, explanations, concepts)
    "full"        → All agents (full-stack features)
"""

import re
from dataclasses import dataclass
from typing import Optional

from config import (
    BACKEND_KEYWORDS,
    FRONTEND_KEYWORDS,
    EXPLANATION_KEYWORDS,
)


@dataclass
class ClassificationResult:
    task_type:     str
    confidence:    float
    scores:        dict[str, int]
    matched_words: dict[str, list[str]]
    reason:        str


def _tokenize(prompt: str) -> list[str]:
    text = prompt.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return [word for word in text.split() if word]


def _extract_phrases(prompt: str) -> list[str]:
    tokens = _tokenize(prompt)
    phrases = tokens.copy()
    for i in range(len(tokens) - 1):
        phrases.append(f"{tokens[i]} {tokens[i+1]}")
    return phrases


def _score_prompt(prompt: str) -> tuple[dict[str, int], dict[str, list[str]]]:
    phrases = _extract_phrases(prompt)
    phrase_set = set(phrases)

    scores: dict[str, int] = {"backend": 0, "frontend": 0, "explanation": 0}
    matched: dict[str, list[str]] = {"backend": [], "frontend": [], "explanation": []}

    for word in phrase_set:
        if word in BACKEND_KEYWORDS:
            scores["backend"] += 1
            matched["backend"].append(word)
    for word in phrase_set:
        if word in FRONTEND_KEYWORDS:
            scores["frontend"] += 1
            matched["frontend"].append(word)
    for phrase in phrase_set:
        if phrase in EXPLANATION_KEYWORDS:
            scores["explanation"] += 1
            matched["explanation"].append(phrase)

    return scores, matched


def _compute_confidence(scores: dict[str, int], winner: str) -> float:
    winner_score = scores[winner]
    total = sum(scores.values())
    if total == 0:
        return 0.30
    if winner_score >= 4:
        confidence = 0.90
    elif winner_score >= 2:
        confidence = 0.75
    elif winner_score == 1:
        confidence = 0.55
    else:
        confidence = 0.30
    other_scores = [v for k, v in scores.items() if k != winner]
    runner_up = max(other_scores) if other_scores else 0
    if runner_up >= winner_score - 1 and runner_up > 0:
        confidence -= 0.15
    return round(max(0.0, min(1.0, confidence)), 2)


def classify_task(prompt: str) -> ClassificationResult:
    """Classify a user prompt into a task type for intelligent routing."""
    if not prompt or not prompt.strip():
        return ClassificationResult(
            task_type="explanation",
            confidence=0.30,
            scores={"backend": 0, "frontend": 0, "explanation": 0},
            matched_words={"backend": [], "frontend": [], "explanation": []},
            reason="[ GPT ORCHESTRATOR ] Empty prompt — defaulting to GPT explanation",
        )

    # ── PROJECT BUILD SHORTCUT: "Build/Create/Make a X" → full 3-model workflow ──
    _BUILD_PATTERN = re.compile(
        r"^(build|create|make|generate|develop|design|launch|start|set up|setup)\s+"
        r"(a |an |my |the )?(.+)",
        re.IGNORECASE,
    )
    if _BUILD_PATTERN.match(prompt.strip()):
        return ClassificationResult(
            task_type="full",
            confidence=0.97,
            scores={"backend": 5, "frontend": 4, "explanation": 3},
            matched_words={"backend": ["build", "create"], "frontend": ["ui", "design"], "explanation": ["architecture"]},
            reason="[ GPT ORCHESTRATOR ] Project build request detected → Deploying all 3 AI models (Claude + Gemini + GPT)",
        )

    scores, matched = _score_prompt(prompt)
    b = scores["backend"]
    f = scores["frontend"]
    e = scores["explanation"]

    # Question pattern override
    _Q = re.compile(
        r"^(what|how|why|when|where|who|is |are |does |do |can |could |should |"
        r"explain|tell me|describe|define|difference between|compare)",
        re.IGNORECASE,
    )
    if _Q.match(prompt.strip()):
        return ClassificationResult(
            task_type="explanation",
            confidence=0.90,
            scores=scores,
            matched_words=matched,
            reason="[ GPT ORCHESTRATOR ] Question detected → Routing to GPT for explanation & analysis",
        )

    # FULL: both backend AND frontend strongly signalled
    if b >= 2 and f >= 2:
        avg_score = (b + f) // 2
        confidence = _compute_confidence({"backend": avg_score, "frontend": 0, "explanation": 0}, "backend")
        return ClassificationResult(
            task_type="full",
            confidence=confidence,
            scores=scores,
            matched_words=matched,
            reason="[ GPT ORCHESTRATOR ] Full-stack task → Deploying Claude (Backend) + Gemini (Frontend) + GPT (Orchestration)",
        )

    # BACKEND wins
    if b > f and b > e:
        return ClassificationResult(
            task_type="backend",
            confidence=_compute_confidence(scores, "backend"),
            scores=scores,
            matched_words=matched,
            reason="[ GPT ORCHESTRATOR ] Backend task → Routing to Claude for backend engineering",
        )

    # FRONTEND wins
    if f > b and f > e:
        return ClassificationResult(
            task_type="frontend",
            confidence=_compute_confidence(scores, "frontend"),
            scores=scores,
            matched_words=matched,
            reason="[ GPT ORCHESTRATOR ] Frontend task → Routing to Gemini for UI/UX engineering",
        )

    # EXPLANATION wins OR tie
    if e >= b and e >= f:
        return ClassificationResult(
            task_type="explanation",
            confidence=_compute_confidence(scores, "explanation"),
            scores=scores,
            matched_words=matched,
            reason="[ GPT ORCHESTRATOR ] Explanation task → Routing to GPT for analysis & coordination",
        )

    return ClassificationResult(
        task_type="explanation",
        confidence=0.30,
        scores=scores,
        matched_words=matched,
        reason="[Router] No clear signal — defaulting to GPT-4",
    )


def classify_many(prompts: list[str]) -> list[ClassificationResult]:
    return [classify_task(p) for p in prompts]
