"""Relational schema: all content and all user state live in normalized tables.

Content ("blueprints"/curriculum, quizzes, worlds, genres, friends, races,
garage materials + artifacts) and per-user state (notes/entries, progress,
attempts, XP ledger, comments, built artifacts) are each their own tables. The
old single-JSONB-blob `state` table is dropped.
"""

from __future__ import annotations

DDL = """
DROP TABLE IF EXISTS state;

-- ---------------- content: curriculum ("blueprints") ----------------
CREATE TABLE IF NOT EXISTS stages (
    idx   INTEGER PRIMARY KEY,
    alt   TEXT NOT NULL,
    title TEXT NOT NULL,
    blurb TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
    id        SERIAL PRIMARY KEY,
    stage_idx INTEGER NOT NULL REFERENCES stages(idx) ON DELETE CASCADE,
    idx       INTEGER NOT NULL,
    label     TEXT NOT NULL,
    build     BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (stage_idx, idx)
);

CREATE TABLE IF NOT EXISTS resources (
    id       SERIAL PRIMARY KEY,
    topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    ord      INTEGER NOT NULL,
    label    TEXT NOT NULL,
    url      TEXT NOT NULL,
    type     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worlds (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ord  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS world_camps (
    world_id  TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    stage_idx INTEGER NOT NULL,
    ord       INTEGER NOT NULL,
    PRIMARY KEY (world_id, stage_idx)
);

CREATE TABLE IF NOT EXISTS tree_nodes (
    id        TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES tree_nodes(id) ON DELETE CASCADE,
    label     TEXT NOT NULL,
    climb     TEXT,
    ord       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS genres (
    id     TEXT PRIMARY KEY,
    name   TEXT NOT NULL,
    descr  TEXT NOT NULL,
    status TEXT NOT NULL,
    stages INTEGER NOT NULL,
    topics INTEGER NOT NULL,
    href   TEXT,
    ord    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friends (
    handle TEXT PRIMARY KEY,
    name   TEXT NOT NULL,
    xp     INTEGER NOT NULL,
    stage  INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    ord    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS global_users (
    handle TEXT PRIMARY KEY,
    name   TEXT NOT NULL,
    xp     INTEGER NOT NULL,
    stage  INTEGER NOT NULL,
    streak INTEGER NOT NULL,
    ord    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS race_times (
    id        SERIAL PRIMARY KEY,
    stage_idx INTEGER NOT NULL,
    name      TEXT NOT NULL,
    ms        BIGINT NOT NULL,
    score     DOUBLE PRECISION NOT NULL,
    ord       INTEGER NOT NULL
);

-- ---------------- content: garage ----------------
CREATE TABLE IF NOT EXISTS materials (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ord  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS camp_materials (
    stage_idx   INTEGER NOT NULL,
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    qty         INTEGER NOT NULL,
    PRIMARY KEY (stage_idx, material_id)
);

CREATE TABLE IF NOT EXISTS artifacts (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    blurb TEXT NOT NULL,
    req   INTEGER NOT NULL,
    ord   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artifact_costs (
    artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    qty         INTEGER NOT NULL,
    PRIMARY KEY (artifact_id, material_id)
);

-- ---------------- content: quizzes ----------------
CREATE TABLE IF NOT EXISTS questions (
    id        SERIAL PRIMARY KEY,
    stage_idx INTEGER NOT NULL,
    idx       INTEGER NOT NULL,
    type      TEXT NOT NULL,
    weight    TEXT NOT NULL,
    prompt    TEXT NOT NULL,
    hint      TEXT NOT NULL DEFAULT '',
    unit      TEXT NOT NULL DEFAULT '',
    answer    DOUBLE PRECISION,
    tolerance DOUBLE PRECISION,
    signature TEXT,
    entry     TEXT,
    UNIQUE (stage_idx, idx)
);

CREATE TABLE IF NOT EXISTS question_tests (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    ord         INTEGER NOT NULL,
    args        JSONB NOT NULL,
    expected    JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS question_rubric (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    ord         INTEGER NOT NULL,
    text        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_keywords (
    id          SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    ord         INTEGER NOT NULL,
    word        TEXT NOT NULL
);

-- ---------------- content: AI gists ----------------
-- A "concept" is a topic. Its canonical knowledge (the structured intermediate
-- representation the gist generator works from) is one row here, and the reading
-- modes derived from it live in `gists`. content_hash is a hash of the generator
-- inputs (topic label + resources + generator version); a re-run skips a concept
-- whose hash is unchanged, and the same hash feeds later delta-update syncing.
CREATE TABLE IF NOT EXISTS concept_knowledge (
    topic_id         INTEGER PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
    problem          TEXT NOT NULL DEFAULT '',
    why_it_exists    TEXT NOT NULL DEFAULT '',
    intuition        TEXT NOT NULL DEFAULT '',
    tradeoffs        JSONB NOT NULL DEFAULT '[]',
    common_questions JSONB NOT NULL DEFAULT '[]',
    pitfalls         JSONB NOT NULL DEFAULT '[]',
    real_world_usage JSONB NOT NULL DEFAULT '[]',
    sources          JSONB NOT NULL DEFAULT '[]',
    version          TEXT NOT NULL DEFAULT '',
    content_hash     TEXT NOT NULL DEFAULT '',
    updated_at       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS gists (
    id           SERIAL PRIMARY KEY,
    topic_id     INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    mode         TEXT NOT NULL,  -- '30s' | '2min' | '5min' | 'deep' | 'cheatsheet'
    body         TEXT NOT NULL,  -- markdown
    meta         JSONB NOT NULL DEFAULT '{}',  -- reading_seconds, model, eval_score
    version      TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    updated_at   TEXT NOT NULL DEFAULT '',
    UNIQUE (topic_id, mode)
);

-- ---------------- user state ----------------
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    start_date TEXT NOT NULL DEFAULT '',
    email      TEXT,
    name       TEXT,
    username   TEXT,
    avatar_url TEXT,
    provider   TEXT,
    created_at TEXT NOT NULL DEFAULT ''
);

-- Backfill columns on databases created before auth was added.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS entries (
    user_id TEXT NOT NULL,
    date    TEXT NOT NULL,
    focus   INTEGER NOT NULL DEFAULT 0,
    conf    INTEGER NOT NULL DEFAULT 0,
    mins    TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    notes   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS progress (
    user_id TEXT NOT NULL,
    stage   INTEGER NOT NULL,
    topic   INTEGER NOT NULL,
    PRIMARY KEY (user_id, stage, topic)
);

CREATE TABLE IF NOT EXISTS attempts (
    id          BIGINT NOT NULL,
    user_id     TEXT NOT NULL,
    stage       INTEGER NOT NULL,
    score       DOUBLE PRECISION NOT NULL,
    passed      BOOLEAN NOT NULL,
    time_ms     BIGINT NOT NULL,
    xp          INTEGER NOT NULL,
    first_clear BOOLEAN NOT NULL,
    at          TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS ledger (
    id      SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    source  BIGINT NOT NULL,
    xp      INTEGER NOT NULL,
    at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
    id      BIGINT NOT NULL,
    user_id TEXT NOT NULL,
    key     TEXT NOT NULL,
    author  TEXT NOT NULL,
    text    TEXT NOT NULL,
    at      TEXT NOT NULL,
    PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS user_artifacts (
    user_id     TEXT NOT NULL,
    artifact_id TEXT NOT NULL,
    PRIMARY KEY (user_id, artifact_id)
);

-- ---------------- headless auth (device authorization grant) ----------------
-- A terminal client starts a device flow (device_codes row, status 'pending'),
-- the user approves it in the browser (status 'approved', uid bound), and the
-- client polls to exchange it for a long-lived personal token (status 'consumed').
CREATE TABLE IF NOT EXISTS device_codes (
    device_code TEXT PRIMARY KEY,
    user_code   TEXT NOT NULL,
    uid         TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|denied|consumed
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_tokens (
    token_hash   TEXT PRIMARY KEY,   -- sha256 hex of the opaque bearer token
    uid          TEXT NOT NULL,
    label        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    last_used_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS personal_tokens_uid_idx ON personal_tokens (uid);
"""
