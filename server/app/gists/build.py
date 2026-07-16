"""Gist generation pipeline (offline batch).

    sources -> extract (canonical IR) -> generate (5 modes) -> eval -> store

Run it with the repo's Python runtime, e.g.:

    uv run python -m app.gists.build --stage 0        # one stage
    uv run python -m app.gists.build                  # all stages
    uv run python -m app.gists.build --force          # regenerate even if unchanged

It is idempotent: each concept is hashed on its inputs (label + resources +
GENERATOR_VERSION) and skipped when the hash is unchanged, unless --force.

Provider/model come from settings (LLM_PROVIDER / LLM_MODEL), overridable with
--provider/--model. Needs the matching key for the chosen provider in the env
(ANTHROPIC_API_KEY or OPENAI_API_KEY) and a seeded database.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from pydantic import BaseModel

from .. import db, settings
from . import GENERATOR_VERSION, MODES, content_hash, reading_seconds
from . import llm, prompts, store
from .llm import LLMClient

EVAL_THRESHOLD = settings.GIST_EVAL_THRESHOLD  # modes scoring below this are flagged, not dropped

# max_tokens per mode, sized to the target length with headroom (all well under
# the non-streaming ceiling, so plain create() is fine here).
MODE_MAX_TOKENS = {"30s": 512, "2min": 1024, "5min": 2048, "deep": 4096, "cheatsheet": 1024}


# --------------------------- remote push (--push) ---------------------------

def _remote_hashes(base: str, token: str) -> dict[str, str]:
    """content_hash the remote server already has, keyed s{stage}t{topic}."""
    r = httpx.get(
        f"{base}/api/admin/gists/hashes",
        headers={"Authorization": f"Bearer {token}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def _push_concept(
    base: str, token: str, stage: int, topic: int,
    ir: dict[str, Any], gist_rows: list[dict[str, Any]], chash: str, version: str,
) -> None:
    payload = {
        "stage": stage, "topic": topic, "contentHash": chash, "version": version,
        "ir": ir, "gists": gist_rows,
    }
    r = httpx.post(
        f"{base}/api/admin/gists",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
        timeout=120,
    )
    r.raise_for_status()


class Knowledge(BaseModel):
    problem: str
    why_it_exists: str
    intuition: str
    tradeoffs: list[str]
    common_questions: list[str]
    pitfalls: list[str]
    real_world_usage: list[str]


class ModeScore(BaseModel):
    mode: str
    score: float
    note: str


class EvalResult(BaseModel):
    scores: list[ModeScore]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def extract(client: LLMClient, label: str, resources: list[dict]) -> Knowledge:
    return client.parse(
        prompts.EXTRACT_SYSTEM, prompts.extract_user(label, resources),
        Knowledge, max_tokens=4096, effort="medium",
    )


def generate_mode(client: LLMClient, ir_block: str, mode_id: str) -> str:
    return client.generate(
        [prompts.GENERATE_SYSTEM, ir_block], prompts.generate_user(mode_id),
        max_tokens=MODE_MAX_TOKENS[mode_id],
    )


def evaluate(client: LLMClient, label: str, bodies: dict[str, str]) -> dict[str, ModeScore]:
    result = client.parse(
        prompts.EVAL_SYSTEM, prompts.eval_user(label, bodies),
        EvalResult, max_tokens=2048, effort="low",
    )
    return {s.mode: s for s in result.scores}


def _ir_block(label: str, k: Knowledge) -> str:
    """Render the canonical knowledge as the shared context every mode is written from."""
    def bullets(items: list[str]) -> str:
        return "\n".join(f"- {i}" for i in items) if items else "- (none)"

    return (
        f"CANONICAL KNOWLEDGE for concept: {label}\n\n"
        f"Problem:\n{k.problem}\n\n"
        f"Why it exists:\n{k.why_it_exists}\n\n"
        f"Intuition:\n{k.intuition}\n\n"
        f"Tradeoffs:\n{bullets(k.tradeoffs)}\n\n"
        f"Common questions:\n{bullets(k.common_questions)}\n\n"
        f"Pitfalls:\n{bullets(k.pitfalls)}\n\n"
        f"Real-world usage:\n{bullets(k.real_world_usage)}"
    )


def build_concept(
    client: LLMClient, topic: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run the full pipeline for one concept and return (ir_dict, gist_rows)."""
    label, resources = topic["label"], topic["resources"]

    knowledge = extract(client, label, resources)
    ir = knowledge.model_dump()
    ir["sources"] = [r["url"] for r in resources]

    ir_block = _ir_block(label, knowledge)
    bodies = {m["id"]: generate_mode(client, ir_block, m["id"]) for m in MODES}

    scores = evaluate(client, label, bodies)

    gist_rows: list[dict[str, Any]] = []
    for m in MODES:
        mode_id = m["id"]
        s = scores.get(mode_id)
        score = s.score if s else None
        meta: dict[str, Any] = {
            "reading_seconds": reading_seconds(bodies[mode_id]),
            "label": m["label"],
            "model": f"{client.provider}:{client.model}",
            "eval_score": score,
            "eval_note": s.note if s else "",
        }
        if score is not None and score < EVAL_THRESHOLD:
            meta["flagged"] = True
        gist_rows.append({"mode": mode_id, "body": bodies[mode_id], "meta": meta})
    return ir, gist_rows


