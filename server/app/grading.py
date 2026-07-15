"""Server-side grading and scoring.

Numeric and free-response questions are graded authoritatively here (pure, safe),
so the answers/keywords never ship to the client. Code questions execute arbitrary
JavaScript in the learner's own browser; there is no JS runtime here, so the client
posts its locally computed {frac, pass} for code questions and the server trusts it
for XP purposes. Everything else about an attempt (weighting, pass threshold, XP,
ledger) is computed server-side and is authoritative.
"""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Any, Optional

from . import content as data

PASS = 0.7


class Grade(dict):
    """{"pass": bool, "frac": float, "msg": str} with attribute-ish access via keys."""


def grade_numeric(q: dict[str, Any], val: str) -> dict[str, Any]:
    try:
        num = float(str(val).replace(",", ""))
    except (TypeError, ValueError):
        return {"pass": False, "frac": 0.0, "msg": "Enter a number."}
    if math.isnan(num):
        return {"pass": False, "frac": 0.0, "msg": "Enter a number."}
    ok = abs(num - q["answer"]) <= q["tolerance"]
    unit = f" {q['unit']}" if q.get("unit") else ""
    msg = f"Correct: {q['answer']}{unit}." if ok else "Not quite. Recompute and try again."
    return {"pass": ok, "frac": 1.0 if ok else 0.0, "msg": msg}


def grade_free(q: dict[str, Any], text: str) -> dict[str, Any]:
    t = (text or "").lower()
    if len([w for w in t.strip().split() if w]) < 6:
        return {"pass": False, "frac": 0.0, "msg": "Write at least a full sentence to be judged."}
    hits = sum(1 for k in q["keywords"] if k.lower() in t)
    frac = min(1.0, hits / min(3, len(q["keywords"])))
    passed = frac >= 0.5
    verdict = "The judge accepts this answer" if passed else "The judge wants more of the key ideas"
    msg = f"{verdict}. Coverage {round(frac * 100)}%. This question carries reduced leaderboard weight by design."
    return {"pass": passed, "frac": frac, "msg": msg}


def grade_response(question: dict[str, Any], resp: dict[str, Any]) -> dict[str, Any]:
    """Grade one question. `resp` is a client submission for that question index."""
    qtype = question["type"]
    if qtype == "numeric":
        return grade_numeric(question, resp.get("value", ""))
    if qtype == "free":
        return grade_free(question, resp.get("value", ""))
    if qtype == "code":
        # No server JS runtime: trust the client's locally computed result.
        frac = float(resp.get("frac", 0) or 0)
        frac = max(0.0, min(1.0, frac))
        passed = bool(resp.get("pass", False))
        return {"pass": passed, "frac": frac, "msg": resp.get("msg", "Graded in-browser.")}
    return {"pass": False, "frac": 0.0, "msg": f"Unknown question type {qtype}."}


def aggregate(questions: list[dict[str, Any]], grades: list[dict[str, Any]]) -> tuple[float, bool]:
    """Weighted score and overall pass, matching components/quiz/Quiz.tsx finish()."""
    total_w = 0.0
    got_w = 0.0
    for q, g in zip(questions, grades):
        w = 1.0 if q["weight"] == "full" else 0.4
        total_w += w
        got_w += w * (g["frac"] if g else 0.0)
    score = got_w / total_w if total_w else 0.0
    passed_all = all(g and g["pass"] for g in grades)
    passed = passed_all and score >= PASS
    return score, passed


# ---------- derived stats over persisted state (port of lib/store.ts) ----------

def _iso(d: date) -> str:
    return d.isoformat()


def streak(entries: dict[str, Any], today: Optional[date] = None) -> int:
    d = today or date.today()
    if _iso(d) not in entries:
        d = d - timedelta(days=1)
    n = 0
    while _iso(d) in entries:
        n += 1
        d = d - timedelta(days=1)
    return n


def stage_done_count(progress: dict[str, bool], stage: int) -> int:
    n = 0
    for t in range(len(data.roadmap[stage]["topics"])):
        if progress.get(f"s{stage}t{t}"):
            n += 1
    return n


def completed_topics(progress: dict[str, bool]) -> int:
    return sum(stage_done_count(progress, st) for st in range(len(data.roadmap)))


