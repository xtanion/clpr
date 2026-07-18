"""Postgres access: connection pool, schema init, and per-user state persistence.

User state is spread across normalized tables (entries, progress, attempts,
ledger, comments, user_artifacts, users.start_date) but the public interface
still speaks the `State` document shape (load/save/mutate a dict), so the API
handlers and grading stay unchanged.
"""

from __future__ import annotations

import copy
import hashlib
import os
import re
import secrets
from typing import Any, Callable, Optional

from psycopg_pool import ConnectionPool

from .schema import DDL

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://clpr:clpr@localhost:5432/clpr"
)

EMPTY: dict[str, Any] = {
    "entries": {},
    "progress": {},
    "startDate": "",
    "attempts": [],
    "ledger": [],
    "comments": {},
    "artifacts": [],
}

_PROGRESS_KEY = re.compile(r"^s(\d+)t(\d+)$")

_pool: Optional[ConnectionPool] = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=10, open=True)
    return _pool


def init_schema() -> None:
    with pool().connection() as conn:
        conn.execute(DDL)


def _empty() -> dict[str, Any]:
    return copy.deepcopy(EMPTY)


def _normalize(doc: dict[str, Any]) -> dict[str, Any]:
    return {**EMPTY, **doc}


# --------------------------- read/write within a connection ---------------------------

def _read(conn, user: str) -> dict[str, Any]:
    doc = _empty()

    row = conn.execute("SELECT start_date FROM users WHERE id = %s", (user,)).fetchone()
    doc["startDate"] = row[0] if row else ""

    for date, focus, conf, mins, summary, notes in conn.execute(
        "SELECT date, focus, conf, mins, summary, notes FROM entries WHERE user_id = %s", (user,)
    ):
        doc["entries"][date] = {"focus": focus, "conf": conf, "mins": mins, "summary": summary, "notes": notes}

    for stage, topic in conn.execute(
        "SELECT stage, topic FROM progress WHERE user_id = %s", (user,)
    ):
        doc["progress"][f"s{stage}t{topic}"] = True

    for aid, stage, score, passed, time_ms, xp, first_clear, at in conn.execute(
        "SELECT id, stage, score, passed, time_ms, xp, first_clear, at "
        "FROM attempts WHERE user_id = %s ORDER BY id", (user,)
    ):
        doc["attempts"].append({
            "id": aid, "stage": stage, "score": score, "passed": passed,
            "timeMs": time_ms, "xp": xp, "firstClear": first_clear, "at": at,
        })

    for source, xp, at in conn.execute(
        "SELECT source, xp, at FROM ledger WHERE user_id = %s ORDER BY id", (user,)
    ):
        doc["ledger"].append({"source": source, "xp": xp, "at": at})

    for cid, key, author, text, at in conn.execute(
        "SELECT id, key, author, text, at FROM comments WHERE user_id = %s ORDER BY id", (user,)
    ):
        doc["comments"].setdefault(key, []).append({"id": cid, "author": author, "text": text, "at": at})

    for (artifact_id,) in conn.execute(
        "SELECT artifact_id FROM user_artifacts WHERE user_id = %s ORDER BY artifact_id", (user,)
    ):
        doc["artifacts"].append(artifact_id)

    return doc


def _write(conn, user: str, doc: dict[str, Any]) -> None:
    doc = _normalize(doc)

    conn.execute(
        "INSERT INTO users (id, start_date) VALUES (%s, %s) "
        "ON CONFLICT (id) DO UPDATE SET start_date = EXCLUDED.start_date",
        (user, doc.get("startDate", "")),
    )

    for tbl in ("entries", "progress", "attempts", "ledger", "comments", "user_artifacts"):
        conn.execute(f"DELETE FROM {tbl} WHERE user_id = %s", (user,))

    for date, e in doc["entries"].items():
        conn.execute(
            "INSERT INTO entries (user_id, date, focus, conf, mins, summary, notes) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (user, date, e.get("focus", 0), e.get("conf", 0), e.get("mins", ""), e.get("summary", ""), e.get("notes", "")),
        )

    for key, on in doc["progress"].items():
        if not on:
            continue
        m = _PROGRESS_KEY.match(key)
        if not m:
            continue
        conn.execute(
            "INSERT INTO progress (user_id, stage, topic) VALUES (%s, %s, %s)",
            (user, int(m.group(1)), int(m.group(2))),
        )

    for a in doc["attempts"]:
        conn.execute(
            "INSERT INTO attempts (id, user_id, stage, score, passed, time_ms, xp, first_clear, at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (a["id"], user, a["stage"], a["score"], a["passed"], a.get("timeMs", 0), a.get("xp", 0), a.get("firstClear", False), a["at"]),
        )

    for r in doc["ledger"]:
        conn.execute(
            "INSERT INTO ledger (user_id, source, xp, at) VALUES (%s, %s, %s, %s)",
            (user, r["source"], r["xp"], r["at"]),
        )

    for key, items in doc["comments"].items():
        for c in items:
            conn.execute(
                "INSERT INTO comments (id, user_id, key, author, text, at) VALUES (%s, %s, %s, %s, %s, %s)",
                (c["id"], user, key, c.get("author", "you"), c["text"], c["at"]),
            )

    for artifact_id in doc["artifacts"]:
        conn.execute(
            "INSERT INTO user_artifacts (user_id, artifact_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (user, artifact_id),
        )


