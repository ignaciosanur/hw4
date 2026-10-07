"""Make the course test account usable with this app's auth.

The seed database stores the test user with a legacy hash format this app cannot verify
(by design — see output/harness.md §6). This re-registers that one account with the
known development password, in our PBKDF2 format, so login can be demonstrated.

Idempotent and dev-only: it touches exactly the test account and nothing else. The
database is git-ignored, so this never affects the submitted repository.

    .venv/bin/python seed_dev_user.py
"""
import sqlite3
from pathlib import Path

from backend import security

TEST_EMAIL = "test@campuscustoms.yale.edu"
TEST_PASSWORD = "password"  # supplied by the assignment for the test fixture

db = Path(__file__).resolve().parent / "data" / "campus_customs.db"
conn = sqlite3.connect(db)
row = conn.execute("SELECT id, password_hash FROM users WHERE email = ?", (TEST_EMAIL,)).fetchone()
if row is None:
    raise SystemExit(f"{TEST_EMAIL} not found; is the seed database in place?")

if security.verify_password(TEST_PASSWORD, row[1]):
    print(f"{TEST_EMAIL} already logs in with this app's format — nothing to do.")
else:
    conn.execute("UPDATE users SET password_hash = ? WHERE email = ?",
                 (security.hash_password(TEST_PASSWORD), TEST_EMAIL))
    conn.commit()
    print(f"Re-registered {TEST_EMAIL} with the app's PBKDF2 format (password unchanged).")
conn.close()
