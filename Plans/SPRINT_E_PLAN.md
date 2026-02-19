# Sprint E: Testing & Hardening (Phase 15)

## Overview
**Goal**: Harden the application with API endpoint tests, structured logging, global error handling, and custom exceptions — making the system production-grade.  
**Estimated effort**: 2–3 days  
**Depends on**: Sprint A (Alpaca Client ✅), Sprint B (Trading Engine ✅), Sprint C (Indicators/Signals/Risk ✅), Sprint D (Docker ✅)

---

## Current Status

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Custom Exceptions | `app/exceptions.py` | ✅ Complete | 8 exception classes with error codes |
| Error Response Schema | `app/schemas.py` | ✅ Complete | `ErrorResponseSchema` + `ErrorDetailSchema` |
| Middleware | `app/middleware.py` | ✅ Complete | RequestId + RequestLogging + 3 exception handlers |
| Logging Config | `app/logging_config.py` | ✅ Complete | structlog: JSON (prod) / Console (dev) |
| Main App Wiring | `app/main.py` | ✅ Complete | Logging init + middleware registration |
| Bot Router | `app/routers/bots.py` | ✅ Refactored | Custom exceptions + structlog |
| Trade Router | `app/routers/trades.py` | ✅ Refactored | Custom exceptions + structlog |
| Position Router | `app/routers/positions.py` | ✅ Refactored | Custom exceptions + structlog |
| Market Data Router | `app/routers/market_data.py` | ✅ Refactored | Custom exceptions + structlog |
| Trading Engine | `app/trading_engine.py` | ✅ Migrated | structlog |
| Alpaca Client | `app/alpaca_client.py` | ✅ Migrated | structlog |
| Indicators | `app/indicators.py` | ✅ Migrated | structlog |
| Signal Generator | `app/signal_generator.py` | ✅ Migrated | structlog |
| Risk Manager | `app/risk_manager.py` | ✅ Migrated | structlog |
| Test Infrastructure | `tests/conftest.py` | ✅ Complete | Async client, in-memory SQLite, mocks |
| Bot Router Tests | `tests/test_router_bots.py` | ✅ Complete | 20 tests |
| Trade Router Tests | `tests/test_router_trades.py` | ✅ Complete | 10 tests |
| Position Router Tests | `tests/test_router_positions.py` | ✅ Complete | 10 tests |
| Market Data Tests | `tests/test_router_market_data.py` | ✅ Complete | 7 tests |

---

## Phase 15 Tasks

### 15.1 — Custom Exception Classes

**File**: `app/exceptions.py` (new)

Define a hierarchy of domain exceptions so business logic never raises raw `HTTPException`:

| Exception | HTTP Status | Use Case |
|-----------|------------|----------|
| `AppException` (base) | 500 | Base class for all app exceptions |
| `NotFoundError` | 404 | Bot / Trade / Position not found |
| `ConflictError` | 409 | Bot already running, position already closed |
| `ValidationError` | 422 | Invalid config, bad indicator params |
| `ExternalServiceError` | 502 | Alpaca API failure, market data unavailable |
| `RateLimitError` | 429 | Alpaca rate limit hit |
| `InsufficientCapitalError` | 400 | Risk check failure — not enough capital |
| `TradingNotAllowedError` | 403 | Market closed, bot not in correct state |

Each exception carries:
- `message` — Human-readable description
- `error_code` — Machine-readable string (e.g. `BOT_NOT_FOUND`, `MARKET_CLOSED`)
- `details` — Optional dict with contextual data

---

### 15.2 — Standardized Error Response Schema

**File**: `app/schemas.py` (add to existing)

All error responses follow a consistent shape:

```json
{
  "error": {
    "code": "BOT_NOT_FOUND",
    "message": "Bot with ID abc-123 not found",
    "details": {},
    "request_id": "req_7f3a..."
  }
}
```

Schema:
- `ErrorDetailSchema` — `code: str`, `message: str`, `details: dict | None`, `request_id: str | None`
- `ErrorResponseSchema` — `error: ErrorDetailSchema`

---

### 15.3 — Global Exception Handler Middleware

**File**: `app/middleware.py` (new)

Register FastAPI exception handlers in `app/main.py`:

| Handler | Catches | Response |
|---------|---------|----------|
| `app_exception_handler` | `AppException` subclasses | Maps to correct HTTP status + `ErrorResponseSchema` |
| `validation_exception_handler` | Pydantic `RequestValidationError` | 422 with field-level error details |
| `unhandled_exception_handler` | `Exception` | 500 generic error (hides internals in production) |

