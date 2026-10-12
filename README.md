# Waygood Study Abroad — Backend Candidate Evaluation

A production-grade backend implementation for the Waygood Study Abroad candidate evaluation platform, built with Node.js, Express, MongoDB (Mongoose), and React.

---

## 1. Project Overview

This platform empowers prospective international students and counselors to manage the entire study-abroad journey:
1. **Student Registration & Authentication**: Secure user onboarding and login with bcrypt password hashing and signed JSON Web Tokens (JWT).
2. **University & Program Discovery**: Comprehensive multi-attribute filtering (country, subject, degree level, budget, intake, scholarship availability, and free-text search) with resilient sorting and standardized pagination.
3. **Recommendation Engine**: Intelligent ranking powered directly by a native **MongoDB Aggregation Pipeline** that matches program requirements against student profile preferences (target countries, field of study, budget, intake, and IELTS score) with explainable match reasons.
4. **Application Workflow**: Lifecycle tracking with database-enforced compound uniqueness (`student + program + intake`), strict finite-state machine transitions, and a complete immutable timeline/audit trail.
5. **Performance & Caching**: Multi-level query optimization with compound and text indexes, paired with an in-memory TTL cache service and proactive cache invalidation on data mutation.
6. **Testing & QA**: Automated test suite implemented with Jest and Supertest verifying happy paths and critical edge cases (duplicate submissions, invalid transitions, unauthorized access, short passwords, and 404s).

**Bonus tasks implemented**: AI study planning grounded on the aggregation shortlist (Groq), Docker/Docker Compose deployment, rate limiting with Helmet and NoSQL-injection sanitisation, and a live React dashboard that drives the real discovery and AI endpoints.

---

## 2. Tech Stack

- **Runtime & Server**: Node.js, Express.js 4
- **Database & ODM**: MongoDB Atlas, Mongoose 8
- **Authentication**: JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`)
- **Security**: Helmet (security headers), `express-rate-limit`, `express-mongo-sanitize`
- **AI**: Groq Chat Completions API (`openai/gpt-oss-120b` by default)
- **Testing**: Jest, Supertest
- **Logging & Utilities**: Morgan, Dotenv, Cors
- **Frontend Client**: React 18, Vite 5
- **Deployment**: Docker, Docker Compose, nginx (frontend static serving + API proxy)

---

## 3. Prerequisites

- **Node.js**: v18.x or v20.x+ (Tested on v22.x)
- **npm**: v9.x or v10.x+
- **MongoDB**: MongoDB Atlas Cluster connection URI or local MongoDB instance (v6.0+)

---

## 4. Installation & Environment Configuration

### Step 4.1 — Backend Configuration

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure your environment variables by creating `.env` (or copying from `.env.example`):
   ```env
   PORT=4000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/waygood-evaluation?retryWrites=true&w=majority
   JWT_SECRET=your-super-secure-jwt-secret-key
   JWT_EXPIRES_IN=1d
   CACHE_TTL_SECONDS=300

   # Optional: share the cache across replicas instead of the in-memory Map.
   REDIS_URL=

   # Optional: enables LLM-generated study plans. Without a key the endpoint
   # still responds, using the deterministic rule-based planner.
   GROQ_API_KEY=
   GROQ_MODEL=openai/gpt-oss-120b
   ```

   | Variable | Required | Default | Purpose |
   |---|---|---|---|
   | `PORT` | No | `4000` | HTTP port for the Express server. |
   | `MONGODB_URI` | Yes | `mongodb://127.0.0.1:27017/waygood-evaluation` | MongoDB connection string (Atlas or local). |
   | `JWT_SECRET` | Yes | `dev-secret` | Signing secret for access tokens. Must be overridden outside local dev. |
   | `JWT_EXPIRES_IN` | No | `1d` | Token lifetime. |
   | `CACHE_TTL_SECONDS` | No | `300` | TTL for cached dashboard, popular-university and study-plan payloads. |
   | `REDIS_URL` | No | _(empty)_ | Reserved for swapping the in-memory cache for Redis in multi-replica deploys. |
   | `GROQ_API_KEY` | No | _(empty)_ | Enables LLM study plans. Absent ⇒ deterministic fallback planner. |
   | `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Groq chat model used for plan generation. |

### Step 4.2 — Frontend Configuration

1. In a separate terminal or root, navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```

