# ICTA Sentinel

AI-powered government website compliance checker for the ICT Authority (ICTA), Kenya. Scans public `.go.ke` / `.gov.ke` websites against **ICTA.6.002:2019, Section 6.4** (Systems and Applications Standard — Websites Development and Management).

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router) + Tailwind CSS — UI only |
| API | FastAPI — single gateway for all scan/job endpoints |
| Workers | Celery + Redis — async scan jobs, cache, idempotency locks |
| Database | PostgreSQL via Supabase |
| AI (Phase 5+) | Google Gemini — narrative and judgment calls only |

```
frontend/     Next.js UI
backend/      FastAPI + Celery workers
supabase/     Migrations and CLI config
```

## Prerequisites

- **Node.js** 20+
- **Python** 3.11+
- **Docker** and Docker Compose (Redis, API, worker)
- **Supabase CLI** (optional for local DB; required to push migrations to remote)

## Quick start

### 1. Environment

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
```

Edit `.env` with your Supabase `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` after linking your project.

### 2. Supabase setup

Create a project at [supabase.com](https://supabase.com), then configure `.env`:

```bash
cp .env.example .env
```

**Important:** Use the **Session pooler** connection string from Supabase Dashboard → Project Settings → Database → Connection pooling (not the direct `db.*` URI if your network lacks IPv6). Append `?sslmode=require`:

```env
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?sslmode=require
SUPABASE_URL=https://[project-ref].supabase.co
```

Apply the schema (Supabase CLI or helper script):

```bash
# Option A: Supabase CLI
supabase link --project-ref <your-project-ref>
supabase db push

# Option B: Python helper (uses DATABASE_URL from root .env)
cd backend
PYTHONPATH=. python scripts/apply_migration.py
```

Migration file: `supabase/migrations/20260722120000_initial_schema.sql`

MCDA registry (organizations, verified domains, weekly score updates):

```bash
# After initial schema
supabase db push   # or apply 20260724120000_mcda_registry.sql

cd backend
PYTHONPATH=. python scripts/seed_mcda_registry.py --allow-remote   # hosted DB
# local Supabase:
PYTHONPATH=. python scripts/seed_mcda_registry.py
```

Celery Beat (weekly Monday 02:00 Africa/Nairobi) is included in `docker compose` as the `beat` service.

### 3. Backend + workers (Docker)

```bash
docker compose up --build
```

Services:
- **API** — http://localhost:8001
- **Redis** — localhost:6379
- **Celery worker** — bounded concurrency (default 2)
- **Celery beat** — weekly MCDA registry rescan schedule

Health check: `GET http://localhost:8001/health`

> **Note:** Port **8001** is used by default to avoid conflicting with other local apps on 8000.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — health page at `/health`.

### 5. Run backend locally (without Docker)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Separate terminal — Celery worker
celery -A app.core.celery_app worker --loglevel=info --concurrency=2
```

Requires Redis running (`docker run -p 6379:6379 redis:7-alpine`).

## API (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (Redis + DB) |
| GET | `/api/v1/health` | Versioned health alias |
| POST | `/api/v1/scans` | Enqueue scan (`{ "url": "https://example.go.ke" }`) |
| GET | `/api/v1/scans/{job_id}` | Poll job status |
| GET | `/api/v1/registry` | MCDA registry list (scores, trend, last checked) |
| GET | `/api/v1/registry/suggestions?q=` | Autocomplete suggestions from registry |

SSRF protection is enforced on every scan request: DNS resolution, private/metadata IP rejection, `.go.ke`/`.gov.ke` allowlist.

## Tests

```bash
cd backend
pytest -v
```

## Environment variables

See [`.env.example`](.env.example). Never commit secrets. Backend uses `SUPABASE_SERVICE_ROLE_KEY` only server-side.

## Build phases

- **Phase 1** (current) — Scaffolding, SSRF, Supabase schema, Celery stub, health checks
- **Phase 2** — Rule-based scan engine (SRS Section 6 checklist)
- **Phase 3** — Queue orchestration and cache
- **Phase 4** — Weighted scoring engine
- **Phase 5** — Claude AI narrative layer
- **Phase 6** — Frontend pages (workspace, results, admin, outreach)
- **Phase 7** — Design polish (landing scroll narrative, reduced-motion)

## License

See [LICENSE](LICENSE).
