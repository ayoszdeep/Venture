# Waygood Study Abroad — Backend Assignment

**Repository:** https://github.com/ayoszdeep/Venture

A study-abroad platform backend: students discover universities, compare programs, get recommendations, and track their application through to enrolment. Node.js + Express + MongoDB, with the React dashboard wired to the real endpoints.

All 6 required tasks are done, plus all 4 bonus tasks. 26 Jest/Supertest tests pass.

---

## 1. Setup

You need Node 18+ and MongoDB (local or an Atlas URI).

```bash
# backend
cd backend
npm install
cp .env.example .env     # then fill in the values below
npm run seed             # loads universities, programs, students, applications

# frontend (separate terminal)
cd frontend
npm install
```

### Environment variables

Everything lives in `backend/.env`. Only the first two really matter — the rest have sensible defaults.

| Variable | Needed? | Default | What it does |
|---|---|---|---|
| `MONGODB_URI` | **Yes** | `mongodb://127.0.0.1:27017/waygood-evaluation` | Where the data lives. Local Mongo or an Atlas connection string. |
| `JWT_SECRET` | **Yes** | `dev-secret` | Signs the login tokens. Any long random string. |
| `PORT` | No | `4000` | Backend port. |
| `JWT_EXPIRES_IN` | No | `1d` | How long a login lasts. |
| `CACHE_TTL_SECONDS` | No | `300` | How long cached responses stay fresh. |
| `GROQ_API_KEY` | No | empty | Turns on real AI study plans. **Leave it empty and nothing breaks** — the AI endpoint falls back to a rule-based plan. |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Which Groq model to use. |
| `REDIS_URL` | No | empty | Not used yet. Placeholder for swapping the cache to Redis. |

A minimal working `.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/waygood-evaluation
JWT_SECRET=any-long-random-string
```

---

## 2. Run it

```bash
cd backend && npm run dev      # http://localhost:4000
cd frontend && npm run dev     # http://localhost:5173
cd backend && npm test         # 26 tests
```

Or the whole stack (Mongo included) in Docker:

```bash
docker compose up --build
docker compose exec backend npm run seed   # first run only
```

### Login details (from the seed)

| Role | Email | Password |
|---|---|---|
| Student | `aarav@example.com` | `Candidate123!` |
| Student | `sara@example.com` | `Candidate123!` |
| Counselor | `counselor@example.com` | `Candidate123!` |

Students see only their own data. Counselors can see everyone's and are the only ones who can move an application forward.

---

## 3. What I built

Short version of each piece: what it does, how I checked it, and why I did it that way.

### Auth (`/api/auth`)

Register, login, and a protected `GET /api/auth/me`. Passwords are bcrypt-hashed in a Mongoose `pre("save")` hook, so hashing can't be forgotten at a call site. Tokens are JWTs, verified on every request against a live DB lookup.

**Tested with:** `npm test`

```
POST /api/auth/register  201   → token returned, password field absent
POST /api/auth/register  409   → duplicate email rejected
POST /api/auth/register  400   → password under 8 chars rejected
POST /api/auth/login     401   → wrong password rejected
GET  /api/auth/me        401   → no token rejected
```

**Why:** registration hard-codes `role: "student"`. If the role came from the request body, anyone could register themselves as a counselor and start approving applications.

### Discovery (`/api/universities`, `/api/programs`)

Filter by country, field, degree level, intake, budget, scholarship, plus free-text search. Sorting and pagination on both.

**Tested with:** `curl "localhost:4000/api/programs?country=Canada&maxBudget=30000&sortBy=tuitionAsc&limit=3"`

```
meta: {"page":1,"limit":3,"total":3,"totalPages":1}
Graduate Certificate in Project Management | $14800
Master of Engineering Management          | $21400
Master of Applied Computing               | $22800
```

**Why:** every response is the same shape — `{ success, data, meta }` — so the frontend never has to special-case an endpoint. `limit` is capped at 50 server-side so no client can ask for the whole collection, and every sort ends with `_id` as a tiebreaker, otherwise documents with equal tuition can shuffle between pages and you'd see the same program twice.

### Recommendations (`/api/recommendations/:studentId`)

One MongoDB aggregation pipeline. It matches on the student's target countries, joins the university, then scores each program and returns the top 5 with the reasons it matched.

Weights: country 35, field 30, budget 20, intake 10, IELTS 5.

**Tested with:** `npm test` + a live call for `aarav@example.com`

```json
{
  "title": "BSc Computer Science",
  "universityName": "Heriot-Watt University Dubai",
  "matchScore": 100,
  "reasons": [
    "Preferred country match: UAE",
    "Field alignment: Computer Science",
    "Tuition is within your budget",
    "Preferred intake available: September",
    "English test score meets requirement"
  ]
}
```

