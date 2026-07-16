"""Admin ingest API: push locally-generated gists into the server's database.

Auth is a static bearer token (GIST_ADMIN_TOKEN), deliberately separate from user
OAuth: this is a machine-to-machine push from the local build CLI, not an end-user
action. When the token is unset the endpoints are disabled (503), so they are inert
unless explicitly configured.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .. import db, settings
from . import store

router = APIRouter(prefix="/api/admin/gists", tags=["admin"])


def _require_admin(authorization: Optional[str]) -> None:
    if not settings.GIST_ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="ingest disabled: GIST_ADMIN_TOKEN not set")
    if authorization != f"Bearer {settings.GIST_ADMIN_TOKEN}":
        raise HTTPException(status_code=401, detail="invalid or missing admin token")


class GistIn(BaseModel):
    mode: str
    body: str
    meta: dict[str, Any] = {}


class ConceptIn(BaseModel):
    stage: int
    topic: int
    contentHash: str = ""
    version: str = ""
    ir: dict[str, Any]
    gists: list[GistIn]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.get("/hashes")
def hashes(authorization: Optional[str] = Header(None)) -> dict[str, str]:
    """content_hash per already-ingested concept, keyed s{stage}t{topic}. Lets the
    local build skip concepts the server already has at the same hash."""
    _require_admin(authorization)
    with db.pool().connection() as conn:
        rows = conn.execute(
            "SELECT t.stage_idx, t.idx, ck.content_hash "
            "FROM concept_knowledge ck JOIN topics t ON t.id = ck.topic_id"
        ).fetchall()
    return {f"s{st}t{tp}": h for st, tp, h in rows}


@router.post("")
def ingest(concept: ConceptIn, authorization: Optional[str] = Header(None)) -> dict[str, Any]:
    """Upsert one concept's canonical knowledge + all reading modes. Idempotent."""
    _require_admin(authorization)
    with db.pool().connection() as conn:
        row = conn.execute(
            "SELECT id FROM topics WHERE stage_idx = %s AND idx = %s",
            (concept.stage, concept.topic),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"No topic s{concept.stage}t{concept.topic}")
        topic_id = row[0]
        gist_rows = [g.model_dump() for g in concept.gists]
        with conn.transaction():
            store.save_concept(
                conn, topic_id, concept.ir, gist_rows, concept.contentHash, concept.version, _now_iso()
            )
    return {"ok": True, "stage": concept.stage, "topic": concept.topic,
            "modes": [g.mode for g in concept.gists]}
