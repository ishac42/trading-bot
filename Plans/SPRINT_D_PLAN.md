# Sprint D: Docker & Deployment (Phase 14)

## Overview
**Goal**: Containerize the full stack — backend, frontend, database, and cache — so the entire application runs with a single `docker compose up`.  
**Estimated effort**: 1–2 days  
**Depends on**: Sprint A (Alpaca Client ✅), Sprint B (Trading Engine ✅), Sprint C (Indicators/Signals/Risk ✅)

---

## Current Status

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Backend Dockerfile | `backend/Dockerfile` | ✅ Complete | Multi-stage python:3.12-slim, non-root user |
| Backend Entrypoint | `backend/entrypoint.sh` | ✅ Complete | DB wait + alembic migrate + uvicorn start |
| Frontend Dockerfile | `frontend/Dockerfile` | ✅ Complete | Multi-stage node:22-alpine → nginx:alpine |
| Docker Compose | `docker-compose.yml` | ✅ Complete | 4 services, health checks, named volumes |
| Nginx Config | `frontend/nginx.conf` | ✅ Complete | SPA fallback + /api/ and /ws/ proxy |
| Backend .dockerignore | `backend/.dockerignore` | ✅ Complete | Excludes venv, tests, cache, .env |
| Frontend .dockerignore | `frontend/.dockerignore` | ✅ Complete | Excludes node_modules, dist, .env |
| Root Env Template | `.env.example` | ✅ Complete | Unified env for Docker Compose |
| Health Check Endpoint | `backend/app/main.py` | ✅ Exists | `GET /api/health` already present |
| Database Migrations | `backend/alembic/` | ✅ Exists | Auto-run via entrypoint.sh |

---

## Phase 14 Tasks

### 14.1 — Backend Dockerfile

**File**: `backend/Dockerfile`

Multi-stage build for a small, secure production image.

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `builder` | `python:3.12-slim` | Install dependencies, compile wheels |
| `runtime` | `python:3.12-slim` | Copy wheels, run Uvicorn |

**Key decisions**:
- Python 3.12 (stable, well-supported by all dependencies)
- Non-root user (`appuser`) for security
- `requirements.txt` layer cached separately from app code
- Expose port `8000`
- Entrypoint script runs `alembic upgrade head` then starts Uvicorn

**Entrypoint script** (`backend/entrypoint.sh`):
1. Wait for PostgreSQL to be ready (pg_isready or retry loop)
2. Run `alembic upgrade head` to apply pending migrations
3. Start `uvicorn app.main:app --host 0.0.0.0 --port 8000`

---

### 14.2 — Frontend Dockerfile

**File**: `frontend/Dockerfile`

Multi-stage build: Node for building, Nginx for serving.

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `build` | `node:22-alpine` | `npm ci` + `npm run build` |
| `runtime` | `nginx:alpine` | Serve static dist, reverse-proxy API |

**Key decisions**:
- Build-time args for `VITE_API_URL` and `VITE_WS_URL` (baked into the bundle)
- Custom `nginx.conf` for SPA routing + API/WS proxy
- Expose port `80`

---

### 14.3 — Nginx Configuration

**File**: `frontend/nginx.conf`

| Route | Target | Purpose |
|-------|--------|---------|
| `/` | Local static files | Serve React SPA |
| `/api/` | `backend:8000` | Proxy REST API calls |
| `/ws/` | `backend:8000` | Proxy WebSocket (Socket.IO) |

**SPA handling**: All non-file requests fall through to `index.html` for client-side routing.  
**WebSocket support**: `Upgrade` and `Connection` headers forwarded for Socket.IO.

---

### 14.4 — Docker Compose

**File**: `docker-compose.yml` (project root)

Four services orchestrated together:

| Service | Image | Ports (host:container) | Depends On |
|---------|-------|------------------------|------------|
| `db` | `postgres:16-alpine` | `5432:5432` | — |
| `redis` | `redis:7-alpine` | `6379:6379` | — |
| `backend` | Build `./backend` | `8000:8000` | `db`, `redis` |
| `frontend` | Build `./frontend` | `3000:80` | `backend` |

**Volumes**:
- `postgres_data` — persistent PostgreSQL data (named volume)
- `redis_data` — persistent Redis data (named volume)

**Networks**:
- `trading-net` — internal bridge network for inter-service communication

**Health checks**:
- `db`: `pg_isready -U trading_bot_user`
- `redis`: `redis-cli ping`
- `backend`: `curl -f http://localhost:8000/api/health`
- `frontend`: `curl -f http://localhost:80/`

**Environment variables** loaded from root `.env` file with sensible defaults in Compose.

---

### 14.5 — Docker Ignore Files

**Files**: `backend/.dockerignore`, `frontend/.dockerignore`

Exclude from build context to keep images small and avoid leaking secrets:

| Backend excludes | Frontend excludes |
|-----------------|-------------------|
| `__pycache__/`, `*.pyc` | `node_modules/` |
| `.venv/`, `venv/` | `dist/` |
| `.env` | `.env` |
| `tests/` | `*.md` |
| `*.md`, `.git/` | `.git/` |

---

### 14.6 — Root Environment Template

**File**: `.env.example` (project root)

Unified environment file consumed by `docker-compose.yml`:

```env
# ── Database ────────────────────────────────────────────
POSTGRES_USER=trading_bot_user
POSTGRES_PASSWORD=trading_bot_pass
POSTGRES_DB=trading_bot
DATABASE_URL=postgresql+asyncpg://trading_bot_user:trading_bot_pass@db:5432/trading_bot

# ── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── Alpaca API ──────────────────────────────────────────
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_SECRET_KEY=your_paper_secret_key_here
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# ── Application ─────────────────────────────────────────
ENVIRONMENT=production
LOG_LEVEL=INFO
DEBUG=false

# ── Frontend (build-time) ──────────────────────────────
VITE_API_URL=/api
VITE_WS_URL=/ws
```

> **Note**: Hostnames `db` and `redis` resolve via Docker's internal DNS on the `trading-net` network.

---

## File Inventory (to create)

| # | File | Status | Purpose |
|---|------|--------|---------|
| 1 | `backend/Dockerfile` | ✅ | Multi-stage Python image |
| 2 | `backend/entrypoint.sh` | ✅ | DB wait + migrate + start |
| 3 | `backend/.dockerignore` | ✅ | Exclude dev artifacts |
| 4 | `frontend/Dockerfile` | ✅ | Multi-stage Node → Nginx image |
| 5 | `frontend/nginx.conf` | ✅ | SPA serving + API proxy |
| 6 | `frontend/.dockerignore` | ✅ | Exclude node_modules etc. |
| 7 | `docker-compose.yml` | ✅ | Full stack orchestration |
| 8 | `.env.example` | ✅ | Root environment template |

---

## Acceptance Criteria

- [ ] `docker compose build` completes without errors
- [ ] `docker compose up` starts all four services (db, redis, backend, frontend)
- [ ] PostgreSQL initializes and Alembic migrations run automatically
- [ ] Backend health check passes: `GET http://localhost:8000/api/health`
- [ ] Frontend loads in browser at `http://localhost:3000`
- [ ] API calls from frontend proxy correctly through Nginx to backend
- [ ] WebSocket (Socket.IO) connections work through Nginx proxy
- [ ] `docker compose down -v` cleanly tears down all services and volumes
- [ ] Images use non-root users where possible
- [ ] No secrets or `.env` files baked into images
- [ ] Backend image size < 300 MB, Frontend image size < 50 MB

---

## Architecture Diagram

```
                    Host Machine
                         │
            ┌────────────┼────────────┐
            │ :3000      │ :8000      │ :5432  :6379
            ▼            ▼            ▼        ▼
     ┌────────────┐ ┌─────────┐ ┌────────┐ ┌───────┐
     │  frontend  │ │ backend │ │   db   │ │ redis │
     │  (Nginx)   │ │(Uvicorn)│ │(PG 16) │ │ (v7)  │
     └─────┬──────┘ └────┬────┘ └───┬────┘ └───┬───┘
           │              │          │          │
           └──────────────┴──────────┴──────────┘
                    trading-net (bridge)
```

**Request flow**:
```
Browser → :3000 (Nginx)
  ├── Static files → served locally from /usr/share/nginx/html
  ├── /api/*       → proxy_pass http://backend:8000
  └── /ws/*        → proxy_pass http://backend:8000 (WebSocket upgrade)
```

---

## Development vs Production Notes

| Concern | Development (current) | Docker (Sprint D) |
|---------|----------------------|-------------------|
| Backend | `uvicorn --reload` | Uvicorn (no reload) in container |
| Frontend | `npm run dev` (Vite HMR) | Static build served by Nginx |
| Database | Local PostgreSQL | Containerized PostgreSQL |
| Redis | Local Redis or none | Containerized Redis |
| Migrations | Manual `alembic upgrade head` | Automatic on backend startup |
| Env vars | `.env` in `backend/` | Root `.env` → Compose |

> **Tip**: For local development with hot-reload, continue using `uvicorn --reload` and `npm run dev` outside Docker. Use Docker for integration testing and production-like environments.

---

## Potential Issues & Mitigations

| Issue | Mitigation |
|-------|-----------|
| Backend starts before DB is ready | `entrypoint.sh` retry loop + Compose `depends_on` with health check |
| Alembic migration fails on first run | DB created by Postgres container's `POSTGRES_DB` env var |
| Frontend env vars not available at runtime | Vite bakes `VITE_*` vars at build time via `ARG` → `ENV` in Dockerfile |
| WebSocket proxy drops connection | Nginx config includes `proxy_set_header Upgrade` and `Connection "upgrade"` |
| Large image sizes | Multi-stage builds, `.dockerignore`, Alpine base images |
| Secrets in image layers | `.env` in `.dockerignore`, no `COPY .env` in Dockerfiles |

---

## Commands Reference

```bash
# Build all images
docker compose build

# Start all services (detached)
docker compose up -d

# View logs
docker compose logs -f              # all services
docker compose logs -f backend      # backend only

# Check service health
docker compose ps

# Run migrations manually (if needed)
docker compose exec backend alembic upgrade head

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (full reset)
docker compose down -v

# Rebuild a single service
docker compose build backend
docker compose up -d backend
```

---

## Next Steps (After Sprint D)

| Sprint | Phases | Description |
|--------|--------|-------------|
| **Sprint E** | 15 | Testing & Hardening — API endpoint tests, structured logging, error handling |

---

**Last Updated**: February 19, 2026  
**Status**: Implementation complete — ready for validation  
**Previous**: `SPRINT_C_PLAN.md`