---

## 5. Database Setup & Seeding

From the `backend` folder, populate the database with initial universities, degree programs, student profiles, and historical applications:

```bash
cd backend
npm run seed
```

### Pre-Seeded Test Credentials

| Role | Email | Password | Target Countries / Profile |
|---|---|---|---|
| **Student** | `aarav@example.com` | `Candidate123!` | Canada, UAE \| Computer Science \| Budget $23,000 \| IELTS 7.0 |
| **Student** | `sara@example.com` | `Candidate123!` | UK, Australia \| Business, Hospitality \| Budget $19,000 \| IELTS 6.5 |
| **Counselor** | `counselor@example.com` | `Candidate123!` | Full administrative review privileges |

---

## 6. Running the Application

### Start Backend Development Server
```bash
cd backend
npm run dev
# Server will listen on http://localhost:4000
```

### Start Frontend Dashboard
```bash
cd frontend
npm run dev
# Dashboard available on http://localhost:5173 (proxied to backend)
```

The dashboard renders live backend data: platform totals from `/api/dashboard/overview`, a **Program Explorer** that drives the real `/api/programs` endpoint with filtering, sorting and pagination, and an **AI Study Planner** panel that logs in against `/api/auth/login` and renders the generated plan.

> Prefer containers? Skip both steps above and run `docker compose up --build` from the repository root — see [Section 10](#10-docker-deployment-bonus).

---

## 7. API Documentation

### 7.1 Authentication (`/api/auth`)

#### `POST /api/auth/register`
Creates a new student account.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "fullName": "Aarav Sharma",
    "email": "aarav.test@example.com",
    "password": "Password123!",
    "targetCountries": ["Canada", "Australia"],
    "interestedFields": ["Computer Science"],
    "maxBudgetUsd": 25000,
    "preferredIntake": "September"
  }
  ```
- **Responses**:
  - `201 Created`: User created with signed JWT and profile details.
  - `400 Bad Request`: Validation failure (e.g., password < 8 characters, missing name/email).
  - `409 Conflict`: Email already registered.

#### `POST /api/auth/login`
Authenticates credentials and returns a JWT.
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "aarav@example.com",
    "password": "Candidate123!"
  }
  ```
- **Responses**:
  - `200 OK`: Returns `{ success: true, data: { token, user: { id, fullName, email, role } } }`.
  - `401 Unauthorized`: Invalid email or password.

#### `GET /api/auth/me`
Retrieves the authenticated user's profile.
- **Access**: Protected (`Authorization: Bearer <token>`)
- **Responses**:
  - `200 OK`: Returns current user's profile and preferences (excluding password hash).
  - `401 Unauthorized`: Missing, invalid, or expired token.

---

### 7.2 Universities & Programs Discovery (`/api/universities`, `/api/programs`)

#### `GET /api/universities`
List universities with multi-attribute filtering, sorting, and pagination.
- **Query Parameters**:
  - `country` (string): e.g., `Canada`
  - `partnerType` (string): `direct`, `recruitment-partner`, `institution-partner`
  - `scholarship` or `scholarshipAvailable` (boolean): `true` or `false`
  - `q` or `search` (string): Search text across name, country, city, tags
  - `sortBy` (string): `popular`, `name`, `ranking`
  - `order` (string): `asc`, `desc`
  - `page` (number, default: 1)
  - `limit` (number, default: 10)
- **Response Format**:
  ```json
  {
    "success": true,
    "data": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
  ```

#### `GET /api/universities/popular`
Returns top universities sorted by popularity and ranking. Results are cached in-memory with TTL.
- **Response Headers / Meta**: `{ "meta": { "cache": "hit" | "miss" } }`

#### `GET /api/programs`
List academic programs with comprehensive criteria filtering.
- **Query Parameters**:
  - `country` (string): e.g., `Canada`
  - `field` (string): e.g., `Computer Science`
  - `degreeLevel` (string): `bachelor`, `master`, `diploma`, `certificate`
  - `intake` (string): e.g., `September`
  - `maxBudget` / `maxTuition` (number): Upper limit on `tuitionFeeUsd`
  - `scholarship` / `scholarshipAvailable` (boolean)
  - `q` / `search` (string)
  - `sortBy`: `relevance`, `tuition`, `tuitionAsc`, `tuitionDesc`, `name`
  - `page`, `limit`

