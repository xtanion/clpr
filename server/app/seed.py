"""Seed the content tables from app/data.py (the initial-content definition).

Idempotent: does nothing if the curriculum is already present. data.py is only
used here; at runtime everything is read from the tables (see content.py).
"""

from __future__ import annotations

from typing import Any

from psycopg.types.json import Json

from . import data, db


def _seed_tree(conn, node: dict[str, Any], parent_id: str | None, ord_: int) -> None:
    conn.execute(
        "INSERT INTO tree_nodes (id, parent_id, label, climb, ord) VALUES (%s, %s, %s, %s, %s)",
        (node["id"], parent_id, node["label"], node.get("climb"), ord_),
    )
    for i, child in enumerate(node.get("children", []) or []):
        _seed_tree(conn, child, node["id"], i)


def seed_if_empty() -> None:
    with db.pool().connection() as conn:
        with conn.transaction():
            (count,) = conn.execute("SELECT COUNT(*) FROM stages").fetchone()
            if count:
                return

            # stages / topics / resources
            for si, stage in enumerate(data.roadmap):
                conn.execute(
                    "INSERT INTO stages (idx, alt, title, blurb) VALUES (%s, %s, %s, %s)",
                    (si, stage["alt"], stage["title"], stage["blurb"]),
                )
                for ti, topic in enumerate(stage["topics"]):
                    (tid,) = conn.execute(
                        "INSERT INTO topics (stage_idx, idx, label, build) VALUES (%s, %s, %s, %s) RETURNING id",
                        (si, ti, topic["label"], bool(topic.get("build"))),
                    ).fetchone()
                    for ri, r in enumerate(topic.get("res", []) or []):
                        conn.execute(
                            "INSERT INTO resources (topic_id, ord, label, url, type) VALUES (%s, %s, %s, %s, %s)",
                            (tid, ri, r["label"], r["url"], r["type"]),
                        )

            # worlds
            for wi, w in enumerate(data.worlds):
                conn.execute("INSERT INTO worlds (id, name, ord) VALUES (%s, %s, %s)", (w["id"], w["name"], wi))
                for ci, camp in enumerate(w["camps"]):
                    conn.execute(
                        "INSERT INTO world_camps (world_id, stage_idx, ord) VALUES (%s, %s, %s)",
                        (w["id"], camp, ci),
                    )

            # tree
            _seed_tree(conn, data.csTree, None, 0)

            # genres
            for gi, g in enumerate(data.genres):
                conn.execute(
                    "INSERT INTO genres (id, name, descr, status, stages, topics, href, ord) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                    (g["id"], g["name"], g["desc"], g["status"], g["stages"], g["topics"], g.get("href"), gi),
                )

            # friends / global users
            for fi, f in enumerate(data.friends):
                conn.execute(
                    "INSERT INTO friends (handle, name, xp, stage, streak, ord) VALUES (%s, %s, %s, %s, %s, %s)",
                    (f["handle"], f["name"], f["xp"], f["stage"], f["streak"], fi),
                )
            for ui, u in enumerate(data.global_users):
                conn.execute(
                    "INSERT INTO global_users (handle, name, xp, stage, streak, ord) VALUES (%s, %s, %s, %s, %s, %s)",
                    (u["handle"], u["name"], u["xp"], u["stage"], u["streak"], ui),
                )

            # race times
            for stage_idx, runners in data.raceTimes.items():
                for ri, r in enumerate(runners):
                    conn.execute(
                        "INSERT INTO race_times (stage_idx, name, ms, score, ord) VALUES (%s, %s, %s, %s, %s)",
                        (stage_idx, r["name"], r["ms"], r["score"], ri),
                    )

            # garage: materials, camp materials, artifacts, costs
            for mi, m in enumerate(data.materials):
                conn.execute("INSERT INTO materials (id, name, ord) VALUES (%s, %s, %s)", (m["id"], m["name"], mi))
            for si, grant in enumerate(data.camp_materials):
                for mat, qty in grant.items():
                    conn.execute(
                        "INSERT INTO camp_materials (stage_idx, material_id, qty) VALUES (%s, %s, %s)",
                        (si, mat, qty),
                    )
            for ai, a in enumerate(data.artifacts):
                conn.execute(
                    "INSERT INTO artifacts (id, name, blurb, req, ord) VALUES (%s, %s, %s, %s, %s)",
                    (a["id"], a["name"], a["blurb"], a["req"], ai),
                )
                for mat, qty in a["cost"].items():
                    conn.execute(
                        "INSERT INTO artifact_costs (artifact_id, material_id, qty) VALUES (%s, %s, %s)",
                        (a["id"], mat, qty),
                    )

            # quizzes -> questions (+ tests / rubric / keywords)
            for quiz in data.quizzes:
                si = quiz["stage"]
                for qi, q in enumerate(quiz["questions"]):
                    (qid,) = conn.execute(
                        "INSERT INTO questions (stage_idx, idx, type, weight, prompt, hint, unit, answer, tolerance, signature, entry) "
                        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                        (
                            si, qi, q["type"], q["weight"], q["prompt"], q.get("hint", ""), q.get("unit", ""),
                            q.get("answer"), q.get("tolerance"), q.get("signature"), q.get("entry"),
                        ),
                    ).fetchone()
                    for i, t in enumerate(q.get("tests", []) or []):
                        conn.execute(
                            "INSERT INTO question_tests (question_id, ord, args, expected) VALUES (%s, %s, %s, %s)",
                            (qid, i, Json(t["args"]), Json(t["expected"])),
                        )
                    for i, text in enumerate(q.get("rubric", []) or []):
                        conn.execute(
                            "INSERT INTO question_rubric (question_id, ord, text) VALUES (%s, %s, %s)",
                            (qid, i, text),
                        )
                    for i, word in enumerate(q.get("keywords", []) or []):
                        conn.execute(
                            "INSERT INTO question_keywords (question_id, ord, word) VALUES (%s, %s, %s)",
                            (qid, i, word),
                        )
