"""
logger/workflow_logger.py
--------------------------
Velora structured workflow logger.
Logs every orchestration stage and decision to JSONL files.
"""

import os
import json
from datetime import datetime, date
from typing import Optional

from classifier.task_classifier import ClassificationResult
from agents.claude_agent import AgentResult

LOGS_DIR = "logs"
MAX_PROMPT_LOG_LENGTH = 200

STAGE_COLORS = {
    "running":  "🔄",
    "complete": "✅",
    "skipped":  "⏭️",
    "error":    "❌",
    "pending":  "⏳",
}


def _log_file_path() -> str:
    today = date.today().isoformat()
    return os.path.join(LOGS_DIR, f"workflow_{today}.jsonl")


def _ensure_logs_dir() -> None:
    os.makedirs(LOGS_DIR, exist_ok=True)


def log_stage(stage_name: str, status: str, detail: str = "") -> None:
    """
    Print a structured stage log to console.
    Used during sequential workflow execution for real-time visibility.
    """
    icon = STAGE_COLORS.get(status, "•")
    ts = datetime.utcnow().strftime("%H:%M:%S")
    line = f"[{ts}] {icon} [{stage_name}] {status.upper()}"
    if detail:
        line += f" — {detail}"
    print(line)


def _build_log_entry(
    user_id:          str,
    prompt:           str,
    classification:   Optional[ClassificationResult],
    primary_result:   AgentResult,
    secondary_result: Optional[AgentResult],
    elapsed_ms:       float,
) -> dict:
    prompt_preview = prompt[:MAX_PROMPT_LOG_LENGTH]
    if len(prompt) > MAX_PROMPT_LOG_LENGTH:
        prompt_preview += "..."

    agents_called = []
    if classification:
        if classification.task_type in ("backend", "full"):
            agents_called.append("claude")
        if classification.task_type in ("explanation", "full"):
            agents_called.append("gpt-4")
        if classification.task_type == "frontend":
            agents_called.append("stitch")

    model_used = primary_result.model
    if secondary_result:
        model_used = f"{primary_result.model} + {secondary_result.model}"

    total_tokens = primary_result.tokens_saved
    if secondary_result:
        total_tokens += secondary_result.tokens_saved

    return {
        "timestamp":   datetime.utcnow().isoformat(),
        "app":         "Velora",
        "user_id":     user_id,
        "prompt":      prompt_preview,
        "classification": {
            "task_type":     classification.task_type     if classification else "unknown",
            "confidence":    classification.confidence    if classification else 0.0,
            "scores":        classification.scores        if classification else {},
            "matched_words": classification.matched_words if classification else {},
            "reason":        classification.reason        if classification else "no classification",
        },
        "agents_called": agents_called,
        "primary": {
            "model":        primary_result.model,
            "success":      primary_result.success,
            "tokens_saved": primary_result.tokens_saved,
            "error":        primary_result.error,
        },
        "secondary": {
            "model":        secondary_result.model,
            "success":      secondary_result.success,
            "tokens_saved": secondary_result.tokens_saved,
            "error":        secondary_result.error,
        } if secondary_result else None,
        "model_used":   model_used,
        "success":      primary_result.success,
        "tokens_saved": total_tokens,
        "elapsed_ms":   round(elapsed_ms, 2),
    }


def _format_console_log(entry: dict) -> str:
    ts    = entry["timestamp"][11:19]
    uid   = entry["user_id"]
    ttype = entry["classification"]["task_type"]
    model = entry["model_used"]
    ok    = "✓" if entry["success"] else "✗"
    ms    = entry["elapsed_ms"]
    saved = entry["tokens_saved"]
    conf  = entry["classification"]["confidence"]
    line = f"[{ts}] {uid} | {ttype} (conf={conf}) | {model} | {ok} {ms}ms | saved {saved} tokens"
    if not entry["success"]:
        err = entry["primary"].get("error") or "unknown error"
        line += f"\n         ERROR: {err}"
    return line


def log_decision(
    user_id:          str,
    prompt:           str,
    classification:   Optional[ClassificationResult],
    primary_result:   AgentResult,
    secondary_result: Optional[AgentResult] = None,
    elapsed_ms:       float = 0.0,
) -> None:
    try:
        _ensure_logs_dir()
        entry    = _build_log_entry(user_id, prompt, classification, primary_result, secondary_result, elapsed_ms)
        log_path = _log_file_path()
        log_line = json.dumps(entry, ensure_ascii=False)
        console  = _format_console_log(entry)
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")
        print(f"\n🔀 VELORA LOG: {console}")
    except Exception as e:
        print(f"[WARNING] workflow_logger failed silently: {e}")


def read_today_logs(limit: int = 50) -> list[dict]:
    log_path = _log_file_path()
    if not os.path.exists(log_path):
        return []
    entries = []
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except Exception:
        return []
    return list(reversed(entries))[-limit:]


def read_logs_summary() -> dict:
    entries = read_today_logs(limit=1000)
    if not entries:
        return {
            "date": date.today().isoformat(),
            "total_requests": 0,
            "success_rate": "N/A",
            "task_breakdown": {},
            "total_tokens_saved": 0,
            "models_used": {},
        }
    total = len(entries)
    successes = sum(1 for e in entries if e.get("success"))
    task_counts: dict[str, int] = {}
    model_counts: dict[str, int] = {}
    total_saved = 0
    for e in entries:
        ttype = e.get("classification", {}).get("task_type", "unknown")
        task_counts[ttype] = task_counts.get(ttype, 0) + 1
        model = e.get("model_used", "unknown")
        model_counts[model] = model_counts.get(model, 0) + 1
        total_saved += e.get("tokens_saved", 0)
    return {
        "date":               date.today().isoformat(),
        "total_requests":     total,
        "success_rate":       f"{round(successes / total * 100, 1)}%",
        "task_breakdown":     task_counts,
        "total_tokens_saved": total_saved,
        "models_used":        model_counts,
    }
