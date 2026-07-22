# ICTA Sentinel

AI-powered government website compliance checker for the ICT Authority (ICTA), Kenya. Scans public `.go.ke` / `.gov.ke` websites against **ICTA.6.002:2019, Section 6.4** (Systems and Applications Standard — Websites Development and Management).

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router) + Tailwind CSS — UI only |
| API | FastAPI — single gateway for all scan/job endpoints |
| Workers | Celery + Redis — async scan jobs, cache, idempotency locks |
| Database | PostgreSQL via Supabase |
| AI (Phase 5+) | Anthropic Claude — narrative and judgment calls only |

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

Create a project at [supabase.com](https://supabase.com), then:

```bash
# Install Supabase CLI: https://supabase.com/docs/guides/cli
supabase link --project-ref <your-project-ref>
supabase db push
```

Migration file: `supabase/migrations/20260722120000_initial_schema.sql`

### 3. Backend + workers (Docker)

```bash
docker compose up --build
```

Services:
- **API** — http://localhost:8000
- **Redis** — localhost:6379
- **Celery worker** — bounded concurrency (default 2)

Health check: `GET http://localhost:8000/health`

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
| POST | `/api/v1/scans` | Enqueue stub scan (`{ "url": "https://example.go.ke" }`) |
| GET | `/api/v1/scans/{job_id}` | Poll job status |

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
