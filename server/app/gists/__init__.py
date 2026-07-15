"""AI Gists: canonical knowledge extraction and multi-mode reading summaries.

A concept (a `topics` row) is distilled once into a canonical knowledge object
(the intermediate representation), and every reading mode is generated from that
IR so the modes stay mutually consistent. See build.py for the pipeline.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

# Bump when the generator (prompts, IR shape, model) changes in a way that should
# invalidate previously generated gists. It is folded into content_hash, so a bump
# makes every concept's hash differ and the next build run regenerates them.
GENERATOR_VERSION = "1.0.0"

# The five reading modes, in the order the reader presents them. `words` is the
# rough target the prompt asks for; reading_seconds is computed from the actual body.
MODES: list[dict[str, Any]] = [
    {"id": "30s", "label": "30 second", "words": 60},
    {"id": "2min", "label": "2 minute", "words": 280},
    {"id": "5min", "label": "5 minute", "words": 750},
    {"id": "deep", "label": "Deep dive", "words": 1600},
    {"id": "cheatsheet", "label": "Cheat sheet", "words": 250},
]
MODE_IDS = [m["id"] for m in MODES]

WORDS_PER_MINUTE = 200


def reading_seconds(body: str) -> int:
    """Estimated reading time for a markdown body, at WORDS_PER_MINUTE."""
    words = len(re.findall(r"\S+", body))
    return max(1, round(words / WORDS_PER_MINUTE * 60))


def content_hash(label: str, resources: list[dict[str, Any]]) -> str:
    """Stable hash of the generator inputs for one concept. Any change to the
    topic label, its resources, or GENERATOR_VERSION changes the hash, which is
    what lets a build run skip unchanged concepts and drives delta updates."""
    payload = {
        "label": label,
        "resources": sorted(
            ({"label": r.get("label", ""), "url": r.get("url", ""), "type": r.get("type", "")}
             for r in resources),
            key=lambda r: (r["url"], r["label"], r["type"]),
        ),
        "version": GENERATOR_VERSION,
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()
