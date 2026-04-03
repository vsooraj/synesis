# MatchPoint Enterprise — Technology Stack & Deployment Guide
**Version 1.0**

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Frontend Stack](#3-frontend-stack)
4. [Backend Stack](#4-backend-stack)
5. [Database Layer](#5-database-layer)
6. [AI & Machine Learning Layer](#6-ai--machine-learning-layer)
7. [Authentication & Security](#7-authentication--security)
8. [Webhook & Integration Engine](#8-webhook--integration-engine)
9. [Build System](#9-build-system)
10. [Development Workflow](#10-development-workflow)
11. [Environment Variables & Secrets](#11-environment-variables--secrets)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Deployment Guide (Step by Step)](#13-deployment-guide-step-by-step)
14. [Post-Deployment Verification](#14-post-deployment-verification)
15. [Dependency Version Reference](#15-dependency-version-reference)

---

## 1. Architecture Overview

MatchPoint Enterprise is a **full-stack TypeScript monorepo** split into two independently deployable services that communicate over HTTP:

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser / Client                          │
│              React 19 SPA (Vite-built)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS (proxied via Replit routing)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                Replit Application Router                     │
│    Path-based routing: / → frontend, /api → API server      │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│  Resume Matcher      │    │  API Server                     │
│  React + Vite SPA    │    │  Express 5 (esbuild bundle)     │
│  Port: $PORT         │    │  Port: $PORT                    │
│  Route: /            │    │  Route: /api                    │
└──────────────────────┘    └──────────────────┬──────────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │                                 │
                              ▼                                 ▼
               ┌──────────────────────┐          ┌─────────────────────┐
               │   PostgreSQL DB      │          │  OpenAI / Replit AI │
               │   (Replit managed)   │          │  GPT-5.2 endpoint   │
               │   + pgvector ext.    │          └─────────────────────┘
               └──────────────────────┘
```

**Key architectural decisions:**

| Decision | Choice | Reason |
|---|---|---|
| Monorepo | pnpm workspaces | Shared types, single install, per-package scripts |
| API isolation | Separate Express service | Independent scaling, clean contract boundary |
| Build | esbuild (API), Vite (frontend) | esbuild: sub-second API builds; Vite: HMR + tree-shaking |
| ORM | Drizzle | Type-safe, zero-overhead queries, schema-as-code migrations |
| Auth | JWT (stateless) | No session store needed; scales horizontally |
| Search | TF-IDF + BM25 | No external vector DB required; fast, deterministic, explainable |
| Deployment | Replit Autoscale | Zero-config TLS, automatic scaling, managed infrastructure |

---

## 2. Monorepo Structure

```
workspace/
├── artifacts/
│   ├── api-server/          # Express 5 API (TypeScript → esbuild → ESM bundle)
│   │   ├── src/
│   │   │   ├── index.ts     # Entry point — binds to $PORT
│   │   │   ├── app.ts       # Express app setup, middleware, route registration
│   │   │   ├── routes/      # Feature route modules (one file per domain)
│   │   │   │   ├── auth.ts
│   │   │   │   ├── resume.ts
│   │   │   │   ├── resumeProfiles.ts
│   │   │   │   ├── jobDescriptions.ts
│   │   │   │   ├── bulkJobs.ts
│   │   │   │   ├── talentSearch.ts
│   │   │   │   ├── analytics.ts
│   │   │   │   ├── agentShortlist.ts
│   │   │   │   ├── rag.ts
│   │   │   │   ├── tickets.ts
│   │   │   │   ├── interviews.ts
│   │   │   │   ├── webhooks.ts
│   │   │   │   ├── auditLog.ts
│   │   │   │   └── health.ts
│   │   │   ├── lib/         # Shared server utilities
│   │   │   │   ├── audit.ts          # Audit log writer
│   │   │   │   ├── webhookDelivery.ts # HMAC-signed delivery engine
│   │   │   │   ├── tfidf.ts          # TF-IDF search implementation
│   │   │   │   ├── bm25.ts           # BM25 ranking for RAG
│   │   │   │   └── logger.ts         # Pino structured logger
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts  # JWT validation + RBAC
│   │   │   └── n8n-templates/ # Copies of downloadable workflow JSONs
│   │   ├── build.mjs        # esbuild config
│   │   └── package.json
│   │
│   ├── resume-matcher/      # React + Vite SPA
│   │   ├── src/
│   │   │   ├── App.tsx      # Root — React Router (Wouter) + QueryClient
│   │   │   ├── components/  # Reusable UI components (shadcn/ui based)
│   │   │   ├── pages/       # One file per route
│   │   │   ├── lib/
│   │   │   │   └── enterprise-api.ts  # Typed API client (fetch wrappers)
│   │   │   ├── context/
│   │   │   │   └── auth.tsx # AuthContext (JWT decode + role)
│   │   │   └── hooks/       # Shared React hooks
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── mockup-sandbox/      # Design preview server (internal)
│
├── lib/
│   ├── db/                  # Drizzle schema + migrations
│   │   ├── src/
│   │   │   ├── schema/      # One file per table
│   │   │   └── index.ts     # Re-exports all tables + db client
│   │   └── package.json
│   └── (other shared libraries)
│
├── docs/
│   └── n8n/                 # Downloadable n8n workflow templates (JSON)
│
├── pnpm-workspace.yaml      # Workspace + catalog version pins
├── package.json             # Root scripts
└── .replit                  # Replit deployment config
```

**Shared packages** — the `lib/db` package is imported by both `api-server` and other tooling. It exports the Drizzle client, all table definitions, and shared constants. This ensures schema types are always in sync across services.

---

## 3. Frontend Stack

### Core Framework

| Package | Version | Role |
|---|---|---|
| **React** | 19.1.0 | UI rendering, concurrent features |
| **Vite** | ^7 | Dev server with HMR, production bundler |
| **TypeScript** | 5.9 | Type safety across all frontend code |
| **Wouter** | ^3.3.5 | Lightweight client-side routing (~2 KB) |

### State & Data Fetching

| Package | Version | Role |
|---|---|---|
| **@tanstack/react-query** | ^5.90 | Server state, caching, cache invalidation |

All API calls go through `enterprise-api.ts` — a hand-written typed fetch client that wraps every endpoint in a strongly-typed function. No code generation for the client (kept simple by design).

### UI Components

| Package | Version | Role |
|---|---|---|
| **Tailwind CSS** | ^4.1 | Utility-first CSS, zero runtime |
| **shadcn/ui** | (components) | Pre-built accessible primitives (Radix UI-based) |
| **Radix UI** | ^1.x | Dialog, Select, Switch, Tooltip, etc. |
| **lucide-react** | ^0.545 | Icon library (tree-shakeable SVG) |
| **class-variance-authority** | ^0.7 | Component variant styling |
| **clsx** | ^2.1 | Conditional class merging |

### Charting

| Package | Version | Role |
|---|---|---|
| **Recharts** | ^2.15 | Skills gap analytics charts (bar, histogram, radar) |

### Drag & Drop

| Package | Version | Role |
|---|---|---|
| **@dnd-kit/core** | (workspace) | Kanban board drag-and-drop |
| **@dnd-kit/sortable** | (workspace) | Column-level drop target sortability |

### Build Output

Vite produces a static asset bundle (`dist/`) containing:
- `index.html` — single entry point
- Hashed JS chunks (code-split by route)
- Hashed CSS bundle (Tailwind output)

The SPA is served from the root path `/` by the Replit application router. All navigation is client-side; the server returns `index.html` for any non-API path.

---

## 4. Backend Stack

### Core

| Package | Version | Role |
|---|---|---|
| **Node.js** | 24.13.0 | Runtime |
| **Express** | ^5 | HTTP server, middleware pipeline |
| **TypeScript** | 5.9 | Full type safety; transpiled by esbuild |
| **esbuild** | ^0.27 | Bundles TypeScript to a single ESM file for production |

### Middleware & Utilities

| Package | Version | Role |
|---|---|---|
| **pino** | ^9 | Structured JSON logging (fast, low-overhead) |
| **multer** | ^2.1 | Multipart form-data (PDF uploads) |
| **pdf-parse** | ^1.1 | PDF text extraction from uploaded files |
| **cors** | (express 5 built-in) | Cross-origin resource sharing |
| **zod** | ^3 (catalog) | Runtime request body validation |

### Request Lifecycle

```
Incoming request
      │
      ▼
  CORS headers
      │
      ▼
  JSON body parser (express.json)
      │
      ▼
  Pino HTTP logger (request/response timing)
      │
      ▼
  Route matching
      │
      ├─ Public routes (no auth) → handler
      │
      └─ Protected routes → requireAuth middleware
                │
                ├─ Verify JWT signature + expiry
                ├─ Attach user (userId, tenantId, role) to req
                └─ handler
```

### API Route Structure

All enterprise routes are prefixed `/api/enterprise/`. Public routes use `/api/resume/` and `/api/auth/`.

```
/api/health                         GET  Health check
/api/auth/register                  POST Register org + super_admin
/api/auth/login                     POST Authenticate, return JWT
/api/auth/me                        GET  Current user info
/api/auth/users                     GET  List tenant users
/api/auth/users/invite              POST Invite team member

/api/resume/analyze                 POST Public resume analysis
/api/resume/analyses                GET  Public analysis history
/api/resume/stats                   GET  Public aggregate stats

/api/enterprise/resumes             GET/POST  Candidate pool
/api/enterprise/resumes/:id         GET/DELETE
/api/enterprise/jobs                GET/POST  Job descriptions
/api/enterprise/jobs/:id            GET/PUT/DELETE
/api/enterprise/bulk-jobs           GET/POST  Bulk analysis
/api/enterprise/bulk-jobs/:id       GET
/api/enterprise/talent-search       POST  TF-IDF semantic search
/api/enterprise/analytics           GET  Skills gap analytics
/api/enterprise/agent/shortlists    GET/POST  AI shortlisting
/api/enterprise/agent/shortlists/:id/approve  POST
/api/enterprise/agent/shortlists/:id/reject   POST
/api/enterprise/rag/query           POST  BM25 + GPT RAG Q&A

/api/enterprise/tickets             GET/POST  Position tickets
/api/enterprise/tickets/:id         GET/PATCH/DELETE
/api/enterprise/tickets/:id/status  POST  Status transition
/api/enterprise/tickets/:id/comments  GET/POST
/api/enterprise/tickets/:id/candidates  GET/POST
/api/enterprise/tickets/workload/summary  GET

/api/enterprise/interviews          GET/POST  Interview slots
/api/enterprise/interviews/upcoming GET  Next N days
/api/enterprise/interviews/:id      GET/PATCH/DELETE
/api/enterprise/interviews/:id/complete         POST
/api/enterprise/interviews/:id/cancel           POST
/api/enterprise/interviews/:id/noshow           POST
/api/enterprise/interviews/:id/request-feedback POST

/api/enterprise/webhooks/config     GET/PUT/DELETE
/api/enterprise/webhooks/deliveries GET
/api/enterprise/webhooks/events     GET
/api/enterprise/webhooks/test/:event  POST
/api/enterprise/webhooks/template/:file  GET

/api/enterprise/audit-log           GET
```

### Error Handling

All route handlers use the pattern:
```typescript
try {
  // logic
} catch (err) {
  res.status(500).json({ error: err instanceof Error ? err.message : "Server error" });
}
```

Validation errors return HTTP 400 with a descriptive `error` field. Auth failures return HTTP 401. Not-found returns HTTP 404.

---

## 5. Database Layer

### Engine & ORM

| Component | Choice | Details |
|---|---|---|
| **Database** | PostgreSQL | Hosted by Replit managed database |
| **ORM** | Drizzle ORM ^0.45 | Type-safe query builder, schema-as-code |
| **Extension** | pgvector | Enabled (for future embedding similarity search) |
| **Migrations** | `drizzle-kit push` | Schema pushed directly in dev; no migration files |
| **Connection** | `pg` (^8.20) | Node.js PostgreSQL client |

### Schema Tables

| Table | Purpose |
|---|---|
| `tenants` | Organisation records (1 per registered company) |
| `users` | User accounts with role + tenant FK |
| `analyses` | Public resume analysis results |
| `resume_profiles` | Candidate resumes with parsed text |
| `job_descriptions` | JD library with status lifecycle |
| `bulk_jobs` | Async bulk analysis job records |
| `bulk_job_results` | Per-candidate result rows for bulk jobs |
| `audit_log` | Immutable append-only action log |
| `agent_shortlist_jobs` | AI shortlisting run records |
| `agent_shortlist_results` | Per-candidate shortlist entries |
| `agent_shortlist_steps` | Agentic step log for transparency |
| `position_tickets` | Position/role tracking records |
| `ticket_comments` | Internal team comments per ticket |
| `ticket_candidates` | Many-to-many: candidates linked to tickets |
| `ticket_history` | Immutable ticket event log |
| `webhook_configs` | Per-tenant webhook endpoint config |
| `webhook_deliveries` | Delivery attempt log with status/retries |
| `interview_slots` | Interview records with feedback JSON |

### Multi-Tenancy Pattern

Every table (except `tenants`) has a `tenant_id` column with a NOT NULL foreign key to `tenants`. Every query in every route filters by `req.user!.tenantId`, ensuring complete data isolation between organisations. There are no cross-tenant joins anywhere in the codebase.

### Connection String

Drizzle connects using the `DATABASE_URL` environment variable (PostgreSQL connection string). This is injected automatically by Replit's managed database service.

---

## 6. AI & Machine Learning Layer

### Language Model

| Item | Value |
|---|---|
| **Model** | GPT-5.2 |
| **Provider** | OpenAI via Replit AI Integrations proxy |
| **API style** | `max_completion_tokens` (not `max_tokens`) |
| **Usage** | Resume analysis, shortlisting evaluation, RAG synthesis |

The AI integration is accessed through Replit's managed proxy — no OpenAI API key needs to be configured manually. The `OPENAI_API_KEY` environment variable is injected automatically when the AI integration is enabled in the Replit workspace.

### Retrieval & Search

| Technique | Used for | Implementation |
|---|---|---|
| **TF-IDF** | Talent pool search, shortlist candidate retrieval | Custom implementation in `lib/tfidf.ts` |
| **BM25** | RAG retrieval (resume section ranking) | Custom implementation in `lib/bm25.ts` |

Both algorithms are implemented directly in TypeScript — no external vector database, no embeddings API calls required. This keeps latency low and costs zero.

### TF-IDF Search Pipeline
```
Query text
    │
    ▼
Tokenise + normalise (lowercase, stop-word removal)
    │
    ▼
TF-IDF score each resume against query
    │
    ▼
Rank by score, extract best-matching snippet
    │
    ▼
Return top N results with highlighted snippets
```

### BM25 RAG Pipeline
```
Resume uploaded
    │
    ▼
Chunk by section (Summary, Experience, Skills, Education, Certifications)
    │
    ▼
Store chunks in memory index (BM25)
    │
    ▼
User query arrives
    │
    ▼
BM25 scores all chunks against query
    │
    ▼
Top K chunks retrieved with metadata (candidate, section, snippet, score)
    │
    ▼
Chunks + query sent to GPT-5.2 with system prompt
    │
    ▼
Cited answer returned with source references
```

---

## 7. Authentication & Security

### JWT Authentication

| Setting | Value |
|---|---|
| **Library** | `jsonwebtoken` ^9.0 |
| **Algorithm** | HS256 |
| **Expiry** | 7 days |
| **Storage** | Browser `localStorage` (`mp_token`) |
| **Secret** | `SESSION_SECRET` environment variable |

Every protected route runs the `requireAuth` middleware which:
1. Reads the `Authorization: Bearer <token>` header
2. Verifies the JWT signature using `SESSION_SECRET`
3. Checks token expiry
4. Attaches `{ userId, tenantId, email, role }` to `req.user`

### Password Hashing

Passwords are hashed using **bcryptjs** (^3.0) with a salt factor of 10. Plain-text passwords are never stored.

### Webhook Signature Security

Outbound webhooks are signed with **HMAC-SHA256**:
- Each tenant has a unique webhook secret (generated with `crypto.randomBytes(32)`)
- Every delivery includes `X-MatchPoint-Signature: sha256=<hex>`
- Recipients verify the signature to reject forged requests

### Supply Chain Security

The `pnpm-workspace.yaml` enforces a `minimumReleaseAge: 1440` (24 hours) on all npm packages before they can be installed. This blocks supply-chain attacks where malicious versions are published and consumed within hours.

---

## 8. Webhook & Integration Engine

### Delivery Engine (`webhookDelivery.ts`)

```
Event fires (e.g. interview.scheduled)
    │
    ▼
Check webhook config for tenant
    │
    ├─ No config or disabled → skip
    │
    └─ Event in enabledEvents → proceed
            │
            ▼
    Build payload: { event, timestamp, tenantId, payload }
            │
            ▼
    Sign with HMAC-SHA256
            │
            ▼
    POST to webhook URL (attempt 1)
            │
            ├─ HTTP 2xx → mark delivered, log
            │
            └─ Non-2xx / network error
                    │
                    ▼
            Retry (attempt 2, wait 5s)
                    │
                    └─ Retry (attempt 3, wait 15s)
                            │
                            └─ Mark failed, log error
```

### n8n Template Files

Stored in `docs/n8n/` and served via `GET /api/enterprise/webhooks/template/:file`.

Six templates are available:

| File | Trigger Event |
|---|---|
| `gmail-outreach.json` | `shortlist.approved` |
| `teams-approval-card.json` | `shortlist.pending_approval` |
| `outlook-digest.json` | Scheduled (cron) |
| `teams-interview-notification.json` | `interview.scheduled` |
| `outlook-interview-invite.json` | `interview.scheduled` |
| `teams-feedback-request.json` | `interview.feedback_requested` |

---

## 9. Build System

### API Server Build (esbuild)

```bash
pnpm --filter @workspace/api-server run build
```

Produces `artifacts/api-server/dist/index.mjs` — a single ESM bundle containing all server code and dependencies (except those in the `external` list).

**esbuild config highlights:**
- Platform: `node`
- Format: `esm`
- Output extension: `.mjs`
- Source maps: enabled (`.map` files)
- Plugin: `esbuild-plugin-pino` (handles Pino's dynamic worker thread loading)
- Externals: native modules and packages that cannot be bundled (e.g. `pg`)

Build time: **< 1 second** for incremental, ~1 second cold.

### Frontend Build (Vite)

```bash
pnpm --filter @workspace/resume-matcher run build
```

Produces `artifacts/resume-matcher/dist/` — static assets with hashed filenames for cache-busting.

**Vite config highlights:**
- React plugin with Fast Refresh
- Tailwind CSS v4 via `@tailwindcss/vite`
- Base path: `/` (root of the Replit proxy)
- Source maps: enabled for production debugging

### Full Workspace Build

```bash
pnpm run build
```

Runs `typecheck` first (TypeScript compiler in check-only mode across all packages), then builds all artifacts in dependency order.

---

## 10. Development Workflow

### Starting Services

The three development workflows run concurrently:

```bash
# API server (TypeScript → build → node dist/index.mjs)
pnpm --filter @workspace/api-server run dev

# Frontend (Vite HMR dev server)
pnpm --filter @workspace/resume-matcher run dev

# Design mockup sandbox (internal)
pnpm --filter @workspace/mockup-sandbox run dev
```

In the Replit workspace these are managed as named workflows and start automatically.

### Database Schema Changes

1. Edit the relevant file in `lib/db/src/schema/`
2. Push the schema to the running database:
   ```bash
   pnpm --filter @workspace/db run push
   ```
3. The Drizzle Kit `push` command introspects the live database, computes the diff, and applies `ALTER TABLE` statements automatically.

> **Important:** Never change primary key column types (e.g. `serial` ↔ `uuid`). This generates destructive migrations. Add new columns only.

### TypeScript Checking

```bash
pnpm run typecheck
```

Runs `tsc --noEmit` across all packages using TypeScript project references. Catches type errors without producing output files.

### Adding a New Route

1. Create `artifacts/api-server/src/routes/myFeature.ts`
2. Export a default Express `Router`
3. Register in `artifacts/api-server/src/routes/index.ts`:
   ```typescript
   import myFeatureRouter from "./myFeature.js";
   app.use("/", myFeatureRouter);
   ```
4. Add the corresponding typed API client method in `artifacts/resume-matcher/src/lib/enterprise-api.ts`
5. Create the React page in `artifacts/resume-matcher/src/pages/myFeature.tsx`
6. Register the route in `artifacts/resume-matcher/src/App.tsx`

---

## 11. Environment Variables & Secrets

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (injected by Replit DB) |
| `SESSION_SECRET` | Yes | JWT signing secret (min 32 bytes random hex) |
| `OPENAI_API_KEY` | Yes | OpenAI API key (injected by Replit AI Integration) |
| `PORT` | Yes | Port the service listens on (injected by Replit routing) |

**In development (Replit workspace):** All variables are set automatically — `DATABASE_URL` by the managed PostgreSQL service, `OPENAI_API_KEY` by the AI Integration, `PORT` by the workflow runner, and `SESSION_SECRET` is set as a workspace secret.

**In production (deployed app):** All variables are automatically promoted to the production environment. No manual configuration is required if you deploy from the Replit workspace where these are already set.

> **Never hardcode secrets.** The `SESSION_SECRET` must be kept in Replit Secrets only, never in source code or committed to version control.

---

## 12. Deployment Architecture

### Platform: Replit Autoscale

MatchPoint Enterprise deploys on **Replit Autoscale** — a managed container hosting platform with:

| Feature | Detail |
|---|---|
| **TLS / HTTPS** | Automatic — all traffic is TLS-terminated by Replit |
| **Domain** | `<project-name>.replit.app` (or custom domain) |
| **Scaling** | Autoscale — containers spin up/down based on traffic |
| **Cold start** | ~2 seconds (Node.js startup + DB connection warmup) |
| **Database** | Replit managed PostgreSQL (same instance as dev, isolated from prod) |
| **Deployment target** | `autoscale` (configured in `.replit`) |
| **Router** | `application` (path-based, not static files) |

### Routing Configuration (`.replit`)

```toml
[deployment]
router = "application"
deploymentTarget = "autoscale"

[deployment.postBuild]
args = ["pnpm", "store", "prune"]
env = { "CI" = "true" }
```

- `router = "application"` — Replit proxies all paths through the application, including the SPA fallback.
- `deploymentTarget = "autoscale"` — uses Replit's autoscaling infrastructure.
- `postBuild.args` — prunes the pnpm store after build to reduce image size.

### Production vs Development Database

Replit maintains **separate database instances** for development (workspace) and production (deployed app). The production database URL is automatically set in the production container — you do not need to manage connection strings manually.

---

## 13. Deployment Guide (Step by Step)

### Prerequisites

- Access to the MatchPoint Enterprise Replit workspace
- All secrets configured in Replit Secrets: `SESSION_SECRET`
- Replit AI Integration enabled (for `OPENAI_API_KEY`)
- Replit managed database provisioned (for `DATABASE_URL`)

### Step 1: Verify the build passes

Before deploying, confirm the full build succeeds:

```bash
pnpm run build
```

Expected output: TypeScript type-check passes with no errors, then esbuild produces `dist/index.mjs` for the API server, then Vite produces `dist/` for the frontend.

### Step 2: Verify the development environment works

Confirm all three workflows are running and the application is accessible in the Replit preview pane:
- API server: `GET /api/health` returns `{ "status": "ok" }`
- Frontend: login page loads at `/login`
- Database: at least one tenant can register and log in

### Step 3: Push the database schema (if changed)

If any schema changes were made since the last deploy:

```bash
pnpm --filter @workspace/db run push
```

> This pushes schema to the **development** database. The production database schema is migrated automatically on first deploy via the post-merge setup script.

### Step 4: Deploy via Replit

1. In the Replit workspace, click the **Deploy** button in the top toolbar.
2. Replit will:
   - Run `pnpm install` (using the lockfile — deterministic)
   - Run the build (`pnpm run build`)
   - Run `pnpm store prune` (post-build cleanup)
   - Push the container to Replit Autoscale infrastructure
   - Run the post-merge setup script (`scripts/post-merge.sh`) for DB migrations
   - Start the application
   - Perform health checks
3. Once healthy, traffic is switched to the new deployment.
4. The previous deployment is kept as a rollback target.

### Step 5: Database schema sync in production

After a successful deploy, the post-merge setup script runs:

```bash
pnpm --filter @workspace/db run push
```

This applies any schema changes (new columns, new tables) to the **production** database automatically.

### Step 6: Verify the deployment

Open the deployed URL (shown in the Replit deployment panel):

1. Navigate to `/api/health` — expect `{ "status": "ok" }`
2. Navigate to the root `/` — the React app loads
3. Register a new organisation or sign in with an existing account
4. Verify the Position Board, Interviews page, and AI Agent are functional

---

## 14. Post-Deployment Verification

Run through this checklist after every production deployment:

### API Health
- [ ] `GET /api/health` returns HTTP 200 with `{ "status": "ok" }`
- [ ] `POST /api/auth/login` returns a valid JWT token

### Database Connectivity
- [ ] Candidate list loads (proves DB read)
- [ ] Upload a candidate (proves DB write + PDF parsing)

### AI Integration
- [ ] Run a resume analysis on the public analyzer — AI scoring returns results
- [ ] Verify GPT-5.2 is responding (check response includes strengths/gaps)

### Interview Scheduling
- [ ] Schedule an interview from a ticket → interview appears in `/interviews`
- [ ] Download `.ics` — file opens correctly in Outlook/Calendar

### Webhook Engine
- [ ] Check Integrations page — webhook config loads
- [ ] Fire a test event — delivery log shows new entry

### Frontend Routing
- [ ] Navigate between all sidebar pages without 404 errors
- [ ] Reload on `/tickets/1` — page loads correctly (SPA fallback working)

---

## 15. Dependency Version Reference

### Runtime

| Package | Version |
|---|---|
| Node.js | 24.13.0 |
| pnpm | workspace |

### Frontend (resume-matcher)

| Package | Version |
|---|---|
| react | 19.1.0 |
| react-dom | 19.1.0 |
| vite | ^7 |
| typescript | 5.9 |
| tailwindcss | ^4.1.14 |
| @tanstack/react-query | ^5.90.21 |
| wouter | ^3.3.5 |
| recharts | ^2.15.2 |
| lucide-react | ^0.545.0 |
| @radix-ui/react-dialog | ^1.1.7 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| framer-motion | ^12.23.24 |
| @vitejs/plugin-react | ^5.0.4 |
| @tailwindcss/vite | ^4.1.14 |

### Backend (api-server)

| Package | Version |
|---|---|
| express | ^5 |
| typescript | 5.9 |
| esbuild | ^0.27.3 |
| pino | ^9 |
| multer | ^2.1.1 |
| pdf-parse | ^1.1.1 |
| jsonwebtoken | ^9.0.3 |
| bcryptjs | ^3.0.3 |
| zod | ^3 |

### Database (lib/db)

| Package | Version |
|---|---|
| drizzle-orm | ^0.45.1 |
| drizzle-kit | ^0.31.9 |
| pg | ^8.20.0 |
| @types/pg | ^8.18.0 |

### Types & Tooling (workspace catalog)

| Package | Version |
|---|---|
| @types/node | ^25.3.3 |
| @types/react | ^19.2.0 |
| @types/react-dom | ^19.2.0 |

---

## Appendix A: CI / Typecheck

The monorepo uses TypeScript project references. Running `pnpm run typecheck` executes `tsc --build --noEmit` which:
- Type-checks all packages in dependency order
- Detects cross-package type errors
- Does not produce output files

This is run as a pre-build step in the deployment pipeline.

## Appendix B: Security Checklist

| Item | Status |
|---|---|
| JWT secret is ≥32 bytes random hex | Required (set in Secrets) |
| Passwords stored as bcrypt hashes (cost 10) | Always |
| All enterprise routes require `requireAuth` middleware | Always |
| Tenant isolation enforced in every query | Always |
| Webhook signatures verified by recipients | Recipient's responsibility |
| Supply-chain attack protection (24h package age) | Enforced in pnpm-workspace.yaml |
| HTTPS only in production | Enforced by Replit router |
| No secrets in source code or git history | Enforced by project policy |

---

*MatchPoint Enterprise — Technology Stack & Deployment Guide*
*Node.js 24 · TypeScript 5.9 · React 19 · PostgreSQL · GPT-5.2 · Replit Autoscale*
