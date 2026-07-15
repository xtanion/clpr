"""Prompts for the gist pipeline. Kept separate from orchestration so the wording
can be tuned without touching the build logic (and so GENERATOR_VERSION bumps in
__init__.py map to visible prompt changes here)."""

from __future__ import annotations

# ---------------------------------------------------------------- extraction ----

EXTRACT_SYSTEM = """You are a technical curriculum editor. From a single learning \
concept and its listed resources, produce a canonical, structured knowledge object \
about the concept — the neutral source of truth that every summary length will later \
be written from.

Rules:
- Ground everything in the concept itself. Do not invent specific benchmark numbers, \
version strings, or citations you are not confident are correct.
- Write for an engineer learning the topic, not for marketing.
- Keep each field tight and factual. Lists should hold short, standalone items.
- If the concept is a build/practice exercise rather than a body of theory, describe \
the skill it builds and the pitfalls of doing it, rather than fabricating theory."""


def extract_user(label: str, resources: list[dict]) -> str:
    lines = [f"Concept: {label}", ""]
    if resources:
        lines.append("Listed resources:")
        for r in resources:
            lines.append(f"- ({r.get('type','')}) {r.get('label','')} — {r.get('url','')}")
    else:
        lines.append("Listed resources: none (this is a hands-on build/practice task).")
    lines.append("")
    lines.append("Extract the canonical knowledge object for this concept.")
    return "\n".join(lines)


# ---------------------------------------------------------------- generation ----

GENERATE_SYSTEM = """You write learning "gists" — the same concept rendered at \
different reading depths, like the reading modes in a good docs site. You are given \
a canonical knowledge object for one concept and asked for exactly one mode.

Global rules:
- Output GitHub-flavored Markdown only. No preamble, no "Here is...", no meta commentary.
- Never contradict the canonical knowledge object. Do not add facts that aren't \
grounded in it (no invented numbers, benchmarks, or version claims).
- Match the requested length and shape closely.
- Use fenced code blocks for code; keep prose readable."""

# One instruction per mode. The canonical knowledge object is sent once (cached) and
# reused across all five calls; only this instruction changes per mode.
MODE_INSTRUCTIONS: dict[str, str] = {
    "30s": (
        "Write the **30 second** gist: about 40-70 words. A quick reminder of what "
        "the concept is and why it matters. 2-4 sentences, no headings, no lists."
    ),
    "2min": (
        "Write the **2 minute** gist: about 200-320 words. High-level intuition — the "
        "problem, why the naive approach falls short, and the key idea that fixes it. "
        "Short paragraphs; at most one small list. No code unless a 2-3 line snippet "
        "genuinely clarifies."
    ),
    "5min": (
        "Write the **5 minute** gist: about 600-850 words. A detailed explanation with "
        "intuition, the main tradeoffs, and a concrete example or small code snippet. "
        "Use a few `##` sections. Assume an engineer who wants working understanding, "
        "not a full lecture."
    ),
    "deep": (
        "Write the **Deep dive**: about 1300-1900 words. The complete lesson — mechanism, "
        "the relevant math or algorithm where it applies, implementation considerations, "
        "and real-world/production notes. Use `##` sections and code blocks. This should "
        "stand on its own as the full concept."
    ),
    "cheatsheet": (
        "Write the **Cheat sheet**: a one-page quick reference. Dense and scannable: a "
        "short purpose line, then tight sections (e.g. Purpose, Cost/Complexity, When to "
        "use / avoid, Gotchas, Used by) as compact bullet lists or a small table. Minimal "
        "prose."
    ),
}


def generate_user(mode_id: str) -> str:
    return MODE_INSTRUCTIONS[mode_id]


# ---------------------------------------------------------------- evaluation ----

EVAL_SYSTEM = """You are a quality checker for learning summaries. Given a concept's \
canonical knowledge object and the generated reading modes, score each mode. Judge:
- groundedness: does it stay faithful to the canonical knowledge, without invented facts?
- fit: does it match the intended length and shape of that mode?

Return a score from 0.0 to 1.0 per mode (1.0 = fully grounded and well-fitted) and a \
one-line note. Be strict about invented specifics."""


def eval_user(label: str, bodies: dict[str, str]) -> str:
    parts = [f"Concept: {label}", ""]
    for mode_id, body in bodies.items():
        parts.append(f"=== mode: {mode_id} ===")
        parts.append(body)
        parts.append("")
    parts.append("Score each mode listed above.")
    return "\n".join(parts)