Additional middleware:
- **RequestIdMiddleware** — Generates a `X-Request-ID` header (UUID) for every request, attaches to logging context and error responses
- **RequestLoggingMiddleware** — Logs method, path, status code, and duration for every request

---

### 15.4 — Structured Logging with structlog

**File**: `app/logging_config.py` (new)

`structlog` is already in `requirements.txt` but not configured. Set up:

| Environment | Renderer | Output |
|-------------|----------|--------|
| Development | `ConsoleRenderer` | Colorized, human-readable |
| Production | `JSONRenderer` | Machine-parseable JSON lines |

**Processors pipeline**:
1. `structlog.contextvars.merge_contextvars` — Merge request-scoped context (request_id, bot_id, etc.)
2. `structlog.processors.TimeStamper(fmt="iso")` — ISO 8601 timestamps
3. `structlog.processors.StackInfoRenderer` — Stack info on errors
4. `structlog.processors.format_exc_info` — Format exception tracebacks
5. `structlog.processors.UnicodeDecoder` — Handle encoding
6. Renderer (Console or JSON based on `ENVIRONMENT`)

**Integration points**:
- Call `configure_logging()` in `app/main.py` on startup
- Replace `logging.getLogger(__name__)` with `structlog.get_logger()` in all modules:
  - `app/trading_engine.py`
  - `app/signal_generator.py`
  - `app/risk_manager.py`
  - `app/indicators.py`
  - `app/alpaca_client.py`
  - `app/routers/bots.py`
  - `app/routers/trades.py`
  - `app/routers/positions.py`
  - `app/routers/market_data.py`
- Bind contextual data: `logger.bind(bot_id=bot.id, symbol=symbol)`

---

### 15.5 — API Test Infrastructure

**File**: `tests/conftest.py` (extend existing)

Set up shared fixtures for API testing:

| Fixture | Scope | Purpose |
|---------|-------|---------|
| `async_engine` | session | In-memory SQLite async engine with all tables created |
| `async_session` | function | Fresh async session per test, rolled back after each |
| `client` | function | `httpx.AsyncClient` with app mounted, DB session overridden |
| `sample_bot` | function | Pre-created bot record in DB |
| `sample_trade` | function | Pre-created trade record in DB |
| `sample_position` | function | Pre-created open position record in DB |
| `mock_alpaca` | function | Mocked `AlpacaClient` to avoid real API calls |

**Testing library**: `httpx` (already a dependency) with `ASGITransport` for async FastAPI testing.

---

### 15.6 — Bot Router Tests

**File**: `tests/test_router_bots.py` (new)

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | List bots (empty) | `GET /api/bots` | 200, `[]` |
| 2 | List bots (with data) | `GET /api/bots` | 200, list of bots |
| 3 | Create bot (valid) | `POST /api/bots` | 201, bot object returned |
| 4 | Create bot (missing required fields) | `POST /api/bots` | 422, validation error |
| 5 | Get bot (exists) | `GET /api/bots/{id}` | 200, bot object |
| 6 | Get bot (not found) | `GET /api/bots/{id}` | 404, error response |
| 7 | Update bot (valid) | `PUT /api/bots/{id}` | 200, updated bot |
| 8 | Update bot (not found) | `PUT /api/bots/{id}` | 404, error response |
| 9 | Delete bot (stopped) | `DELETE /api/bots/{id}` | 200, success |
| 10 | Delete bot (running — blocked) | `DELETE /api/bots/{id}` | 409, conflict |
| 11 | Delete bot (not found) | `DELETE /api/bots/{id}` | 404, error response |
| 12 | Start bot | `POST /api/bots/{id}/start` | 200, bot status=running |
| 13 | Start bot (already running) | `POST /api/bots/{id}/start` | 409, conflict |
| 14 | Stop bot | `POST /api/bots/{id}/stop` | 200, bot status=stopped |
| 15 | Pause bot | `POST /api/bots/{id}/pause` | 200, bot status=paused |
| 16 | Resume bot (from paused) | `POST /api/bots/{id}/resume` | 200, bot status=running |
| 17 | Resume bot (not paused) | `POST /api/bots/{id}/resume` | 400, error |

---

### 15.7 — Trade Router Tests

