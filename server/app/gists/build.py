"""Gist generation pipeline (offline batch).

    sources -> extract (canonical IR) -> generate (5 modes) -> eval -> store

Run it with the repo's Python runtime, e.g.:

    uv run python -m app.gists.build --stage 0        # one stage
    uv run python -m app.gists.build                  # all stages
    uv run python -m app.gists.build --force          # regenerate even if unchanged

It is idempotent: each concept is hashed on its inputs (label + resources +
GENERATOR_VERSION) and skipped when the hash is unchanged, unless --force. Needs
ANTHROPIC_API_KEY (or an `ant auth login` profile) and a seeded database.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from typing import Any, Optional

import anthropic
from pydantic import BaseModel

from .. import db
from . import GENERATOR_VERSION, MODES, content_hash, reading_seconds
from . import prompts, store

DEFAULT_MODEL = "claude-opus-4-8"
EVAL_THRESHOLD = 0.6  # modes scoring below this are flagged, not dropped

# max_tokens per mode, sized to the target length with headroom (all well under
# the non-streaming ceiling, so plain create() is fine here).
MODE_MAX_TOKENS = {"30s": 512, "2min": 1024, "5min": 2048, "deep": 4096, "cheatsheet": 1024}


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


def _text(response) -> str:
    return "".join(b.text for b in response.content if b.type == "text").strip()


def extract(client: anthropic.Anthropic, model: str, label: str, resources: list[dict]) -> Knowledge:
    resp = client.messages.parse(
        model=model,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        system=prompts.EXTRACT_SYSTEM,
        messages=[{"role": "user", "content": prompts.extract_user(label, resources)}],
        output_format=Knowledge,
    )
    return resp.parsed_output


def generate_mode(
    client: anthropic.Anthropic, model: str, ir_block: str, mode_id: str
) -> str:
    resp = client.messages.create(
        model=model,
        max_tokens=MODE_MAX_TOKENS[mode_id],
        system=[
            {"type": "text", "text": prompts.GENERATE_SYSTEM},
            # Cached so the shared IR isn't re-billed across the five mode calls
            # (a no-op below the model's cache minimum, harmless above it).
            {"type": "text", "text": ir_block, "cache_control": {"type": "ephemeral"}},
        ],
        messages=[{"role": "user", "content": prompts.generate_user(mode_id)}],
    )
    return _text(resp)


def evaluate(
    client: anthropic.Anthropic, model: str, label: str, bodies: dict[str, str]
) -> dict[str, ModeScore]:
    resp = client.messages.parse(
        model=model,
        max_tokens=2048,
        thinking={"type": "adaptive"},
        output_config={"effort": "low"},
        system=prompts.EVAL_SYSTEM,
        messages=[{"role": "user", "content": prompts.eval_user(label, bodies)}],
        output_format=EvalResult,
    )
    return {s.mode: s for s in resp.parsed_output.scores}


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
    client: anthropic.Anthropic, model: str, topic: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Run the full pipeline for one concept and return (ir_dict, gist_rows)."""
    label, resources = topic["label"], topic["resources"]

    knowledge = extract(client, model, label, resources)
    ir = knowledge.model_dump()
    ir["sources"] = [r["url"] for r in resources]

    ir_block = _ir_block(label, knowledge)
    bodies = {m["id"]: generate_mode(client, model, ir_block, m["id"]) for m in MODES}

    scores = evaluate(client, model, label, bodies)

    gist_rows: list[dict[str, Any]] = []
    for m in MODES:
        mode_id = m["id"]
        s = scores.get(mode_id)
        score = s.score if s else None
        meta: dict[str, Any] = {
            "reading_seconds": reading_seconds(bodies[mode_id]),
            "label": m["label"],
            "model": model,
            "eval_score": score,
            "eval_note": s.note if s else "",
        }
        if score is not None and score < EVAL_THRESHOLD:
            meta["flagged"] = True
        gist_rows.append({"mode": mode_id, "body": bodies[mode_id], "meta": meta})
    return ir, gist_rows


def run(stage: Optional[int], force: bool, limit: Optional[int], model: str) -> int:
    client = anthropic.Anthropic()
    now = _now_iso()

    with db.pool().connection() as conn:
        topics = store.topics_for_build(conn, stage)
        hashes = store.existing_hashes(conn)

    built = skipped = flagged = 0
    for topic in topics:
        chash = content_hash(topic["label"], topic["resources"])
        if not force and hashes.get(topic["topic_id"]) == chash:
            skipped += 1
            continue
        if limit is not None and built >= limit:
            break

        label = topic["label"]
        print(f"[s{topic['stage']}t{topic['topic']}] {label[:70]} ...", flush=True)
        try:
            ir, gist_rows = build_concept(client, model, topic)
        except anthropic.APIError as e:
            print(f"  ! API error, skipping: {e}", file=sys.stderr, flush=True)
            continue

        low = [g["mode"] for g in gist_rows if g["meta"].get("flagged")]
        if low:
            flagged += 1
            print(f"  ~ flagged (low eval): {', '.join(low)}", flush=True)

        with db.pool().connection() as conn:
            with conn.transaction():
                store.save_concept(conn, topic["topic_id"], ir, gist_rows, chash, GENERATOR_VERSION, now)
        built += 1
        print(f"  ok ({len(gist_rows)} modes)", flush=True)

    print(f"\ndone: {built} built, {skipped} unchanged, {flagged} with flagged modes.")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate AI gists for concepts (topics).")
    ap.add_argument("--stage", type=int, default=None, help="only this stage index")
    ap.add_argument("--force", action="store_true", help="regenerate even if inputs are unchanged")
    ap.add_argument("--limit", type=int, default=None, help="cap the number of concepts built")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"model id (default {DEFAULT_MODEL})")
    args = ap.parse_args()
    raise SystemExit(run(args.stage, args.force, args.limit, args.model))


if __name__ == "__main__":
    main()
