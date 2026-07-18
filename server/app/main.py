"""FastAPI backend for the clpr webapp.

Content endpoints serve the learning tracks, quizzes (grading fields stripped),
genres, tree, friends and race times. State endpoints persist per-user progress,
journal entries, quiz attempts, XP ledger and comments, and expose derived stats
and the leaderboard. The server owns scoring: it grades numeric/free answers and
computes XP authoritatively.
"""

from __future__ import annotations

import time
from typing import Any

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from . import auth, cache, content as data, db, device, grading, schemas, security, seed
from .auth import current_user
from .gists import store as gist_store
from .gists import api as gists_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables, seed content once, then load content from the tables.
    db.init_schema()
    seed.seed_if_empty()
    data.load()
    yield


app = FastAPI(
    title="clpr backend",
    version="1.0.0",
    lifespan=lifespan,
    # Guards run on every path operation: shared-secret gate, then rate limit.
    dependencies=[Depends(security.require_api_key), Depends(security.rate_limit)],
)

# The browser normally only hits the Next origin (same-origin /api rewrites), so CORS
# rarely applies — but allow the deployed frontend origin too, for direct calls.
_allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if auth.OAUTH_REDIRECT_BASE and auth.OAUTH_REDIRECT_BASE not in _allowed_origins:
    _allowed_origins.append(auth.OAUTH_REDIRECT_BASE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Signs the session cookie that carries the logged-in user id. SameSite=Lax so the
# cookie survives the top-level redirect back from the OAuth provider.
app.add_middleware(
    SessionMiddleware,
    secret_key=auth.SESSION_SECRET,
    same_site="lax",
    https_only=auth.SESSION_HTTPS_ONLY,
)

app.include_router(auth.router)
app.include_router(device.router)
app.include_router(gists_api.router)


# --------------------------- content (read-only) ---------------------------

@app.api_route("/api/health", methods=["GET", "HEAD"])
def health() -> dict[str, Any]:
    # HEAD too, so uptime monitors that ping with HEAD don't get a 405.
    return {"ok": True, "totalTopics": data.TOTAL_TOPICS, "stages": len(data.roadmap)}


@app.get("/api/genres")
def genres() -> list[dict[str, Any]]:
    return data.genres


@app.get("/api/tree")
def tree() -> dict[str, Any]:
    return data.csTree


@app.get("/api/friends")
def friends() -> list[dict[str, Any]]:
    return data.friends


@app.get("/api/races")
def races() -> dict[str, Any]:
    return {str(k): v for k, v in data.raceTimes.items()}


@app.get("/api/content")
def content() -> dict[str, Any]:
    """Everything the frontend needs to render, in one call. No hardcoded content
    lives in the client: roadmap, quizzes (grading stripped), tree, worlds, genres,
    friends, global users, race times, and the garage/materials tables."""
    return {
        "roadmap": data.roadmap,
        "totalTopics": data.TOTAL_TOPICS,
        # Full quizzes: the client grades each question in-browser for instant
        # feedback. The /api/quizzes/{stage}/attempt endpoint stays authoritative
        # for XP and state. (For answer secrecy, switch this to public_quiz and
        # move per-question grading to the server.)
        "quizzes": data.quizzes,
        "tree": data.csTree,
        "worlds": data.worlds,
        "genres": data.genres,
        "friends": data.friends,
        "globalUsers": data.global_users,
        "races": {str(k): v for k, v in data.raceTimes.items()},
        "materials": data.materials,
        "campMaterials": data.camp_materials,
        "artifacts": data.artifacts,
    }


@app.get("/api/roadmap")
def roadmap() -> list[dict[str, Any]]:
    return data.roadmap


@app.get("/api/worlds")
def worlds() -> list[dict[str, Any]]:
    return data.worlds


@app.get("/api/artifacts")
def artifacts() -> list[dict[str, Any]]:
    return data.artifacts


@app.get("/api/global-users")
def global_users() -> list[dict[str, Any]]:
    return data.global_users


@app.get("/api/users/{username}")
def public_garage(username: str) -> dict[str, Any]:
    """Public garage of any user, by username: profile + a sanitized state (no
    private journal notes or comments). Powers /garage/<username>."""
    result = db.public_garage(username)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No user {username}")
    return result


@app.get("/api/track/{topic_id}")
def track(topic_id: str) -> dict[str, Any]:
    return data.get_track(topic_id)


@app.get("/api/concepts/{stage}/{topic}/gists")
def concept_gists(stage: int, topic: int) -> dict[str, Any]:
    """All AI reading modes for one concept (topic), keyed the way the frontend
    addresses topics: (stage_idx, topic_idx). 404 if the topic doesn't exist;
    an empty `modes` map means gists haven't been generated for it yet."""
    result = gist_store.get_gists(stage, topic)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No concept s{stage}t{topic}")
    return result


@app.get("/api/quizzes")
def quizzes() -> list[dict[str, Any]]:
    return [schemas.public_quiz(q) for q in data.quizzes]


@app.get("/api/quizzes/{stage}")
def quiz(stage: int) -> dict[str, Any]:
    q = data.quiz_for_stage(stage)
    if q is None:
        raise HTTPException(status_code=404, detail=f"No quiz for stage {stage}")
    return schemas.public_quiz(q)


# --------------------------- user state ---------------------------

@app.get("/api/state")
def get_state(user: str = Depends(current_user)) -> dict[str, Any]:
    return db.load(user)


@app.get("/api/stats")
def get_stats(user: str = Depends(current_user)) -> dict[str, Any]:
    return grading.stats(db.load(user))


@app.get("/api/leaderboard")
def get_leaderboard(user: str = Depends(current_user)) -> list[dict[str, Any]]:
    board = cache.get_json("lb:board")
    if board is None:
        board = grading.rank_board(db.leaderboard_data())
        cache.set_json("lb:board", board, ttl=30)
    return grading.mark_me(board, user)


@app.get("/api/races/live")
def get_races_live(user: str = Depends(current_user)) -> dict[str, Any]:
    races = cache.get_json("lb:races")
    if races is None:
        races = grading.rank_races(db.races_data())
        cache.set_json("lb:races", races, ttl=30)
    return grading.mark_me_races(races, user)


@app.post("/api/state/reset")
def reset_state(user: str = Depends(current_user)) -> dict[str, Any]:
    return db.reset(user)


@app.put("/api/progress")
def toggle_topic(body: schemas.ToggleTopicIn, user: str = Depends(current_user)) -> dict[str, Any]:
    if not (0 <= body.stage < len(data.roadmap)):
        raise HTTPException(status_code=400, detail="stage out of range")
    if not (0 <= body.topic < len(data.roadmap[body.stage]["topics"])):
        raise HTTPException(status_code=400, detail="topic out of range")
    key = f"s{body.stage}t{body.topic}"

    def fn(doc: dict[str, Any]) -> None:
        progress = doc["progress"]
        if body.done is None:
            if progress.get(key):
                progress.pop(key, None)
            else:
                progress[key] = True
        elif body.done:
            progress[key] = True
        else:
            progress.pop(key, None)

    return db.mutate(user, fn)


@app.post("/api/entries")
def save_entry(body: schemas.EntryIn, user: str = Depends(current_user)) -> dict[str, Any]:
    def fn(doc: dict[str, Any]) -> None:
        # A check-in is just minutes used + an optional summary. Completing a read in
        # the client upserts this automatically; the form is only for the summary.
        doc["entries"][body.date] = {"mins": body.mins, "summary": body.summary}

    return db.mutate(user, fn)


@app.delete("/api/entries/{date_iso}")
def delete_entry(date_iso: str, user: str = Depends(current_user)) -> dict[str, Any]:
    def fn(doc: dict[str, Any]) -> None:
        doc["entries"].pop(date_iso, None)

    return db.mutate(user, fn)


@app.put("/api/start-date")
def set_start_date(body: schemas.StartDateIn, user: str = Depends(current_user)) -> dict[str, Any]:
    def fn(doc: dict[str, Any]) -> None:
        doc["startDate"] = body.startDate

    return db.mutate(user, fn)


@app.post("/api/comments")
def add_comment(body: schemas.CommentIn, user: str = Depends(current_user)) -> dict[str, Any]:
    def fn(doc: dict[str, Any]) -> None:
        c = {"id": int(time.time() * 1000), "author": body.author, "text": body.text,
             "at": _now_iso()}
        doc["comments"].setdefault(body.key, []).append(c)

    return db.mutate(user, fn)


@app.post("/api/artifacts")
def build_artifact(body: schemas.BuildArtifactIn, user: str = Depends(current_user)) -> dict[str, Any]:
    art = data.ARTIFACTS_BY_ID.get(body.id)
    if art is None:
        raise HTTPException(status_code=404, detail=f"No artifact {body.id}")
    doc = db.load(user)
    if body.id not in doc["artifacts"] and grading.highest_stage_cleared(doc["attempts"]) < art["req"]:
        raise HTTPException(status_code=400, detail="artifact requirement not met")

    def fn(d: dict[str, Any]) -> None:
        if body.id not in d["artifacts"]:
            d["artifacts"].append(body.id)

    return db.mutate(user, fn)


# --------------------------- quiz attempts (authoritative scoring) ---------------------------

@app.post("/api/quizzes/{stage}/attempt")
def submit_attempt(stage: int, body: schemas.AttemptIn, user: str = Depends(current_user)) -> dict[str, Any]:
    quiz = data.quiz_for_stage(stage)
    if quiz is None:
        raise HTTPException(status_code=404, detail=f"No quiz for stage {stage}")

    questions = quiz["questions"]
    by_index = {r.index: r for r in body.responses}
    grades: list[dict[str, Any]] = []
    for i, q in enumerate(questions):
        r = by_index.get(i)
        resp = {"value": r.value, "frac": r.frac, "pass": r.passed, "msg": r.msg} if r else {}
        grades.append(grading.grade_response(q, resp))

    score, passed = grading.aggregate(questions, grades)

    result: dict[str, Any] = {}

    def fn(doc: dict[str, Any]) -> None:
        first_clear = passed and not grading.clpr_cleared(doc["attempts"], stage)
        # XP is derived from state (see grading.total_xp); attempt.xp is just what this
        # attempt earned, for the result screen — a flat quiz award on first clear.
        xp = grading.XP_QUIZ if first_clear else 0
        at = _now_iso()
        attempt = {
            "id": int(time.time() * 1000), "stage": stage, "score": score,
            "passed": passed, "timeMs": body.timeMs, "xp": xp,
            "firstClear": first_clear, "at": at,
        }
        doc["attempts"].append(attempt)
        result["attempt"] = attempt

    state = db.mutate(user, fn)
    return {
        "attempt": result["attempt"],
        "score": score,
        "passed": passed,
        "grades": grades,
        "stats": grading.stats(state),
    }


def _now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