---

### 7.3 Recommendation Engine (`/api/recommendations/:studentId`)

#### `GET /api/recommendations/:studentId`
Executes a native **MongoDB Aggregation Pipeline** evaluating student preferences against all candidate programs:
- **Scoring Rubric**:
  - **Country Match** (+35 pts): Program country is in student's `targetCountries`.
  - **Field Alignment** (+30 pts): Program field aligns with student's `interestedFields`.
  - **Budget Compliance** (+20 pts): Program tuition is within student's `maxBudgetUsd`.
  - **Preferred Intake** (+10 pts): Program offers student's `preferredIntake`.
  - **IELTS Eligibility** (+5 pts): Student's IELTS score meets or exceeds program's `minimumIelts`.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "student": { "id": "...", "fullName": "Aarav Malhotra", ... },
      "recommendations": [
        {
          "title": "BSc Computer Science",
          "matchScore": 100,
          "reasons": [
            "Preferred country match: UAE",
            "Field alignment: Computer Science",
            "Tuition is within your budget",
            "Preferred intake available: September",
            "English test score meets requirement"
          ],
          ...
        }
      ]
    },
    "meta": {
      "engine": "mongodb-aggregation-pipeline",
      "totalRecommendations": 5
    }
  }
  ```
- **Access Control**: Students may only retrieve their own recommendations; Counselors can view any student's recommendations.

---

### 7.4 Application Workflow (`/api/applications`)

#### `POST /api/applications`
Submits an application for a specific program and intake.
- **Access**: Protected (`student` or `counselor`)
- **Request Body**:
  ```json
  {
    "programId": "6acd178ada0e61ebcf020f5b",
    "intake": "September",
    "note": "Applying with updated statement of purpose."
  }
  ```
- **Duplicate Prevention**:
  - Validates in application logic prior to insert.
  - Backed by MongoDB Compound Unique Index: `{ student: 1, program: 1, intake: 1 }`.
  - Returns `409 Conflict` if the student has already applied to that program for that intake.
- **Initial Status**: Initialized to `submitted` with initial timeline event recorded.

#### `PATCH /api/applications/:id/status`
Updates application status and records an entry in the immutable audit timeline.
- **Access**: Protected (`counselor` only; students receive `403 Forbidden`)
- **State Machine Rules**:
  ```
  draft           -> ["submitted"]
  submitted       -> ["under-review", "rejected"]
  under-review    -> ["offer-received", "rejected"]
  offer-received  -> ["visa-processing", "rejected"]
  visa-processing -> ["enrolled", "rejected"]
  enrolled        -> [] (terminal)
  rejected        -> [] (terminal)
  ```
- **Responses**:
  - `200 OK`: Status successfully transitioned and audit timeline updated.
  - `400 Bad Request`: Invalid transition (e.g., trying to jump from `submitted` to `enrolled`).
  - `403 Forbidden`: Authenticated user is not a counselor.
  - `404 Not Found`: Application does not exist.

#### `GET /api/applications`
- **Access**: Protected.
- **Role Scoping**: Students only see their own applications; Counselors view all or filter by `studentId` or `status`.

---

### 7.5 AI Study Planner (`/api/ai/study-plan/:studentId`) — Bonus

#### `GET /api/ai/study-plan/:studentId`
Generates a phased, actionable study-abroad plan for a student.
- **Access**: Protected. Students may only request their own plan (`403` otherwise); counselors may request any student's.
- **Query Parameters**: `refresh=true` bypasses the cache and forces regeneration.
- **Grounding strategy**: The LLM never touches the database. The MongoDB aggregation pipeline produces the ranked shortlist first, and only that shortlist plus the student's profile is passed to the model. The system prompt forbids referencing any university, tuition figure or IELTS requirement outside the supplied data, which keeps output reproducible and prevents hallucinated institutions.
- **Graceful degradation**: If `GROQ_API_KEY` is unset, or the provider errors or exceeds the 20s timeout, the endpoint serves a deterministic rule-based plan instead of a `5xx`. `meta.generator` always reports which path produced the response (`groq:<model>` or `rule-based-fallback`), and `meta.degradedReason` explains any downgrade.
- **Caching**: Plans are cached per student under `ai-study-plan:<studentId>`. LLM calls are the slowest and most expensive operation in the API, so this is the highest-value cache in the system.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "student": { "id": "...", "fullName": "Aarav Malhotra", ... },
      "groundedShortlist": [
        { "title": "BSc Computer Science", "universityName": "Heriot-Watt University Dubai", "matchScore": 100 }
      ],
      "studyPlan": {
        "summary": "...",
        "shortlistStrategy": [
          { "programTitle": "...", "universityName": "...", "category": "ambitious|balanced|safe", "rationale": "..." }
        ],
        "timeline": [{ "phase": "Months 1-2", "focus": "...", "actions": ["..."] }],
        "testPreparation": { "currentStanding": "...", "recommendations": ["..."] },
        "budgetAdvice": ["..."],
        "risks": ["..."]
      }
    },
    "meta": {
      "generator": "groq:openai/gpt-oss-120b",
      "groundedOn": "mongodb-aggregation-pipeline",
      "shortlistSize": 5,
      "cache": "miss"
    }
  }
  ```
