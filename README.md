# Waygood Study Abroad — Backend Assignment

**Repository:** https://github.com/ayoszdeep/Venture

A study-abroad platform backend: students discover universities, compare programs, get recommendations, and track their application through to enrolment. Node.js + Express + MongoDB, with the React dashboard wired to the real endpoints.

All 6 required tasks are done, plus all 4 bonus tasks. 35 Jest/Supertest tests pass.

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
| `LOG_LEVEL` | No | `info` | Winston log level: `error`, `warn`, `info`, `debug`. |
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
cd backend && npm test         # 35 tests
```

Endpoints are versioned: `/api/v1/...` and `/api/v2/...`. The old unprefixed paths (`/api/programs`) still work and point at v1.

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

### Versioned routes (`routes/v1`, `routes/v2`)

Each version is a folder with an `index.js` that mounts that version's resources. `routes/index.js` mounts the versions themselves, so `app.js` has one line of routing and doesn't need to know how many versions exist.

```
routes/
  index.js        mounts /v1, /v2, and the legacy unprefixed paths
  v1/index.js     health, auth, universities, programs, recommendations,
  v1/*Routes.js   applications, dashboard, ai
  v2/index.js     programs (new contract) + the rest reused from v1
  v2/programRoutes.js
```

**Tested with:** `npm test` — 4 tests covering v1, v2, the legacy alias, and a 404

```
GET /api/v1/programs    200  → offset pagination, meta.page present
GET /api/programs       200  → identical results to v1 (legacy alias)
GET /api/v2/universities 200 → served by the v1 handler
GET /api/v2/nonexistent 404
```

**Why v2 only re-implements programs:** v2 serves `/programs` from its own controller and everything else from the v1 router. Copying unchanged handlers into a v2 folder is how two versions of the same endpoint slowly start behaving differently for no reason. When a resource actually changes, it gets its own file in `v2/` and the v1 line is removed.

**Why the unprefixed paths still work:** `/api/programs` shipped before versioning existed. Breaking those URLs to tidy the routing table would be a bad trade, so they're an alias for v1.

### Repository layer (`repositories/`)

Every Mongoose call in the codebase lives in this folder — one file per collection, plus an `index.js`. Controllers and services import repositories, never models.

**Tested with:** `npm test` (all 35 pass after the move) plus a grep that nothing outside the folder touches a model:

```
$ grep -rn "require(.*models/" src --include=*.js | grep -v "^src/models/" | grep -v "^src/repositories/"
NONE - all DB access goes through repositories
```

**Why:** a controller should read as "validate input, call this, shape the response" without the reader needing to know MongoDB. It also puts each collection's query details in one place — the `populate` field lists, `.lean()` calls, and the parallel count+fetch pattern are decisions made once per collection instead of being retyped at each call site. The status transition is a good example: `appendStatusTransition` does the `$set` and the timeline `$push` in one atomic update, so the status and its audit entry can't disagree the way a read-modify-write pair could.

Read paths return `.lean()` objects. `findByEmail` and `create` deliberately return real Mongoose documents, because the password-hashing hook and `comparePassword()` live on the model.

### Logging (Winston)

One structured line per request, logged on response finish so the status and duration are known. Server errors log at `error` with a stack, client errors at `warn`, and the error handler passes the rejection reason to the request logger so a failed request produces one line, not two. Dev prints a readable line; production prints JSON; tests are silent.

**Tested with:** `node src/server.js`, then a few requests

```
23:40:43 info  GET /api/v1/programs?limit=2 200 71.6ms {"method":"GET","status":200,"durationMs":71.6,"ip":"::1"}
23:40:43 warn  GET /api/v2/programs?cursor=garbage 400 2.6ms {"status":400,"reason":"Invalid cursor. Pass the `nextCursor` value..."}
23:40:43 warn  Login attempt for unknown email {"email":"nope@example.com"}
```

And with `NODE_ENV=production`:

```json
{"durationMs":1.5,"ip":"::1","level":"warn","message":"GET /api/v2/programs?cursor=bad 400 1.5ms","reason":"Invalid cursor...","status":400,"timestamp":"2026-10-12T18:13:00.821Z"}
```

**Why JSON in production:** a log shipper can index `status`, `durationMs` and `reason` as fields. Grepping a formatted message string for the same information works until the message wording changes.

**Why silent in tests:** 35 tests' worth of request logs bury the actual test output.

**Why failed logins log at `warn`:** repeated misses from one IP are the signature of credential stuffing, which is what the auth rate limiter caps. That's worth being able to query for.

### Auth (`/api/v1/auth`)

Register, login, and a protected `GET /api/auth/me`. Passwords are bcrypt-hashed in a Mongoose `pre("save")` hook, so hashing can't be forgotten at a call site. Tokens are JWTs, verified on every request against a live DB lookup.

**Tested with:** `npm test`

```
POST /api/v1/auth/register  201   → token returned, password field absent
POST /api/v1/auth/register  409   → duplicate email rejected
POST /api/v1/auth/register  400   → password under 8 chars rejected
POST /api/v1/auth/login     401   → wrong password rejected
GET  /api/v1/auth/me        401   → no token rejected
```

**Why:** registration hard-codes `role: "student"`. If the role came from the request body, anyone could register themselves as a counselor and start approving applications.

### Discovery (`/api/v1/universities`, `/api/v1/programs`)

Filter by country, field, degree level, intake, budget, scholarship, plus free-text search. Sorting and pagination on both.

**Tested with:** `curl "localhost:4000/api/v1/programs?country=Canada&maxBudget=30000&sortBy=tuitionAsc&limit=3"`

```
meta: {"page":1,"limit":3,"total":3,"totalPages":1}
Graduate Certificate in Project Management | $14800
Master of Engineering Management          | $21400
Master of Applied Computing               | $22800
```

**Why:** every response is the same shape — `{ success, data, meta }` — so the frontend never has to special-case an endpoint. `limit` is capped at 50 server-side so no client can ask for the whole collection, and every sort ends with `_id` as a tiebreaker, otherwise documents with equal tuition can shuffle between pages and you'd see the same program twice.

Filter and sort building lives in `services/discoveryService.js` so v1 and v2 apply identical filters — two copies of that logic in two controllers is how versions quietly drift apart.

### Discovery v2 — cursor pagination (`/api/v2/programs`)

Same filters, different pagination. `?cursor=<nextCursor>&limit=10` instead of `?page=2`, and the response carries `nextCursor` / `hasMore` instead of `page` / `total` / `totalPages`. Sorts: `tuitionAsc` (default), `tuitionDesc`, `name`, `ielts`, `newest`.

**Tested with:** 6 tests, including one that walks the whole collection two at a time and compares it against the same set fetched in a single request

```
GET /api/v2/programs?limit=2                 200  → meta.pagination "cursor", nextCursor set
                                                    meta.page / meta.total absent
cursor walk (limit=2, tuitionAsc)                 → no duplicates, nothing skipped,
                                                    same order as a single limit=50 fetch
GET /api/v2/programs?cursor=not-a-real-cursor 400 → "Invalid cursor..."
GET /api/v2/programs?sortBy=relevance         400 → "Unsupported sortBy..."
```

**Why a new version instead of changing v1:** `page` stops being a valid parameter and `total`/`totalPages` disappear from the response. Any client reading those fields breaks — which is exactly what a version boundary is for.

**Why cursors at all:** `skip` makes MongoDB walk and discard every preceding document, so page 500 costs far more than page 1, while a cursor seeks straight into the index. Offset pages are also unstable under writes: insert a cheaper program while a student is paging through tuition-sorted results and every later page shifts by one, so they see a duplicate and miss another. A cursor anchors to a document, so the boundary can't drift. It also drops the `countDocuments` round trip — `hasMore` comes from fetching one extra row.

**Why v2 refuses `sortBy=relevance`:** a cursor has to encode the whole sort key to resume correctly. v1's relevance sort has three keys (scholarship, tuition, id), and a two-part cursor can't express a resume point inside it without silently skipping the documents that tie on the first key. v2 offers only the sorts it can paginate correctly rather than shipping a cursor that's subtly wrong.

### Recommendations (`/api/v1/recommendations/:studentId`)

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

### Applications (`/api/v1/applications`)

Apply to a program, then move through: `draft → submitted → under-review → offer-received → visa-processing → enrolled`, with `rejected` reachable from any live stage. `enrolled` and `rejected` are final. Every change appends to a `timeline` array with who, when, and a note.

**Tested with:** `npm test`

```
POST  /api/v1/applications               201  → timeline has 1 entry
POST  /api/v1/applications               409  → duplicate (same student+program+intake)
PATCH /api/v1/applications/:id/status    403  → student tried to approve their own
PATCH /api/v1/applications/:id/status    400  → "Cannot transition from submitted to enrolled"
PATCH /api/v1/applications/:id/status    200  → counselor moved it, timeline now has 2 entries
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

35 Jest + Supertest tests against a seeded database, covering happy paths and the edge cases — duplicates, bad transitions, wrong roles, missing tokens, malformed IDs, bad cursors, unsupported sorts.

**Tested with:** `npm test`

```
Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
Time:        10.921 s
```

**Why `--runInBand`:** the tests share seeded fixtures and some assert on cache state. Run in parallel they'd race each other and fail for reasons that have nothing to do with the code.

On top of the suite, every endpoint was exercised by hand against a running server — public, authenticated, and the error paths:

```
health              200     register (duplicate)  409     apply                 201
universities        200     login (wrong pass)    401     apply (duplicate)     409
popular (cached)    200     login                 200     status as student     403
programs v1         200     me (no token)         401     invalid transition    400
programs v2         200     me (with token)       200     valid transition      200
programs (legacy)   200     recommendations       200     bad cursor            400
dashboard           200     ai study plan         200     unsupported v2 sort   400
                            ai (other student)    403     unknown route         404
```

The database was reseeded afterwards, so the data you receive is the clean seed, not leftovers from testing.

---

## 4. Bonus tasks

### AI study planner (`GET /api/v1/ai/study-plan/:studentId`)

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

Live platform totals, a **Program Explorer** driving the real `/api/v1/programs` with filters, sorting and pagination, and a **study planner** panel that logs in and renders the generated plan.

**Tested with:** `npm run build`, plus a server-side render of the whole component tree to prove it mounts without throwing:

```
RENDER OK — html length: 5658
sections present: { hero, explorer, planner, countrySelect, loginPrefill } → all true
```

**Note on the JSX setup:** the starter had no `@vitejs/plugin-react`, so JSX compiled with the classic transform and every component that doesn't `import React` threw `React is not defined` at runtime — the build succeeded regardless, which is exactly how that bug hides. Added the plugin, which switches to the automatic JSX runtime and brings Fast Refresh with it.

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
11. **Versioning is per resource, not per release.** v2 only changes `/programs`; everything else in v2 is the v1 handler. The unprefixed `/api/<resource>` paths remain as a v1 alias so nothing that already integrated breaks.
12. **Logs go to stdout only.** No file transport or log shipper is configured — in a container that's the right default, since the platform collects stdout.

---

## 6. Layout

```
backend/src
  config/         env, logger (winston), constants (status transition table)
  routes/
    index.js      mounts the versions
    v1/index.js   v1 resources
    v2/index.js   v2 resources
  controllers/    request handling and validation
    v2/           handlers whose contract changed in v2
  services/       recommendation pipeline, cache, AI planner, query building
  repositories/   all MongoDB access, one file per collection
  models/         Mongoose schemas and indexes
  middleware/     auth, roles, rate limiting, request logging, errors
  data/           seed data
frontend/src      React dashboard
docker-compose.yml
```

The layering is: **routes** pick a handler, **controllers** validate input and shape the response, **services** hold the logic worth testing on its own, **repositories** talk to MongoDB. Nothing above the repository layer imports a model.

The recommendation pipeline and the AI planner are services for exactly that reason — the fallback planner is unit-tested without going through an HTTP request at all.
