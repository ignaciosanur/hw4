"""Account endpoints for Campus Customs: register, login, forgot/reset password.

Writes new accounts to the `users` table. Passwords are stored only as PBKDF2 hashes
(see backend/security.py). Login is rate-limited to blunt online guessing; once an
account is locked the user is steered to a password reset, which also clears the lock.

No real mail server exists in this coursework build, so a reset link is returned to the
client and printed to the server console instead of emailed — clearly labelled as such.
"""

from __future__ import annotations

import os
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

import security

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "campus_customs.db"

router = APIRouter(prefix="/api/auth", tags=["auth"])


# --- models -----------------------------------------------------------------

class RegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    token: str
    password: str


class UserPublic(BaseModel):
    """Everything safe to send to the browser. Note: no password_hash — by type, it
    is impossible to serialize a hash through this model."""

    id: int
    first_name: str
    last_name: str
    email: str


class AuthResponse(BaseModel):
    user: UserPublic
    session_token: str


# --- database ---------------------------------------------------------------

def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _user_public(row: sqlite3.Row) -> UserPublic:
    return UserPublic(id=row["id"], first_name=row["first_name"] or "",
                      last_name=row["last_name"] or "", email=row["email"])


# --- login rate limiting ----------------------------------------------------

MAX_ATTEMPTS = 5          # consecutive failures before lockout
WINDOW_SECONDS = 15 * 60  # attempts older than this are forgotten
LOCKOUT_SECONDS = 15 * 60 # how long a lockout lasts


@dataclass
class _Attempts:
    failures: list[float] = field(default_factory=list)
    locked_until: float = 0.0


# Per-email, in-memory. Fine for a single-process coursework server; a real deployment
# would use a shared store (Redis) so the limit survives restarts and spans workers.
_attempts: dict[str, _Attempts] = {}


def _lock_state(email: str) -> _Attempts:
    return _attempts.setdefault(email.lower(), _Attempts())


def _seconds_locked(email: str) -> int:
    remaining = _lock_state(email).locked_until - time.time()
    return max(0, int(remaining))


def _record_failure(email: str) -> None:
    state = _lock_state(email)
    now = time.time()
    state.failures = [t for t in state.failures if now - t < WINDOW_SECONDS]
    state.failures.append(now)
    if len(state.failures) >= MAX_ATTEMPTS:
        state.locked_until = now + LOCKOUT_SECONDS
        state.failures.clear()


def _clear(email: str) -> None:
    _attempts.pop(email.lower(), None)


# --- endpoints --------------------------------------------------------------

@router.post("/register", response_model=AuthResponse, status_code=201)
def register(req: RegisterRequest) -> AuthResponse:
    problems = security.password_problems(req.password)
    if problems:
        raise HTTPException(422, detail="Password needs " + ", ".join(problems) + ".")

    email = req.email.lower().strip()
    conn = _connect()
    try:
        if conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
            raise HTTPException(409, detail="An account with this email already exists.")
        full_name = f"{req.first_name} {req.last_name}".strip()
        cur = conn.execute(
            """INSERT INTO users (name, email, password_hash, first_name, last_name)
               VALUES (?, ?, ?, ?, ?)""",
            (full_name, email, security.hash_password(req.password), req.first_name, req.last_name),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, first_name, last_name, email FROM users WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
    finally:
        conn.close()

    user = _user_public(row)
    return AuthResponse(user=user, session_token=security.make_token("session", email, 7 * 24 * 3600))


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest) -> AuthResponse:
    email = req.email.lower().strip()

    locked = _seconds_locked(email)
    if locked:
        raise HTTPException(
            429,
            detail=f"Too many failed attempts. Try again in {locked // 60 + 1} minute(s), "
                   "or reset your password to regain access now.",
        )

    conn = _connect()
    try:
        row = conn.execute(
            "SELECT id, first_name, last_name, email, password_hash FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    finally:
        conn.close()

    # One generic message whether the email is unknown or the password is wrong, so the
    # form does not reveal which emails have accounts.
    if row is None or not security.verify_password(req.password, row["password_hash"]):
        _record_failure(email)
        # If that failure tripped the lock, say so now rather than a misleading count.
        if _seconds_locked(email):
            raise HTTPException(
                429,
                detail="Too many failed attempts. Reset your password to regain access, "
                       "or try again in 15 minutes.",
            )
        remaining = MAX_ATTEMPTS - len(_lock_state(email).failures)
        hint = f" {remaining} attempt(s) left." if remaining > 0 else ""
        raise HTTPException(401, detail="Incorrect email or password." + hint)

    _clear(email)
    return AuthResponse(user=_user_public(row),
                        session_token=security.make_token("session", email, 7 * 24 * 3600))


@router.post("/forgot-password")
def forgot_password(req: ForgotRequest) -> dict:
    email = req.email.lower().strip()
    conn = _connect()
    try:
        exists = conn.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone()
    finally:
        conn.close()

    # The assignment asks to tell the user when no account matches, so this is explicit
    # rather than the usual privacy-preserving silence.
    if not exists:
        raise HTTPException(404, detail="No account is registered with that email.")

    token = security.make_token("reset", email, 3600)  # one hour
    base = os.getenv("FRONTEND_URL", "http://127.0.0.1:5183")
    reset_link = f"{base}/reset-password?token={token}"
    # Stands in for sending an email in this build.
    print(f"\n[password reset] for {email}:\n  {reset_link}\n")
    return {
        "message": "A reset link has been generated.",
        "email_simulated": True,
        "reset_link": reset_link,
    }


@router.post("/reset-password", response_model=AuthResponse)
def reset_password(req: ResetRequest) -> AuthResponse:
    email = security.read_token(req.token, "reset")
    if not email:
        raise HTTPException(400, detail="This reset link is invalid or has expired.")

    problems = security.password_problems(req.password)
    if problems:
        raise HTTPException(422, detail="Password needs " + ", ".join(problems) + ".")

    conn = _connect()
    try:
        row = conn.execute(
            "SELECT id, first_name, last_name, email FROM users WHERE email = ?", (email,)
        ).fetchone()
        if row is None:
            raise HTTPException(404, detail="No account is registered with that email.")
        conn.execute("UPDATE users SET password_hash = ? WHERE email = ?",
                     (security.hash_password(req.password), email))
        conn.commit()
    finally:
        conn.close()

    _clear(email)  # a successful reset clears any lockout
    return AuthResponse(user=_user_public(row),
                        session_token=security.make_token("session", email, 7 * 24 * 3600))
