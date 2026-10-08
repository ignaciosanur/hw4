"""Append-only audit trail for the agent loop.

Writes one JSON object per agent run to output/audit_trail.json, as newline-delimited JSON
(JSONL): the file is only ever appended to, never rewritten or wiped, so the trail survives
across runs and restarts. Each line records the time, which tools ran with short args and
results, why the loop stopped, and token usage — the "audit trail" leg of the Lecture 4
agent harness (tools, memory, stopping rules, guardrails, audit trail).

Logged activity is shopping activity. Messages are truncated and we record auth state as
"guest" or a user id, never the email, password, or full chat content.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

AUDIT_PATH = Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"
_MAX = 200  # chars to keep for any one arg/result/message field


def _short(value: object) -> str:
    text = value if isinstance(value, str) else json.dumps(value, default=str)
    text = " ".join(text.split())
    return text if len(text) <= _MAX else text[:_MAX] + "…"


def log_run(record: dict) -> None:
    """Append one run record as a JSON line. Best-effort: auditing must never break chat."""
    try:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), **record}
        with AUDIT_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, default=str) + "\n")
    except Exception:
        pass


def extract_tool_calls(messages: list) -> list[dict]:
    """Pull (tool, args, result) triples from a PydanticAI message history, in order.

    Tolerant of version differences: it reads parts by attribute rather than exact type."""
    calls: list[dict] = []
    returns: dict[str, str] = {}
    for msg in messages:
        for part in getattr(msg, "parts", []):
            kind = getattr(part, "part_kind", "")
            name = getattr(part, "tool_name", None)
            if kind == "tool-call" or (name and hasattr(part, "args")):
                calls.append({"tool": name, "args": _short(getattr(part, "args", "")), "result": None})
            elif kind == "tool-return" or (name and hasattr(part, "content")):
                returns.setdefault(name, _short(getattr(part, "content", "")))
    # Attach the first matching return to each call by tool name.
    seen: dict[str, int] = {}
    for c in calls:
        tool = c["tool"]
        if tool in returns:
            c["result"] = returns[tool]
        seen[tool] = seen.get(tool, 0) + 1
    return calls
