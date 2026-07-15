# clpr backend

FastAPI service for the clpr learning tracker. It serves all learning content
(roadmap, quizzes, genres, tree, worlds, friends, race times, garage/materials) and
persists per-user state (progress, journal entries, quiz attempts, XP ledger,
comments, built artifacts) in **Postgres**. The Next.js app is fully wired to it:
nothing is hardcoded on the client. Scoring is authoritative on the server: numeric
and free-response answers are graded here and XP is computed here.

## Run

Postgres runs in Docker; the API runs with uv.

```bash
cd server
docker compose up -d          # Postgres 16 on localhost:5432 (db/user/pass = clpr)
uv sync                       # installs deps incl. psycopg
uv run uvicorn app.main:app --reload --port 8000
```

- Interactive docs: http://localhost:8000/docs
- Connection string defaults to `postgresql://clpr:clpr@localhost:5432/clpr`;
  override with `DATABASE_URL`.
- CORS is open to `http://localhost:3000` (the Next.js dev server).

## Data model

State mirrors the frontend `State` shape (`lib/store.ts`) exactly: `entries`,
`progress`, `startDate`, `attempts`, `ledger`, `comments`, `artifacts`. It is stored
as one `JSONB` document per user (`state(user_id, doc)`, default user `"me"`), so the
read/write path is identical to the client store. Mutations run inside a transaction
with `SELECT ... FOR UPDATE` so concurrent writes to one user serialize.

Static content lives in `app/data.py` and is served whole via `GET /api/content`,
which is the single call the frontend makes to hydrate all content.

## Endpoints

Pass `?user=<id>` on state endpoints (defaults to `me`).

### Content (read-only)
| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/content` | **everything the frontend needs, in one call** |
| GET | `/api/health` | service + topic count |
| GET | `/api/genres` | genre cards |
| GET | `/api/tree` | the compsci tree |
| GET | `/api/friends` | seed friends |
| GET | `/api/global-users` | world leaderboard seed |
| GET | `/api/races` | race times by stage |
| GET | `/api/roadmap` | the 8 stages |
| GET | `/api/worlds` | camps grouped into worlds |
| GET | `/api/artifacts` | garage upgrades |
| GET | `/api/track/{topic_id}` | camps + 16-week plan (`getTrack`) |
| GET | `/api/quizzes` | all quizzes, **grading fields stripped** |
| GET | `/api/quizzes/{stage}` | one quiz, grading fields stripped |

Note: `/api/content` returns **full** quizzes (with grading fields) so the client can
grade each question in-browser for instant feedback; `/api/quizzes*` keep the stripped
shape. XP/state remain authoritative via the attempt endpoint.

### State
| Method | Path | Body | Effect |
| --- | --- | --- | --- |
| GET | `/api/state` | | full state doc |
| GET | `/api/stats` | | derived: streak, altitude, xp, rank, per-stage |
| GET | `/api/leaderboard` | | friends + you, ranked by xp |
| PUT | `/api/progress` | `{stage, topic, done?}` | toggle/set a topic (`done` omitted = toggle) |
| POST | `/api/entries` | `{date, focus, conf, mins, summary, notes}` | upsert a daily check-in |
| DELETE | `/api/entries/{date}` | | remove a check-in |
| PUT | `/api/start-date` | `{startDate}` | set the plan start date |
| POST | `/api/comments` | `{key, text, author?}` | append a comment |
| POST | `/api/artifacts` | `{id}` | build a garage artifact (req-gated) |
| POST | `/api/state/reset` | | wipe this user's state |
| POST | `/api/quizzes/{stage}/attempt` | see below | grade, record attempt, award XP |

Every mutating endpoint returns the updated state doc (the attempt endpoint returns
the attempt + grades + fresh stats), so the client can replace its store in one hop.

## Quiz grading and the code trust boundary

`POST /api/quizzes/{stage}/attempt` body:

```json
{
  "timeMs": 42000,
  "responses": [
    { "index": 0, "value": "100" },
    { "index": 1, "frac": 1.0, "pass": true },
    { "index": 2, "value": "attention relates any two positions in one parallel step..." }
  ]
}
```

- **numeric** and **free** questions are graded on the server from `value`; their
  answers/keywords are never sent to the client (see `public_quiz` in `schemas.py`).
- **code** questions run arbitrary JavaScript, which only the browser can execute.
  The client runs the hidden tests (still shipped for code questions) and posts its
  `{frac, pass}`; the server trusts it for that one question. Weighting
  (`full`=1, `reduced`=0.4), the 0.7 pass threshold, XP and the ledger are all
  computed server-side and are authoritative.

## Wiring the frontend

The Next.js app is wired to this backend:

- The RSC layout (`app/layout.tsx`) fetches `GET /api/content` server-side and
  injects it via `<Bootstrap>` into `lib/content.ts` (context + a module handle the
  store selectors read). `lib/data.ts` is now types-only.
- `lib/store.ts` loads state from `GET /api/state` and routes every mutation through
  the matching POST/PUT endpoint, replacing its state from the response.
- Quizzes grade in-browser for instant feedback, then `recordAttempt` posts to
  `/api/quizzes/{stage}/attempt` so XP and the ledger are computed authoritatively.
- Base URL: client uses `NEXT_PUBLIC_API_URL`, the server layout uses `API_URL`
  (both default to `http://127.0.0.1:8000`).
```
