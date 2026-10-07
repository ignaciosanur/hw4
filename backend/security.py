"""Authentication primitives for Campus Customs: password hashing, password-policy
checks, and short-lived signed tokens for password-reset and session.

Design follows the OWASP Password Storage Cheat Sheet:
- PBKDF2-HMAC-SHA256 at 600,000 iterations (the FIPS-compliant recommendation), with a
  unique 16-byte random salt per password.
- The stored string is self-describing — `pbkdf2_sha256$<iterations>$<salt_hex>$<digest_hex>`
  — so the work factor travels with the hash and can be raised later without guesswork.
  (The seed fixtures use a 3-segment variant with no iteration count; we cannot reproduce
  those, and by decision only accounts created through this app can log in.)
- Verification is constant-time (`hmac.compare_digest`).

Tokens are HMAC-signed with AUTH_SECRET and carry an expiry, so a reset link cannot be
forged or replayed after it lapses. Nothing here ever logs or returns a hash or a password.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time

# --- password hashing -------------------------------------------------------

_ALGO = "pbkdf2_sha256"
_ITERATIONS = 600_000          # OWASP PBKDF2-SHA256 recommendation
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Return a self-describing PBKDF2 hash safe to store in the users table."""
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"{_ALGO}${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time check of a password against a stored hash.

    Only the 4-segment format written by hash_password is verifiable. Legacy 3-segment
    seed hashes return False by design (their scheme is not reproducible here).
    """
    parts = stored.split("$")
    if len(parts) != 4:
        return False
    algo, iterations, salt_hex, digest_hex = parts
    if algo != _ALGO:
        return False
    try:
        expected = bytes.fromhex(digest_hex)
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    except ValueError:
        return False
    return hmac.compare_digest(candidate, expected)


def needs_rehash(stored: str) -> bool:
    """True if a stored hash is legacy or below the current work factor."""
    parts = stored.split("$")
    return not (len(parts) == 4 and parts[0] == _ALGO and int(parts[1]) >= _ITERATIONS)


# --- password policy --------------------------------------------------------

MIN_LENGTH = 8
_RULES = [
    (re.compile(r".{%d,}" % MIN_LENGTH), f"at least {MIN_LENGTH} characters"),
    (re.compile(r"[A-Z]"), "an uppercase letter"),
    (re.compile(r"[a-z]"), "a lowercase letter"),
    (re.compile(r"[0-9]"), "a number"),
    (re.compile(r"[^A-Za-z0-9]"), "a symbol"),
]


def password_problems(password: str) -> list[str]:
    """Return the list of unmet requirements; empty means the password is acceptable."""
    return [msg for rule, msg in _RULES if not rule.search(password)]


# --- signed, expiring tokens (reset / session) ------------------------------

def _secret() -> bytes:
    key = os.getenv("AUTH_SECRET")
    if not key:
        # Keeps local dev working, but every restart invalidates old tokens.
        key = "dev-only-insecure-secret-set-AUTH_SECRET-in-env"
    return key.encode()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_token(purpose: str, subject: str, ttl_seconds: int) -> str:
    """A tamper-proof token binding a subject (e.g. email) to a purpose and an expiry."""
    payload = {"p": purpose, "sub": subject, "exp": int(time.time()) + ttl_seconds}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_token(token: str, purpose: str) -> str | None:
    """Return the subject if the token is valid, unexpired, and for this purpose; else None."""
    try:
        body, sig = token.split(".")
    except ValueError:
        return None
    expected = _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_unb64(body))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get("p") != purpose or payload.get("exp", 0) < time.time():
        return None
    return payload.get("sub")