def run(
    stage: Optional[int], force: bool, limit: Optional[int], provider: str, model: str,
    push_url: Optional[str] = None, token: Optional[str] = None,
) -> int:
    """Generate gists for concepts. Concepts (topic labels + resources) are always
    read from the local seeded DB. The sink is either the local DB (default) or, when
    push_url is set, the remote ingest API (generate locally, push to the server)."""
    client = llm.make_client(provider, model)
    print(f"generating with {provider}:{model}", flush=True)
    now = _now_iso()
    pushing = bool(push_url)

    with db.pool().connection() as conn:
        topics = store.topics_for_build(conn, stage)
        local_hashes = {} if pushing else store.existing_hashes(conn)

    remote_hashes = _remote_hashes(push_url, token) if pushing else {}
    if pushing:
        print(f"pushing to {push_url} ({len(remote_hashes)} concepts already there)", flush=True)

    built = skipped = flagged = 0
    for topic in topics:
        chash = content_hash(topic["label"], topic["resources"])
        prev = remote_hashes.get(f"s{topic['stage']}t{topic['topic']}") if pushing else local_hashes.get(topic["topic_id"])
        if not force and prev == chash:
            skipped += 1
            continue
        if limit is not None and built >= limit:
            break

        label = topic["label"]
        print(f"[s{topic['stage']}t{topic['topic']}] {label[:70]} ...", flush=True)
        try:
            ir, gist_rows = build_concept(client, topic)
        except llm.API_ERRORS as e:
            print(f"  ! API error, skipping: {e}", file=sys.stderr, flush=True)
            continue

        low = [g["mode"] for g in gist_rows if g["meta"].get("flagged")]
        if low:
            flagged += 1
            print(f"  ~ flagged (low eval): {', '.join(low)}", flush=True)

        try:
            if pushing:
                _push_concept(push_url, token, topic["stage"], topic["topic"], ir, gist_rows, chash, GENERATOR_VERSION)
            else:
                with db.pool().connection() as conn:
                    with conn.transaction():
                        store.save_concept(conn, topic["topic_id"], ir, gist_rows, chash, GENERATOR_VERSION, now)
        except httpx.HTTPError as e:
            print(f"  ! push failed, skipping: {e}", file=sys.stderr, flush=True)
            continue
        built += 1
        print(f"  ok ({len(gist_rows)} modes){' pushed' if pushing else ''}", flush=True)

    where = "pushed" if pushing else "built"
    print(f"\ndone: {built} {where}, {skipped} unchanged, {flagged} with flagged modes.")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate AI gists for concepts (topics).")
    ap.add_argument("--stage", type=int, default=None, help="only this stage index")
    ap.add_argument("--force", action="store_true", help="regenerate even if inputs are unchanged")
    ap.add_argument("--limit", type=int, default=None, help="cap the number of concepts built")
    ap.add_argument("--model", default=None, help=f"model id (default {settings.LLM_MODEL} from LLM_MODEL)")
    ap.add_argument("--provider", default=None, choices=["anthropic", "openai"],
                    help="LLM provider (default from LLM_PROVIDER, else inferred from --model)")
    ap.add_argument(
        "--push", nargs="?", const="", default=None, metavar="URL",
        help="push to a remote server's ingest API instead of the local DB "
             "(URL defaults to GIST_PUSH_URL)",
    )
    ap.add_argument("--token", default=None, help="admin bearer token for --push (default GIST_ADMIN_TOKEN)")
    args = ap.parse_args()

    model = args.model or settings.LLM_MODEL
    # Explicit --provider wins; else infer from an explicit --model; else settings.
    provider = args.provider or (settings.provider_for(model) if args.model else settings.LLM_PROVIDER)

    push_url = token = None
    if args.push is not None:
        push_url = (args.push or settings.GIST_PUSH_URL).rstrip("/")
        if not push_url:
            ap.error("--push needs a URL (positional arg or GIST_PUSH_URL env)")
        token = args.token or settings.GIST_ADMIN_TOKEN
        if not token:
            ap.error("--push needs an admin token (--token or GIST_ADMIN_TOKEN env)")

    raise SystemExit(run(args.stage, args.force, args.limit, provider, model, push_url, token))


if __name__ == "__main__":
    main()