- **`422 Unprocessable Entity`**: Returned when no programs match the student's preferences, since a plan cannot be grounded on an empty shortlist.

---

### 7.6 Dashboard & Overview (`/api/dashboard/overview`)

Aggregates system-wide statistics (total students, total programs, application count, breakdown by status, top destination countries).
- Output is cached with `CACHE_TTL_SECONDS` (default: 300s).
- Cache is automatically invalidated when an application is created or updated.

---

## 8. Performance Optimization & Indexes

### 8.1 MongoDB Indexing Strategy

1. **`Student` Collection**:
   - `email`: `{ email: 1 }` (unique, lowercase, normalized).
   - `role`: `{ role: 1 }` (fast role verification).

2. **`University` Collection**:
   - Text Index: `{ name: "text", country: "text", city: "text" }` for multi-field text search.
   - Compound Sorting Index: `{ popularScore: -1, qsRanking: 1 }` enables zero-sort queries on `/popular` and rankings.

3. **`Program` Collection**:
   - Compound Filter Index: `{ country: 1, degreeLevel: 1, field: 1, tuitionFeeUsd: 1 }` optimizes multi-attribute discovery queries.
   - Text Index: `{ title: "text", universityName: "text", field: "text" }`.
   - Intake & Tuition Compound: `{ intakes: 1, tuitionFeeUsd: 1 }`.

4. **`Application` Collection**:
   - **Compound Unique Index**: `{ student: 1, program: 1, intake: 1 }` enforces database-level duplicate prevention against concurrent requests.
   - Compound User Query Index: `{ student: 1, status: 1 }`.
   - Sorting Index: `{ status: 1, createdAt: -1 }`.

### 8.2 In-Memory Caching Architecture

- Implemented via `MemoryCacheService` (`src/services/cacheService.js`) using high-performance ES6 `Map` with millisecond expiration tracking.
- Cache Hit/Miss metrics returned in response metadata.
- **Proactive Invalidation**: When any application is created or updated, `cacheService.delete("dashboard-overview")` is triggered so counselors always see real-time pipeline analytics.

---

### 8.3 Query Optimization Techniques

- **Projection on populate**: Every `.populate()` call names only the fields the response needs (e.g. `"fullName email role"`) instead of pulling whole documents across collections.
- **`.lean()` on read paths**: List and aggregation reads skip Mongoose document hydration, which removes getter/setter and change-tracking overhead on responses that are never mutated.
- **Parallel count + fetch**: Paginated endpoints issue `find()` and `countDocuments()` concurrently via `Promise.all` rather than sequentially, roughly halving latency on list routes.
- **Deterministic sort tiebreakers**: Every sort ends with `_id`, which guarantees a stable total order so paginated results never duplicate or skip a document between pages.
- **Bounded page size**: `limit` is clamped to a maximum of 50 server-side, so no client can request an unbounded scan.
- **Database-side scoring**: The recommendation engine computes match scores inside the aggregation pipeline (`$addFields`/`$cond`/`$filter`), so only the top 5 documents cross the wire instead of the whole program collection.
- **Pipeline stage ordering**: `$match` on `country` runs *before* the `$lookup` into universities, so the join executes against the narrowed candidate set rather than every program.

---

## 9. Security Measures (Bonus)