**Why:** the scoring happens inside MongoDB (`$addFields`, `$cond`, `$filter`), not in Node. Pulling every program into memory to sort it there would stop working the moment the catalogue grows. The `$match` on country runs *before* the `$lookup`, so the join only touches programs that already passed the filter. And each result carries its own `reasons` — a student asking "why this one?" deserves an answer, not a number.

### Applications (`/api/applications`)

Apply to a program, then move through: `draft → submitted → under-review → offer-received → visa-processing → enrolled`, with `rejected` reachable from any live stage. `enrolled` and `rejected` are final. Every change appends to a `timeline` array with who, when, and a note.

**Tested with:** `npm test`

```
POST  /api/applications               201  → timeline has 1 entry
POST  /api/applications               409  → duplicate (same student+program+intake)
PATCH /api/applications/:id/status    403  → student tried to approve their own
PATCH /api/applications/:id/status    400  → "Cannot transition from submitted to enrolled"
PATCH /api/applications/:id/status    200  → counselor moved it, timeline now has 2 entries
```

**Why two duplicate checks:** the code checks first so the student gets a readable message, but a unique index on `{ student, program, intake }` backs it up. Two near-simultaneous clicks would both pass the code check and both insert — the index is what actually makes that impossible, and the `11000` error is caught and returned as a clean 409.

**Why a transition table instead of just saving the status:** without it an application could jump from `submitted` straight to `enrolled` and skip the visa stage entirely. The valid moves live in one place, [`config/constants.js`](backend/src/config/constants.js), so the rules are readable rather than scattered through if-statements.

### Performance

Indexes on the fields that actually get queried, and an in-memory TTL cache for the expensive read-only endpoints.

**Tested with:** two back-to-back calls to `/api/universities/popular`

```
GET /api/universities/popular  200  88.855 ms   ← miss, hit the database
GET /api/universities/popular  200   1.817 ms   ← hit, served from cache
```

Indexes:

| Collection | Index | For |
|---|---|---|
| Student | `email` (unique), `role` | login, role checks |
| University | `{ popularScore: -1, qsRanking: 1 }`, text index | `/popular` sorts straight off the index |
| Program | `{ country, degreeLevel, field, tuitionFeeUsd }`, `{ intakes, tuitionFeeUsd }`, text index | the discovery filters |
| Application | `{ student, program, intake }` **unique**, `{ student, status }`, `{ status, createdAt: -1 }` | duplicate guard, dashboards |

Other query work: `.lean()` on read-only paths to skip document hydration, `.populate()` with explicit field lists instead of whole documents, and `find()` + `countDocuments()` fired in parallel with `Promise.all` rather than one after the other.

**Why cache invalidation and not just TTL:** the dashboard cache is dropped the moment an application is created or updated. A counselor who just approved something and sees stale counts assumes the app is broken, and a 5-minute TTL is too long to wait to find out it isn't.

### Tests

26 Jest + Supertest tests against a seeded database, covering happy paths and the edge cases — duplicates, bad transitions, wrong roles, missing tokens, malformed IDs.

**Tested with:** `npm test`

```
Test Suites: 1 passed, 1 total
Tests:       26 passed, 26 total
Time:        14.974 s
```

**Why `--runInBand`:** the tests share seeded fixtures and some assert on cache state. Run in parallel they'd race each other and fail for reasons that have nothing to do with the code.

---

## 4. Bonus tasks

### AI study planner (`GET /api/ai/study-plan/:studentId`)

Returns a phased plan: shortlist strategy (ambitious / balanced / safe), a month-by-month timeline, test prep, budget notes, and risks.

The important bit: **the AI never queries the database.** The aggregation pipeline picks the programs first, and only that shortlist plus the student's profile goes to the model. The prompt forbids mentioning any university, tuition figure or IELTS requirement that isn't in the data it was handed.

**Tested with:** a live call as `aarav@example.com`

```
meta: { "generator": "groq:openai/gpt-oss-120b",
        "groundedOn": "mongodb-aggregation-pipeline",
        "shortlistSize": 5, "cache": "miss" }

summary: "You have strong alignment with both UAE and Canada options, meeting
          IELTS requirements and staying under your $23,000 budget..."
```

Plus a test asserting the fallback planner never names a program outside the shortlist.

**Why grounded this way:** an LLM asked to pick universities will confidently invent them, or quote a tuition fee that's close but wrong. A student could plan their finances around that. Keeping the model to explaining and sequencing a list the database already chose means the facts are always real and the ranking stays reproducible.