**File**: `tests/test_router_trades.py` (new)

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | List trades (empty) | `GET /api/trades` | 200, paginated empty |
| 2 | List trades (with data) | `GET /api/trades` | 200, paginated trades |
| 3 | List trades (filter by bot) | `GET /api/trades?botId=X` | 200, filtered list |
| 4 | List trades (filter by symbol) | `GET /api/trades?symbol=AAPL` | 200, filtered list |
| 5 | List trades (filter by date range) | `GET /api/trades?dateRange=week` | 200, filtered list |
| 6 | List trades (pagination) | `GET /api/trades?page=2&pageSize=5` | 200, correct page |
| 7 | List trades (sort by price desc) | `GET /api/trades?sortField=price&sortDirection=desc` | 200, sorted |
| 8 | Get trade (exists) | `GET /api/trades/{id}` | 200, trade object |
| 9 | Get trade (not found) | `GET /api/trades/{id}` | 404, error response |
| 10 | Get trade stats | `GET /api/trades/stats` | 200, stats object |
| 11 | Get trade stats (no trades) | `GET /api/trades/stats` | 200, zeroed stats |

---

### 15.8 — Position Router Tests

**File**: `tests/test_router_positions.py` (new)

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | List positions (empty) | `GET /api/positions` | 200, `[]` |
| 2 | List positions (with data) | `GET /api/positions` | 200, position list |
| 3 | List positions (filter by bot) | `GET /api/positions?botId=X` | 200, filtered |
| 4 | List positions (filter by symbol) | `GET /api/positions?symbol=AAPL` | 200, filtered |
| 5 | Get position (exists) | `GET /api/positions/{id}` | 200, position object |
| 6 | Get position (not found) | `GET /api/positions/{id}` | 404, error response |
| 7 | Close position (success) | `POST /api/positions/{id}/close` | 200, closed position |
| 8 | Close position (already closed) | `POST /api/positions/{id}/close` | 400, error |
| 9 | Close position (Alpaca failure) | `POST /api/positions/{id}/close` | 502, external error |

---

### 15.9 — Market Data & Health Router Tests

**File**: `tests/test_router_market_data.py` (new)

| # | Test | Method | Expected |
|---|------|--------|----------|
| 1 | Health check | `GET /api/health` | 200, status fields |
| 2 | Market status | `GET /api/market-status` | 200, market status |
| 3 | Market status (Alpaca failure) | `GET /api/market-status` | 502, error |
| 4 | Market data for symbol | `GET /api/market-data/AAPL` | 200, quote data |
| 5 | Market data (Alpaca failure) | `GET /api/market-data/AAPL` | 502, error |
| 6 | Dashboard summary | `GET /api/summary` | 200, summary stats |
| 7 | Dashboard summary (no data) | `GET /api/summary` | 200, zeroed stats |

---

### 15.10 — Refactor Routers to Use Custom Exceptions

**Files**: `app/routers/bots.py`, `app/routers/trades.py`, `app/routers/positions.py`, `app/routers/market_data.py`

Replace inline `HTTPException` raises with domain exceptions:

| Before | After |
|--------|-------|
| `raise HTTPException(status_code=404, detail="Bot not found")` | `raise NotFoundError("Bot", bot_id)` |
| `raise HTTPException(status_code=400, detail="Cannot delete running bot")` | `raise ConflictError("Cannot delete a running bot", error_code="BOT_RUNNING")` |
| `raise HTTPException(status_code=502, detail="Failed to fetch market data")` | `raise ExternalServiceError("Alpaca", "Market data fetch failed")` |

This keeps routers clean and ensures all errors flow through the global handler for consistent formatting and logging.

---

## Acceptance Criteria

- [x] Custom exception hierarchy created and used throughout routers
- [x] All error responses follow `ErrorResponseSchema` format
- [x] Global exception handlers registered (app, validation, unhandled)
- [x] `X-Request-ID` header generated for every request
- [x] Request logging middleware logs method, path, status, and duration
- [x] `structlog` configured with JSON output in production, console in development
- [x] All modules migrated from `logging` to `structlog`
- [x] Contextual data (bot_id, symbol, request_id) bound to log entries
- [x] API test infrastructure with async client and DB fixtures
- [x] Bot router: 20 endpoint tests passing
- [x] Trade router: 10 endpoint tests passing
- [x] Position router: 10 endpoint tests passing
- [x] Market data / health router: 7 endpoint tests passing
- [x] All 148 existing unit tests still pass
- [x] Total test count: 195 (148 existing + 47 new API tests)

---

## Dependencies

| Dependency | Version | Status | Notes |
|------------|---------|--------|-------|
| `structlog` | ≥ 24.4.0 | ✅ In requirements.txt | Configured and active |
| `httpx` | ≥ 0.28.0 | ✅ In requirements.txt | Used for async API test client |
| `pytest` | ≥ 8.3.0 | ✅ In requirements.txt | Test runner |
| `pytest-asyncio` | ≥ 0.24.0 | ✅ In requirements.txt | Async test support |
| `aiosqlite` | ≥ 0.20.0 | ✅ Added to requirements.txt | Async SQLite for test DB |

---

## Implementation Order