| Layer | Implementation | Threat addressed |
|---|---|---|
| Password storage | `bcryptjs` hashing in the `Student` pre-save hook; `password` excluded from every response | Credential disclosure on database compromise |
| Session | Signed JWTs with configurable expiry; verified per request against a live user lookup | Token forgery, access by deleted accounts |
| Authorization | `requireAuth` + `requireRole` middleware; students scoped to their own applications, recommendations and study plans | Horizontal and vertical privilege escalation |
| Privilege escalation | Public registration hard-codes `role: "student"`; counselor accounts cannot be self-assigned | Self-promotion to counselor |
| Security headers | `helmet()` — HSTS, `X-Content-Type-Options`, `X-Frame-Options`, CSP, and removal of `X-Powered-By` | Clickjacking, MIME sniffing, framework fingerprinting |
| NoSQL injection | `express-mongo-sanitize` strips `$`-prefixed and dotted keys from body, query and params | Auth bypass via `{"email": {"$ne": null}}` operator injection |
| Payload size | `express.json({ limit: "100kb" })` | Memory-exhaustion via oversized bodies |
| Brute force | `authLimiter`: 20 requests / 15 min per IP on `/api/auth`, with `skipSuccessfulRequests` so legitimate logins never consume budget | Credential stuffing, password guessing |
| Scraping / retry storms | `apiLimiter`: 300 requests / 15 min per IP across `/api` | API abuse, accidental client retry loops |
| LLM cost abuse | `aiLimiter`: 30 requests / hour per IP on `/api/ai` | Quota exhaustion on the paid AI provider |
| Proxy awareness | `app.set("trust proxy", 1)` | Rate limits keyed to the real client IP behind a load balancer |

Rate limiting and request logging are disabled when `NODE_ENV=test` so the suite stays deterministic and repeatable.

> **Note on limiter state**: counters live in memory. For a multi-replica deployment, swap in `rate-limit-redis` — the middleware interface in `src/middleware/rateLimiter.js` does not change.

---

## 10. Docker Deployment (Bonus)

The stack runs with a single command. MongoDB, the API and the nginx-served dashboard all come up wired together.

```bash
# From the repository root
docker compose up --build

# Seed the containerised database (first run only)
docker compose exec backend npm run seed
```

| Service | URL | Notes |
|---|---|---|
| Frontend | http://localhost:5173 | nginx serving the Vite build; proxies `/api` → backend |
| Backend | http://localhost:4000 | Express API |
| MongoDB | `localhost:27017` | Data persisted in the `mongo-data` named volume |

To enable AI plans inside Docker, export the key before bringing the stack up (Compose reads it from the environment, so it never has to be committed):

```bash
export GROQ_API_KEY=your-groq-key   # PowerShell: $env:GROQ_API_KEY="your-groq-key"
docker compose up --build
```

**Container design decisions**:
- `node:20-alpine` base with `npm ci --omit=dev` for a small, reproducible production image.
- Manifests are copied before source so dependency layers stay cached across code changes.
- The backend runs as the image's unprivileged `node` user, not root.
- `HEALTHCHECK` probes the existing `/api/health` route; the backend waits on Mongo's own healthcheck via `depends_on: condition: service_healthy` instead of a sleep.
- The frontend uses a multi-stage build so Node and the source tree never ship in the final nginx image.
- nginx mirrors the Vite dev proxy, so the dashboard uses identical relative `/api` paths in development and in containers.

---

## 11. Automated Testing

The project includes an end-to-end integration test suite using **Jest** and **Supertest** covering 26 test scenarios.

### Running the Test Suite
```bash
cd backend
npm test
```

### Coverage Highlights
- **Auth**: Successful registration, duplicate email rejection (409), short password validation (400), valid login with JWT, invalid password rejection (401), protected `/api/auth/me` profile retrieval, unauthenticated access rejection (401).
- **Discovery & Caching**: Multi-attribute filtering, budget threshold verification, country queries, pagination metadata, and cache hit/miss on popular universities.
- **Recommendation Engine**: Pipeline execution, dynamic weighted score calculation (0-100), explainable match reasons generation, invalid ID format (400), non-existent student (404).
- **Application Workflow & State Machine**: Successful student submission (201), concurrent/duplicate application rejection (409), role authorization enforcement (student forbidden from updating status: 403), state machine illegal transition rejection (400), permitted counselor transitions and audit trail appending (200).
- **Security Hardening**: Helmet header assertions (`nosniff`, `X-Frame-Options`, absent `X-Powered-By`), and a NoSQL operator-injection login attempt (`{"email": {"$ne": null}}`) confirmed to be neutralised rather than authenticated.
- **AI Study Planner**: Unauthenticated request rejection (401), cross-student access rejection (403), successful plan generation with grounding metadata (200), cache-hit verification on repeat requests, and a unit assertion that the deterministic fallback planner never emits a program outside the aggregation shortlist.