# --------------------------- public interface (State documents) ---------------------------

def upsert_user(
    user: str, email: str, name: str, username: str, avatar_url: str, provider: str, now: str
) -> None:
    """Create or refresh a user's profile on sign-in. Never touches learning state:
    on conflict only the profile columns are updated, start_date/entries/etc. stay."""
    with pool().connection() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO users (id, email, name, username, avatar_url, provider, created_at) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) "
                "ON CONFLICT (id) DO UPDATE SET "
                "email = EXCLUDED.email, name = EXCLUDED.name, username = EXCLUDED.username, "
                "avatar_url = EXCLUDED.avatar_url, provider = EXCLUDED.provider",
                (user, email, name, username, avatar_url, provider, now),
            )


def profile(user: str) -> Optional[dict[str, Any]]:
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, email, name, username, avatar_url, provider FROM users WHERE id = %s",
            (user,),
        ).fetchone()
    if not row:
        return None
    return {"id": row[0], "email": row[1], "name": row[2], "username": row[3],
            "avatarUrl": row[4], "provider": row[5]}


def public_garage(username: str) -> Optional[dict[str, Any]]:
    """Public showcase view of a user's garage, looked up by username. Returns their
    profile plus a sanitized state: progress/attempts/xp/artifacts/check-in cadence
    are public, but the personal journal (entry notes/summaries) and comment threads
    are stripped. Only real (OAuth) users are exposed. None if the username is unknown.

    Username is not unique-constrained, so a collision resolves to the earliest
    account; usernames come from the OAuth provider (email prefix / github login)."""
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT id, name, username, avatar_url, provider FROM users "
            "WHERE username = %s AND provider IN ('google', 'github') "
            "ORDER BY created_at LIMIT 1",
            (username,),
        ).fetchone()
        if not row:
            return None
        doc = _read(conn, row[0])

    for e in doc["entries"].values():
        e["notes"] = ""
        e["summary"] = ""
    doc["comments"] = {}

    profile = {"name": row[1], "username": row[2], "avatarUrl": row[3], "provider": row[4]}
    return {"profile": profile, "state": doc}


def leaderboard_data() -> list[dict[str, Any]]:
    """Per real (OAuth) user, the raw inputs the leaderboard ranks on: profile plus the
    components XP is derived from — topics completed, stages cleared, and days with a
    written note — and check-in dates for streaks. Aggregated in grouped queries rather
    than loading each user's full state."""
    with pool().connection() as conn:
        users = conn.execute(
            "SELECT id, name, username, avatar_url FROM users WHERE provider IN ('google', 'github')"
        ).fetchall()
        prog_rows = conn.execute("SELECT user_id, stage, topic FROM progress").fetchall()
        att_rows = conn.execute("SELECT user_id, stage FROM attempts WHERE passed = TRUE").fetchall()
        ent_rows = conn.execute("SELECT user_id, date, summary FROM entries").fetchall()

    progress: dict[str, dict[str, bool]] = {}
    for uid, stage, topic in prog_rows:
        progress.setdefault(uid, {})[f"s{stage}t{topic}"] = True
    passed: dict[str, list[int]] = {}
    for uid, stage in att_rows:
        passed.setdefault(uid, []).append(stage)
    entries: dict[str, dict[str, bool]] = {}
    noted: dict[str, int] = {}
    for uid, dt, summary in ent_rows:
        entries.setdefault(uid, {})[dt] = True
        if (summary or "").strip():
            noted[uid] = noted.get(uid, 0) + 1

    return [
        {
            "id": uid, "name": name, "username": username, "avatarUrl": avatar,
            "progress": progress.get(uid, {}),
            "passedStages": passed.get(uid, []),
            "entries": entries.get(uid, {}),
            "notedDays": noted.get(uid, 0),
        }
        for uid, name, username, avatar in users
    ]


def races_data() -> list[dict[str, Any]]:
    """Each real user's best passing attempt per stage (highest score, then fastest),
    for the per-topic race boards. DISTINCT ON keeps one row per (user, stage)."""
    with pool().connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT ON (a.user_id, a.stage) "
            "a.user_id, a.stage, a.time_ms, a.score, u.name, u.username "
            "FROM attempts a JOIN users u ON u.id = a.user_id "
            "WHERE a.passed = TRUE AND u.provider IN ('google', 'github') "
            "ORDER BY a.user_id, a.stage, a.score DESC, a.time_ms ASC"
        ).fetchall()
    return [
        {"id": uid, "stage": stage, "ms": ms, "score": score, "name": name, "username": username}
        for uid, stage, ms, score, name, username in rows
    ]