**Why it degrades instead of failing:** no API key, a provider outage, or a response over 20s all produce the rule-based plan instead of a 500, and `meta.generator` says which path ran (`groq:<model>` or `rule-based-fallback`). A third-party being down shouldn't take an endpoint of mine down with it. It's also why the whole thing works with no key at all.

Plans are cached per student — this is the slowest and only paid call in the API, so it's the one most worth caching. `?refresh=true` forces a regeneration.

### Docker

`docker compose up --build` brings up Mongo, the API, and the dashboard behind nginx. Backend image is `node:20-alpine`, runs as the non-root `node` user, has a healthcheck on `/api/health`, and the backend waits on Mongo's own healthcheck rather than a sleep. Frontend is a multi-stage build so Node and the source never ship in the final image.

**Tested with:** `docker compose config` (valid) and `npm ci --omit=dev` against the backend lockfile (installs 124 prod packages, 0 vulnerabilities, dev deps correctly excluded). I validated the config and the dependency install; the image build itself should be run on your machine with Docker running.

**Why a separate backend lockfile:** npm workspaces keeps one lockfile at the repo root, so `npm ci` inside the backend image had nothing to resolve against and the build would have failed. The backend now has its own lockfile, which also keeps the image build reproducible.

### Security

| What | Why |
|---|---|
| Helmet | Sets HSTS, `nosniff`, `X-Frame-Options`, and drops `X-Powered-By` so the stack isn't advertised. |
| `express-mongo-sanitize` | Strips `$` operators from input. Without it, logging in with `{"email": {"$ne": null}}` matches the first student in the collection — a full auth bypass. |
| Rate limiting, 3 tiers | Auth 20/15min, API 300/15min, AI 30/hour. One blanket limit would be too loose for login and too tight for browsing. Successful logins don't count against the auth limit, so a legitimate user never gets locked out. The AI tier exists because that endpoint costs money per call. |
| 100kb body cap | This API never needs large payloads, and the cap removes a cheap way to exhaust memory. |
| `trust proxy` | So rate limits key off the real client IP behind a load balancer, not the proxy's. |

**Tested with:** `curl -D - localhost:4000/api/health` and 2 tests

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
RateLimit-Policy: 300;w=900
```

The injection test confirms `{"email": {"$ne": null}}` gets rejected rather than logged in. Rate limiting and request logging are off when `NODE_ENV=test` so the suite stays repeatable.

### React dashboard

Live platform totals, a **Program Explorer** driving the real `/api/programs` with filters, sorting and pagination, and a **study planner** panel that logs in and renders the generated plan.

**Tested with:** `npm run build` (clean, 32 modules) and clicking through it against the running backend.

**Why:** the dashboard originally rendered static sample data, which proves nothing. Driving the actual endpoints means the response shapes are verified by something other than tests.

---

## 5. Notes & assumptions

1. **Roles are just `student` and `counselor`.** Counselors come from the seed, never from public registration.
2. **Only counselors advance an application.** Students submit; `enrolled` and `rejected` are final, and reopening means a new application.
3. **A duplicate is the same `(student, program, intake)`.** Applying to the same program for a *different* intake is allowed on purpose — it's a normal thing for a student to do.
4. **Intakes are free-text strings** (`"September"`) as they come from the seed data, not a fixed calendar. Matching is case-insensitive.
5. **Recommendations return the top 5.** The weights encode a product assumption: destination and field matter more than intake timing or spare IELTS points.
6. **Budget means tuition only.** Living costs and visa fees show up as advice in the study plan but aren't scored.
7. **Single instance assumed** for the cache and rate-limit counters — both are in-memory. For multiple replicas they'd move to Redis; the interfaces wouldn't change.
8. **Seed first.** The tests and the dashboard both expect seeded data. `npm run seed` is safe to re-run.
9. **The dashboard's planner panel prefills the seeded student's login** so you can click it without typing. The token is kept in component state only, never in `localStorage`.
10. **No secrets in the repo.** `backend/.env` is gitignored; `.env.example` lists every variable with no values. Add your own `GROQ_API_KEY` to see real AI plans — or don't, and the fallback planner answers instead.

---

## 6. Layout

```
backend/src
  config/       env, constants (status transition table)
  controllers/  request handling and validation
  services/     recommendation pipeline, cache, AI planner
  models/       Mongoose schemas and indexes
  middleware/   auth, roles, rate limiting, errors
  routes/       endpoint wiring
  data/         seed data
frontend/src    React dashboard
docker-compose.yml
```

Controllers handle HTTP, services hold the logic worth testing on its own. The recommendation pipeline and the AI planner are services for exactly that reason — the fallback planner is unit-tested without going through an HTTP request at all.