> The test suite runs against the database named in `MONGODB_URI` and expects `npm run seed` to have been run first. Tests are executed with `--runInBand` because they share seeded fixtures and assert on cache state, which must not be raced.

---

## 12. Architecture Decisions & Tradeoffs

1. **Role Delegation**:
   - Public registration defaults to `role: "student"`. Counselor accounts cannot be self-assigned through public registration endpoints to prevent privilege escalation.
2. **MongoDB Aggregation vs In-Memory Scoring**:
   - The recommendation engine uses native MongoDB aggregation `$addFields`, `$cond`, `$lookup`, and `$filter` directly on the database engine. This prevents pulling thousands of documents into Node.js memory.
3. **Compound Unique Index vs Application Check**:
   - Checking for existing applications in Node.js handles user feedback, but concurrent requests could race. The compound unique index on `{ student, program, intake }` guarantees atomicity at the database engine level.
4. **State Machine Audit Trail**:
   - Status transitions are strict and directional. Every transition updates both the top-level `status` and appends an entry to the `timeline` array containing the user, timestamp, and notes.
5. **In-Memory Cache vs Redis**:
   - For single-server evaluation, an in-memory Map avoids external infrastructure dependencies while demonstrating TTL eviction and cache invalidation. In a multi-replica Kubernetes setup, the service can swap to Redis via `REDIS_URL` without changing controller interfaces.
6. **Deterministic Engine vs LLM for Recommendations**:
   - Ranking stays entirely in MongoDB aggregation; the LLM is deliberately confined to *explaining and sequencing* an already-computed shortlist. Letting a model choose programs would make results non-reproducible and unverifiable, and would put tuition and admissions figures at risk of hallucination.
7. **Degrade, Don't Fail, on Third-Party Dependencies**:
   - The AI endpoint treats the LLM provider as optional infrastructure. A missing key, provider outage or timeout produces a rule-based plan with an explanatory `meta.degradedReason` rather than a `5xx`. A study-abroad user is better served by a slightly generic plan than by an error page.
8. **Two-Tier Rate Limiting**:
   - A single blanket limit would either be too loose for login or too tight for discovery browsing. Auth, general API and AI routes therefore carry separate budgets matched to their abuse profiles and cost.

---

## 13. Assumptions

1. **Roles**: Only `student` and `counselor` exist. Counselor accounts are created through seeding, never public registration.
2. **Status transitions are counselor-driven**: Students submit applications; only counselors advance status. `enrolled` and `rejected` are terminal — reopening requires a new application.
3. **Duplicate definition**: Uniqueness is `(student, program, intake)`. Re-applying to the same program for a *different* intake is legitimate and allowed.
4. **Intake values are free-text strings** (e.g. `"September"`) as supplied by the seed data, rather than an enumerated calendar. Filtering is case-insensitive.
5. **Recommendations return the top 5 programs**, and the scoring weights (35/30/20/10/5) encode the product assumption that destination and field matter more than intake timing or test-score headroom.
6. **A student's budget is tuition-only**; living costs, visa fees and insurance are flagged in study-plan advice but not modelled in scoring.
7. **Single-instance deployment** is assumed for the cache and rate-limit stores. Both are documented for Redis replacement in a multi-replica setup.
8. **Seeded data is a prerequisite** for both the test suite and the dashboard; `npm run seed` is idempotent and safe to re-run.
9. **The dashboard's study-plan panel prefills seeded credentials** for reviewer convenience. It is a demonstration surface — the JWT is held in component state only and never persisted to `localStorage`.
10. **Secrets are never committed**: `backend/.env` is gitignored, and `backend/.env.example` documents every variable without values. The Groq key is supplied via the environment.
