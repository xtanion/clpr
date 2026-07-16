"""Optional Redis (Render Key Value) for caching and rate limiting.

Every helper is a no-op / fail-open when REDIS_URL is unset or Redis is unreachable,
so local dev and tests run without Redis and a Redis outage never takes the API down.
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

try:
    import redis as _redis
except ImportError:  # pragma: no cover
    _redis = None

REDIS_URL = os.environ.get("REDIS_URL", "").strip()

_client: Optional[Any] = None
_initialized = False


def client() -> Optional[Any]:
    """Lazily build a shared Redis client, or None if unavailable."""
    global _client, _initialized
    if not _initialized:
        _initialized = True
        if REDIS_URL and _redis is not None:
            try:
                c = _redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)
                c.ping()
                _client = c
            except Exception:
                _client = None
    return _client


def get_json(key: str) -> Optional[Any]:
    c = client()
    if not c:
        return None
    try:
        raw = c.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def set_json(key: str, value: Any, ttl: int) -> None:
    c = client()
    if not c:
        return
    try:
        c.set(key, json.dumps(value), ex=ttl)
    except Exception:
        pass


def incr_window(key: str, window_seconds: int) -> Optional[int]:
    """Increment a fixed-window counter and return the new count, or None if Redis
    is unavailable (caller should fail open)."""
    c = client()
    if not c:
        return None
    try:
        pipe = c.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        count, _ = pipe.execute()
        return int(count)
    except Exception:
        return None
