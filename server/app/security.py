"""Cross-cutting request guards, wired as app-level FastAPI dependencies.

- require_api_key: a shared secret (BACKEND_API_KEY) that the frontend proxy injects
  as X-API-Key, so the public Render URL isn't callable by just anyone. Disabled when
  the env var is unset. /api/health is exempt (Render's health check hits it directly).
- rate_limit: a Redis fixed-window limiter, keyed by signed-in user or client IP.
  Fails open when Redis is unavailable.
"""

from __future__ import annotations

import os

from fastapi import HTTPException, Request

from . import cache

BACKEND_API_KEY = os.environ.get("BACKEND_API_KEY", "").strip()
RATE_LIMIT_PER_MIN = int(os.environ.get("RATE_LIMIT_PER_MIN", "120"))

# Must stay reachable without the API key (Render pings this directly).
_OPEN_PATHS = {"/api/health"}


def _api_key_exempt(path: str) -> bool:
    # Health (Render's direct check) and the admin ingest routes, which are pushed to
    # directly from the local build CLI and carry their own bearer token instead.
    return path in _OPEN_PATHS or path.startswith("/api/admin/")


def require_api_key(request: Request) -> None:
    if not BACKEND_API_KEY or _api_key_exempt(request.url.path):
        return
    if request.headers.get("x-api-key") != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="missing or invalid API key")


def _client_key(request: Request) -> str:
    # Prefer the authenticated user; else the real client IP from the proxy chain.
    try:
        uid = request.session.get("user")
    except Exception:
        uid = None
    if uid:
        return f"u:{uid}"
    xff = request.headers.get("x-forwarded-for", "")
    ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else "unknown")
    return f"ip:{ip}"


def rate_limit(request: Request) -> None:
    if RATE_LIMIT_PER_MIN <= 0 or request.url.path in _OPEN_PATHS:
        return
    count = cache.incr_window(f"rl:{_client_key(request)}", 60)
    if count is not None and count > RATE_LIMIT_PER_MIN:
        raise HTTPException(status_code=429, detail="rate limit exceeded")
