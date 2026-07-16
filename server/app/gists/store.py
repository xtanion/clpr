"""Postgres access for gists: reads for the API/content load, writes for the build.

Gists are content (not per-user state), so this sits alongside content.py rather
than db.py, and uses the same shared connection pool."""

from __future__ import annotations

from typing import Any, Optional

from psycopg.types.json import Json

from .. import db
from . import MODE_IDS


def topics_for_build(conn, stage: Optional[int] = None) -> list[dict[str, Any]]:
    """Every concept (topic) the pipeline can generate for, with its resources.
    Optionally scoped to one stage."""
    where = "WHERE stage_idx = %s" if stage is not None else ""
    args = (stage,) if stage is not None else ()
    topics = [
        {"topic_id": tid, "stage": si, "topic": idx, "label": label, "resources": []}
        for tid, si, idx, label in conn.execute(
            f"SELECT id, stage_idx, idx, label FROM topics {where} ORDER BY stage_idx, idx",
            args,
        )
    ]
    by_id = {t["topic_id"]: t for t in topics}
    if by_id:
        for topic_id, label, url, type_ in conn.execute(
            "SELECT topic_id, label, url, type FROM resources "
            "WHERE topic_id = ANY(%s) ORDER BY topic_id, ord",
            (list(by_id.keys()),),
        ):
            by_id[topic_id]["resources"].append({"label": label, "url": url, "type": type_})
    return topics


def existing_hashes(conn) -> dict[int, str]:
    """topic_id -> content_hash for concepts already generated, so a build run can
    skip the ones whose inputs haven't changed."""
    return {
        tid: chash
        for tid, chash in conn.execute("SELECT topic_id, content_hash FROM concept_knowledge")
    }


def save_concept(
    conn,
    topic_id: int,
    ir: dict[str, Any],
    gists: list[dict[str, Any]],
    content_hash: str,
    version: str,
    now: str,
) -> None:
    """Upsert one concept's canonical knowledge and all of its reading modes."""
    conn.execute(
        "INSERT INTO concept_knowledge "
        "(topic_id, problem, why_it_exists, intuition, tradeoffs, common_questions, "
        " pitfalls, real_world_usage, sources, version, content_hash, updated_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) "
        "ON CONFLICT (topic_id) DO UPDATE SET "
        "problem = EXCLUDED.problem, why_it_exists = EXCLUDED.why_it_exists, "
        "intuition = EXCLUDED.intuition, tradeoffs = EXCLUDED.tradeoffs, "
        "common_questions = EXCLUDED.common_questions, pitfalls = EXCLUDED.pitfalls, "
        "real_world_usage = EXCLUDED.real_world_usage, sources = EXCLUDED.sources, "
        "version = EXCLUDED.version, content_hash = EXCLUDED.content_hash, "
        "updated_at = EXCLUDED.updated_at",
        (
            topic_id, ir.get("problem", ""), ir.get("why_it_exists", ""), ir.get("intuition", ""),
            Json(ir.get("tradeoffs", [])), Json(ir.get("common_questions", [])),
            Json(ir.get("pitfalls", [])), Json(ir.get("real_world_usage", [])),
            Json(ir.get("sources", [])), version, content_hash, now,
        ),
    )
    for g in gists:
        conn.execute(
            "INSERT INTO gists (topic_id, mode, body, meta, version, content_hash, updated_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s) "
            "ON CONFLICT (topic_id, mode) DO UPDATE SET "
            "body = EXCLUDED.body, meta = EXCLUDED.meta, version = EXCLUDED.version, "
            "content_hash = EXCLUDED.content_hash, updated_at = EXCLUDED.updated_at",
            (topic_id, g["mode"], g["body"], Json(g.get("meta", {})), version, content_hash, now),
        )


def get_gists(stage: int, topic: int) -> Optional[dict[str, Any]]:
    """All reading modes for one concept, addressed the way the frontend addresses
    topics: (stage_idx, topic_idx). Returns None if the topic doesn't exist."""
    with db.pool().connection() as conn:
        row = conn.execute(
            "SELECT id FROM topics WHERE stage_idx = %s AND idx = %s", (stage, topic)
        ).fetchone()
        if not row:
            return None
        topic_id = row[0]
        modes = {
            mode: {"body": body, "meta": meta, "version": version, "updatedAt": updated_at}
            for mode, body, meta, version, updated_at in conn.execute(
                "SELECT mode, body, meta, version, updated_at FROM gists WHERE topic_id = %s",
                (topic_id,),
            )
        }
    # Canonical modes first, then any custom mode ids the author used.
    ordered = {m: modes[m] for m in MODE_IDS if m in modes}
    ordered.update({m: v for m, v in modes.items() if m not in ordered})
    version = next((v["version"] for v in ordered.values()), "")
    return {"stage": stage, "topic": topic, "version": version, "modes": ordered}


def availability(conn) -> dict[int, dict[int, dict[str, Any]]]:
    """Which modes exist per concept, for the startup content load: keyed
    stage_idx -> topic_idx -> {modes: [...], version: str}. Bodies are not loaded
    here — the reader fetches those on demand via get_gists."""
    out: dict[int, dict[int, dict[str, Any]]] = {}
    for stage, topic, mode, version in conn.execute(
        "SELECT t.stage_idx, t.idx, g.mode, g.version "
        "FROM gists g JOIN topics t ON t.id = g.topic_id "
        "ORDER BY t.stage_idx, t.idx"
    ):
        slot = out.setdefault(stage, {}).setdefault(topic, {"modes": [], "version": version})
        slot["modes"].append(mode)
        slot["version"] = version
    # Canonical modes first, then any custom mode ids the author used.
    for stage in out.values():
        for slot in stage.values():
            present = slot["modes"]
            slot["modes"] = [m for m in MODE_IDS if m in present] + [m for m in present if m not in MODE_IDS]
    return out
