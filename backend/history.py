"""Customer chat memory — persistence for signed-in shoppers only.

PRIVACY (the "you can't sell them" mechanism, enforced in code, not just promised):
- Every function here is scoped to ONE owner and takes the authenticated user's id. There
  is deliberately no function that reads, lists, joins, or exports across users, and the
  HTTP layer never accepts a client-supplied user id — it uses the id from the verified
  session token. So there is no code path that can hand out or bulk-extract another
  customer's conversation; the data cannot be gathered up to be sold.
- A shopper can delete their own history (clear_history), so they control their data.
- The database itself is git-ignored, so chat content never leaves the machine via the repo.
Passwords are already stored only as hashes (backend/security.py); this module never
touches them.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from models import HistoryMessage, ProductCard

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "campus_customs.db"

# Stated once, in code, and referenced by the API and the agent prompt.
DATA_USE_POLICY = (
    "Campus Customs chat history is private to the account that created it. It is used only "
    "to continue that shopper's own conversation. It is never shared with other customers, "
    "exported in bulk, or sold."
)

MAX_HISTORY = 50  # most recent messages reloaded on return


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def save_turn(user_id: int, role: str, content: str,
              products: list[ProductCard] | None = None) -> None:
    """Append one message to a signed-in shopper's history. products (assistant turns) are
    stored as JSON, mirroring the seed chat_messages.products_json shape."""
    products_json = json.dumps([p.model_dump() for p in products]) if products else None
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, ?, ?, ?)",
            (user_id, role, content, products_json),
        )
        conn.commit()
    finally:
        conn.close()


def load_history(user_id: int, limit: int = MAX_HISTORY) -> list[HistoryMessage]:
    """The shopper's own most-recent messages, oldest-first. Scoped to user_id — there is
    no variant that spans users."""
    conn = _connect()
    try:
        rows = conn.execute(
            """SELECT role, content, created_at FROM chat_messages
               WHERE user_id = ? ORDER BY id DESC LIMIT ?""",
            (user_id, limit),
        ).fetchall()
    finally:
        conn.close()
    rows.reverse()
    return [HistoryMessage(role=r["role"], content=r["content"], created_at=r["created_at"]) for r in rows]


def clear_history(user_id: int) -> int:
    """Delete a shopper's own history. Returns how many messages were removed."""
    conn = _connect()
    try:
        cur = conn.execute("DELETE FROM chat_messages WHERE user_id = ?", (user_id,))
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()
