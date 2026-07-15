"""Runtime content, read from the Postgres content tables.

Exposes the same names the API and grading use (roadmap, quizzes, csTree, …) so
callers can `from . import content as data`. load() assembles the nested shapes
the frontend expects and caches them in module globals; call it once at startup.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from . import db
from .gists import store as gist_store

roadmap: list[dict[str, Any]] = []
TOTAL_TOPICS: int = 0
quizzes: list[dict[str, Any]] = []
csTree: dict[str, Any] = {}
worlds: list[dict[str, Any]] = []
genres: list[dict[str, Any]] = []
friends: list[dict[str, Any]] = []
global_users: list[dict[str, Any]] = []
raceTimes: dict[int, list[dict[str, Any]]] = {}
materials: list[dict[str, Any]] = []
camp_materials: list[dict[str, int]] = []
artifacts: list[dict[str, Any]] = []
ARTIFACTS_BY_ID: dict[str, dict[str, Any]] = {}
# stage_idx -> topic_idx -> {"modes": [...], "version": str}; which reading modes
# each concept has generated. Bodies are fetched on demand (gist_store.get_gists).
gist_avail: dict[int, dict[int, dict[str, Any]]] = {}

TRACK_NAMES: dict[str, str] = {"llm-inference": "llm"}


def _num(x: Any) -> Any:
    """Preserve int-ness for whole numbers stored as double precision."""
    if isinstance(x, float) and x.is_integer():
        return int(x)
    return x


def _load_roadmap(conn) -> list[dict[str, Any]]:
    topics_by_stage: dict[int, list[dict[str, Any]]] = defaultdict(list)
    topic_map: dict[int, dict[str, Any]] = {}
    for tid, stage_idx, _idx, label, build in conn.execute(
        "SELECT id, stage_idx, idx, label, build FROM topics ORDER BY stage_idx, idx"
    ):
        t = {"label": label, "res": [], "_build": build}
        topics_by_stage[stage_idx].append(t)
        topic_map[tid] = t
    for topic_id, _ord, label, url, type_ in conn.execute(
        "SELECT topic_id, ord, label, url, type FROM resources ORDER BY topic_id, ord"
    ):
        topic_map[topic_id]["res"].append({"label": label, "url": url, "type": type_})

    out: list[dict[str, Any]] = []
    for idx, alt, title, blurb in conn.execute(
        "SELECT idx, alt, title, blurb FROM stages ORDER BY idx"
    ):
        topics = []
        for t in topics_by_stage[idx]:
            td: dict[str, Any] = {"label": t["label"], "res": t["res"]}
            if t["_build"]:
                td["build"] = True
            topics.append(td)
        out.append({"alt": alt, "title": title, "blurb": blurb, "topics": topics})
    return out


def _load_quizzes(conn) -> list[dict[str, Any]]:
    tests: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for qid, _ord, args, expected in conn.execute(
        "SELECT question_id, ord, args, expected FROM question_tests ORDER BY question_id, ord"
    ):
        tests[qid].append({"args": args, "expected": expected})
    rubric: dict[int, list[str]] = defaultdict(list)
    for qid, _ord, text in conn.execute(
        "SELECT question_id, ord, text FROM question_rubric ORDER BY question_id, ord"
    ):
        rubric[qid].append(text)
    keywords: dict[int, list[str]] = defaultdict(list)
    for qid, _ord, word in conn.execute(
        "SELECT question_id, ord, word FROM question_keywords ORDER BY question_id, ord"
    ):
        keywords[qid].append(word)

    by_stage: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for qid, stage_idx, _idx, type_, weight, prompt, hint, unit, answer, tolerance, signature, entry in conn.execute(
        "SELECT id, stage_idx, idx, type, weight, prompt, hint, unit, answer, tolerance, signature, entry "
        "FROM questions ORDER BY stage_idx, idx"
    ):
        q: dict[str, Any] = {"type": type_, "weight": weight, "prompt": prompt}
        if type_ == "numeric":
            q["hint"] = hint
            q["answer"] = _num(answer)
            q["tolerance"] = _num(tolerance)
            q["unit"] = unit
        elif type_ == "code":
            q["signature"] = signature
            q["entry"] = entry
            q["tests"] = tests.get(qid, [])
        elif type_ == "free":
            q["rubric"] = rubric.get(qid, [])
            q["keywords"] = keywords.get(qid, [])
        by_stage[stage_idx].append(q)

    return [{"stage": s, "questions": by_stage[s]} for s in sorted(by_stage)]


def _load_tree(conn) -> dict[str, Any]:
    children: dict[Optional[str], list[tuple[int, str]]] = defaultdict(list)
    node_map: dict[str, dict[str, Any]] = {}
    root_id: Optional[str] = None
    for nid, parent_id, label, climb, ord_ in conn.execute(
        "SELECT id, parent_id, label, climb, ord FROM tree_nodes"
    ):
        node: dict[str, Any] = {"id": nid, "label": label}
        if climb:
            node["climb"] = climb
        node_map[nid] = node
        if parent_id is None:
            root_id = nid
        else:
            children[parent_id].append((ord_, nid))

    def attach(nid: str) -> dict[str, Any]:
        kids = sorted(children.get(nid, []))
        if kids:
            node_map[nid]["children"] = [attach(cid) for _, cid in kids]
        return node_map[nid]

    return attach(root_id) if root_id is not None else {}


def load() -> None:
    global roadmap, TOTAL_TOPICS, quizzes, csTree, worlds, genres, friends
    global global_users, raceTimes, materials, camp_materials, artifacts, ARTIFACTS_BY_ID
    global gist_avail

    with db.pool().connection() as conn:
        roadmap = _load_roadmap(conn)
        TOTAL_TOPICS = sum(len(s["topics"]) for s in roadmap)

        # Attach gist availability onto each concept (topic) so the frontend knows
        # which reading modes exist without fetching bodies. Absent while gists
        # haven't been generated yet.
        gist_avail = gist_store.availability(conn)
        for si, stage in enumerate(roadmap):
            for ti, topic in enumerate(stage["topics"]):
                avail = gist_avail.get(si, {}).get(ti)
                if avail:
                    topic["gists"] = avail
        quizzes = _load_quizzes(conn)
        csTree = _load_tree(conn)

        camps: dict[str, list[tuple[int, int]]] = defaultdict(list)
        for world_id, stage_idx, ord_ in conn.execute(
            "SELECT world_id, stage_idx, ord FROM world_camps"
        ):
            camps[world_id].append((ord_, stage_idx))
        worlds = [
            {"id": wid, "name": name, "camps": [s for _, s in sorted(camps[wid])]}
            for wid, name, _ord in conn.execute("SELECT id, name, ord FROM worlds ORDER BY ord")
        ]

        genres = []
        for gid, name, descr, status, st, tp, href in conn.execute(
            "SELECT id, name, descr, status, stages, topics, href FROM genres ORDER BY ord"
        ):
            g: dict[str, Any] = {"id": gid, "name": name, "desc": descr, "status": status, "stages": st, "topics": tp}
            if href:
                g["href"] = href
            genres.append(g)

        friends = [
            {"name": name, "handle": handle, "xp": xp, "stage": stage, "streak": streak}
            for handle, name, xp, stage, streak in conn.execute(
                "SELECT handle, name, xp, stage, streak FROM friends ORDER BY ord"
            )
        ]
        global_users = [
            {"name": name, "handle": handle, "xp": xp, "stage": stage, "streak": streak}
            for handle, name, xp, stage, streak in conn.execute(
                "SELECT handle, name, xp, stage, streak FROM global_users ORDER BY ord"
            )
        ]

        races: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for stage_idx, name, ms, score in conn.execute(
            "SELECT stage_idx, name, ms, score FROM race_times ORDER BY stage_idx, ord"
        ):
            races[stage_idx].append({"name": name, "ms": ms, "score": score})
        raceTimes = dict(races)

        materials = [
            {"id": mid, "name": name}
            for mid, name in conn.execute("SELECT id, name FROM materials ORDER BY ord")
        ]

        camp_materials = [dict() for _ in range(len(roadmap))]
        for stage_idx, material_id, qty in conn.execute(
            "SELECT stage_idx, material_id, qty FROM camp_materials"
        ):
            if 0 <= stage_idx < len(camp_materials):
                camp_materials[stage_idx][material_id] = qty

        costs: dict[str, dict[str, int]] = defaultdict(dict)
        for artifact_id, material_id, qty in conn.execute(
            "SELECT artifact_id, material_id, qty FROM artifact_costs"
        ):
            costs[artifact_id][material_id] = qty
        artifacts = [
            {"id": aid, "name": name, "blurb": blurb, "req": req, "cost": dict(costs.get(aid, {}))}
            for aid, name, blurb, req in conn.execute(
                "SELECT id, name, blurb, req FROM artifacts ORDER BY ord"
            )
        ]
        ARTIFACTS_BY_ID = {a["id"]: a for a in artifacts}


def quiz_for_stage(stage: int) -> Optional[dict[str, Any]]:
    return next((q for q in quizzes if q["stage"] == stage), None)


def get_track(topic_id: str) -> dict[str, Any]:
    camps = roadmap
    weeks: list[dict[str, Any]] = []
    for w in range(len(camps) * 2):
        camp_id = w // 2
        half = w % 2
        camp = camps[camp_id]
        idx = [half * 2, half * 2 + 1]
        topics = [{
            "stage": camp_id,
            "topic": t,
            "label": camp["topics"][t]["label"],
            "res": camp["topics"][t].get("res", []),
            "build": camp["topics"][t].get("build"),
            "gists": camp["topics"][t].get("gists"),
        } for t in idx]
        weeks.append({
            "index": w,
            "weekNo": w + 1,
            "campId": camp_id,
            "campAlt": camp["alt"],
            "campTitle": camp["title"],
            "topics": topics,
            "campFinalWeek": half == 1,
            "hasQuiz": any(q["stage"] == camp_id for q in quizzes),
        })
    return {"id": topic_id, "name": TRACK_NAMES.get(topic_id, topic_id), "camps": camps, "weeks": weeks}