def altitude(progress: dict[str, bool]) -> float:
    return completed_topics(progress) / data.TOTAL_TOPICS if data.TOTAL_TOPICS else 0.0


def clpr_cleared(attempts: list[dict[str, Any]], stage: int) -> bool:
    return any(a["stage"] == stage and a["passed"] for a in attempts)


def highest_stage_cleared(attempts: list[dict[str, Any]]) -> int:
    h = 0
    for st in range(len(data.roadmap)):
        if clpr_cleared(attempts, st):
            h = st + 1
    return h


def total_xp(ledger: list[dict[str, Any]]) -> int:
    return round(sum(r["xp"] for r in ledger))


def compute_xp(entries: dict[str, Any], stage: int, score_fraction: float, first_clear: bool) -> int:
    base = 100
    difficulty = 1 + stage * 0.15
    score_part = 0.5 + 0.5 * score_fraction
    streak_mult = 1 + min(streak(entries), 30) * 0.02
    xp = base * difficulty * score_part * streak_mult
    if first_clear:
        xp += 150
    return round(xp)


def best_attempt(attempts: list[dict[str, Any]], stage: int) -> Optional[dict[str, Any]]:
    best = None
    for a in attempts:
        if a["stage"] == stage and a["passed"]:
            if best is None or a["score"] > best["score"] or (a["score"] == best["score"] and a["timeMs"] < best["timeMs"]):
                best = a
    return best


def leaderboard(state: dict[str, Any]) -> list[dict[str, Any]]:
    me = {
        "name": "You", "handle": "you",
        "xp": total_xp(state["ledger"]),
        "stage": highest_stage_cleared(state["attempts"]),
        "streak": streak(state["entries"]),
        "me": True, "rank": 0,
    }
    rows = [{**f, "me": False, "rank": 0} for f in data.friends]
    rows.append(me)
    rows.sort(key=lambda r: r["xp"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1
    return rows


def global_leaderboard(rows: list[dict[str, Any]], current_user: str) -> list[dict[str, Any]]:
    """Rank all real users by XP. `rows` come from db.leaderboard_data(); the row whose
    id matches current_user is flagged `me`. Stage = highest clpr cleared + 1."""
    board = []
    for r in rows:
        passed = r["passedStages"]
        board.append({
            "name": r["username"] or r["name"] or "climber",
            "handle": r["username"] or r["id"],
            "xp": round(r["xp"]),
            "stage": (max(passed) + 1) if passed else 0,
            "streak": streak(r["entries"]),
            "avatarUrl": r.get("avatarUrl") or "",
            "me": r["id"] == current_user,
            "rank": 0,
        })
    board.sort(key=lambda b: b["xp"], reverse=True)
    for i, b in enumerate(board):
        b["rank"] = i + 1
    return board


def races(rows: list[dict[str, Any]], current_user: str) -> dict[str, list[dict[str, Any]]]:
    """Group per-stage best attempts (from db.races_data()) into race boards keyed by
    stage, each ranked by score desc then time asc, with the caller's row flagged."""
    by_stage: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        by_stage.setdefault(str(r["stage"]), []).append({
            "name": r["username"] or r["name"] or "climber",
            "handle": r["username"] or r["id"],
            "ms": r["ms"],
            "score": r["score"],
            "me": r["id"] == current_user,
        })
    for runners in by_stage.values():
        runners.sort(key=lambda x: (-x["score"], x["ms"]))
    return by_stage


def my_rank(state: dict[str, Any]) -> int:
    board = leaderboard(state)
    mine = next((r for r in board if r["me"]), None)
    return mine["rank"] if mine else len(board)


def stats(state: dict[str, Any]) -> dict[str, Any]:
    progress = state["progress"]
    return {
        "streak": streak(state["entries"]),
        "daysLogged": len(state["entries"]),
        "completedTopics": completed_topics(progress),
        "totalTopics": data.TOTAL_TOPICS,
        "altitude": altitude(progress),
        "totalXp": total_xp(state["ledger"]),
        "highestStageCleared": highest_stage_cleared(state["attempts"]),
        "rank": my_rank(state),
        "stageDone": [stage_done_count(progress, st) for st in range(len(data.roadmap))],
        "clprCleared": [clpr_cleared(state["attempts"], st) for st in range(len(data.roadmap))],
    }