```
Phase 15.1  Custom exceptions          ─┐
Phase 15.2  Error response schema       ├── Foundation (do first)
Phase 15.3  Global exception handlers   │
Phase 15.4  Structured logging         ─┘
            │
Phase 15.5  API test infrastructure    ─── Scaffold (depends on 15.1–15.3)
            │
Phase 15.6  Bot router tests           ─┐
Phase 15.7  Trade router tests          ├── Tests (parallel, depends on 15.5)
Phase 15.8  Position router tests       │
Phase 15.9  Market data router tests   ─┘
            │
Phase 15.10 Refactor routers          ─── Cleanup (last, after tests exist)
```

Recommended approach:
1. Build the foundation (exceptions, schemas, middleware, logging) first
2. Set up test infrastructure
3. Write API tests against existing behavior (they should pass as-is)
4. Refactor routers to use custom exceptions (tests catch regressions)

---

## File Inventory

| # | File | Status | Purpose |
|---|------|--------|---------|
| 1 | `app/exceptions.py` | ✅ | Custom exception hierarchy |
| 2 | `app/schemas.py` | ✅ | Add `ErrorResponseSchema` |
| 3 | `app/middleware.py` | ✅ | Request ID + request logging middleware |
| 4 | `app/logging_config.py` | ✅ | structlog configuration |
| 5 | `app/main.py` | ✅ | Register handlers, middleware, logging init |
| 6 | `app/routers/bots.py` | ✅ | Use custom exceptions + structlog |
| 7 | `app/routers/trades.py` | ✅ | Use custom exceptions + structlog |
| 8 | `app/routers/positions.py` | ✅ | Use custom exceptions + structlog |
| 9 | `app/routers/market_data.py` | ✅ | Use custom exceptions + structlog |
| 10 | `app/trading_engine.py` | ✅ | Migrate to structlog |
| 11 | `app/alpaca_client.py` | ✅ | Migrate to structlog |
| 12 | `app/signal_generator.py` | ✅ | Migrate to structlog |
| 13 | `app/risk_manager.py` | ✅ | Migrate to structlog |
| 14 | `app/indicators.py` | ✅ | Migrate to structlog |
| 15 | `tests/conftest.py` | ✅ | Add API test fixtures |
| 16 | `tests/test_router_bots.py` | ✅ | Bot endpoint tests (20) |
| 17 | `tests/test_router_trades.py` | ✅ | Trade endpoint tests (10) |
| 18 | `tests/test_router_positions.py` | ✅ | Position endpoint tests (10) |
| 19 | `tests/test_router_market_data.py` | ✅ | Market data + health tests (7) |
| 20 | `pyproject.toml` | ✅ | pytest asyncio_mode=auto config |

---

## Running Tests

```bash
cd backend
.\venv\Scripts\Activate.ps1

# Run all tests (existing + new)
pytest tests/ -v

# Run only API endpoint tests
pytest tests/test_router_bots.py tests/test_router_trades.py tests/test_router_positions.py tests/test_router_market_data.py -v

# Run with coverage
pytest tests/ -v --cov=app --cov-report=term-missing

# Run a specific test file
pytest tests/test_router_bots.py -v --tb=short
```

---

## Architecture After Sprint E

```
Request Flow (with Sprint E hardening):

Browser Request
      │
      ▼
┌─────────────────────────┐
│   RequestIdMiddleware    │  ← Generates X-Request-ID, binds to structlog context
├─────────────────────────┤
│  RequestLoggingMiddleware│  ← Logs method, path, status, duration
├─────────────────────────┤
│     CORS Middleware      │  ← Existing
├─────────────────────────┤
│     FastAPI Router       │
│   ┌───────────────────┐ │
│   │  Route Handler     │ │  ← Raises custom exceptions (NotFoundError, etc.)
│   └────────┬──────────┘ │
│            │ error?      │
│            ▼             │
│   ┌───────────────────┐ │
│   │ Global Exception   │ │  ← Catches AppException → ErrorResponseSchema
│   │ Handlers           │ │  ← Catches ValidationError → 422 details
│   └───────────────────┘ │  ← Catches Exception → 500 generic
└─────────────────────────┘
      │
      ▼
  JSON Response (consistent shape)
```

---

## Next Steps (After Sprint E)

| Sprint | Description |
|--------|-------------|
| **Sprint F** | CI/CD Pipeline — GitHub Actions for automated testing, linting, and Docker builds |
| **Sprint G** | Performance & Monitoring — APM integration, metrics, alerting |

---

**Last Updated**: February 19, 2026  
**Status**: ✅ Complete — 195 tests passing  
**Previous**: `SPRINT_D_PLAN.md`