# --------------------------- headless auth (device flow + tokens) ---------------------------

def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_device_code(user_code: str, created_at: str, expires_at: str) -> str:
    """Open a pending device-authorization request and return its device_code."""
    device_code = secrets.token_urlsafe(32)
    with pool().connection() as conn:
        conn.execute(
            "INSERT INTO device_codes (device_code, user_code, status, created_at, expires_at) "
            "VALUES (%s, %s, 'pending', %s, %s)",
            (device_code, user_code, created_at, expires_at),
        )
    return device_code


def get_device_code(device_code: str) -> Optional[dict[str, Any]]:
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT device_code, user_code, uid, status, created_at, expires_at "
            "FROM device_codes WHERE device_code = %s",
            (device_code,),
        ).fetchone()
    if not row:
        return None
    return {"device_code": row[0], "user_code": row[1], "uid": row[2],
            "status": row[3], "created_at": row[4], "expires_at": row[5]}


def get_device_code_by_user_code(user_code: str) -> Optional[dict[str, Any]]:
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT device_code, user_code, uid, status, created_at, expires_at "
            "FROM device_codes WHERE user_code = %s ORDER BY created_at DESC LIMIT 1",
            (user_code,),
        ).fetchone()
    if not row:
        return None
    return {"device_code": row[0], "user_code": row[1], "uid": row[2],
            "status": row[3], "created_at": row[4], "expires_at": row[5]}


def approve_device_code(user_code: str, uid: str) -> bool:
    """Bind a signed-in user to a pending code (browser approval step). Returns
    False if no pending code matches (unknown/already handled)."""
    with pool().connection() as conn:
        with conn.transaction():
            cur = conn.execute(
                "UPDATE device_codes SET status = 'approved', uid = %s "
                "WHERE user_code = %s AND status = 'pending'",
                (uid, user_code),
            )
            return cur.rowcount > 0


def mint_token(uid: str, label: str, now: str) -> str:
    """Create a personal bearer token for uid, store only its hash, return the
    raw token once (never recoverable afterwards)."""
    raw = secrets.token_urlsafe(32)
    with pool().connection() as conn:
        conn.execute(
            "INSERT INTO personal_tokens (token_hash, uid, label, created_at) "
            "VALUES (%s, %s, %s, %s)",
            (_token_hash(raw), uid, label, now),
        )
    return raw


def consume_device_code(device_code: str, now: str) -> Optional[str]:
    """Exchange an approved code for a fresh token, marking it consumed so it can
    only be redeemed once. Returns the raw token, or None if not approvable."""
    with pool().connection() as conn:
        with conn.transaction():
            row = conn.execute(
                "SELECT uid FROM device_codes WHERE device_code = %s AND status = 'approved' FOR UPDATE",
                (device_code,),
            ).fetchone()
            if not row or not row[0]:
                return None
            uid = row[0]
            raw = secrets.token_urlsafe(32)
            conn.execute(
                "INSERT INTO personal_tokens (token_hash, uid, label, created_at) "
                "VALUES (%s, %s, %s, %s)",
                (_token_hash(raw), uid, "clpr cli", now),
            )
            conn.execute(
                "UPDATE device_codes SET status = 'consumed' WHERE device_code = %s",
                (device_code,),
            )
    return raw


def uid_for_token(raw: str, now: str) -> Optional[str]:
    """Resolve a bearer token to its user id, touching last_used_at. None if unknown."""
    if not raw:
        return None
    with pool().connection() as conn:
        row = conn.execute(
            "SELECT uid FROM personal_tokens WHERE token_hash = %s", (_token_hash(raw),)
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE personal_tokens SET last_used_at = %s WHERE token_hash = %s",
            (now, _token_hash(raw)),
        )
    return row[0]


def revoke_token(raw: str) -> None:
    with pool().connection() as conn:
        conn.execute("DELETE FROM personal_tokens WHERE token_hash = %s", (_token_hash(raw),))


def load(user: str) -> dict[str, Any]:
    with pool().connection() as conn:
        return _read(conn, user)


def save(user: str, doc: dict[str, Any]) -> dict[str, Any]:
    with pool().connection() as conn:
        with conn.transaction():
            _write(conn, user, doc)
    return _normalize(doc)


def reset(user: str) -> dict[str, Any]:
    return save(user, _empty())


def mutate(user: str, fn: Callable[[dict[str, Any]], Any]) -> dict[str, Any]:
    """Read the user's state, apply fn(doc) in place (or return a new doc), and
    persist, all in one transaction with the user row locked to serialize writes."""
    with pool().connection() as conn:
        with conn.transaction():
            conn.execute(
                "INSERT INTO users (id) VALUES (%s) ON CONFLICT (id) DO NOTHING", (user,)
            )
            conn.execute("SELECT 1 FROM users WHERE id = %s FOR UPDATE", (user,))
            doc = _read(conn, user)
            result = fn(doc)
            if result is not None:
                doc = result
            _write(conn, user, doc)
    return _normalize(doc)
