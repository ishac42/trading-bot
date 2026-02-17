# Feb 16 Implementation Plan — Backend Phases 9–15

## Current Status Summary

**Date**: February 16, 2026  
**Last Updated**: February 17, 2026  
**Overall Progress**: Phases 1–13 complete. Sprints A–C are fully implemented. The API shell, database layer, all CRUD endpoints, WebSocket layer, Alpaca client, trading engine, indicators, signal generator, and risk manager are all operational. The frontend has `USE_MOCK = false` on every hook and is wired to the live backend. Unit tests for business logic (148 tests) all pass.

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Project Foundation & Setup | ✅ Complete |
| Phase 2 | Database Layer | ✅ Complete |
| Phase 3 | Pydantic Schemas & API Contracts | ✅ Complete |
| Phase 4 | Bot Management API | ✅ Complete |
| Phase 5 | Trade Management API | ✅ Complete |
| Phase 6 | Position Management API | ✅ Complete |
| Phase 7 | Market Data API & Dashboard Summary | ✅ Complete — wired to Alpaca |
| Phase 8 | WebSocket Real-time Layer | ✅ Complete |
| Phase 9 | Alpaca Client Integration | ✅ Complete |
| Phase 10 | Trading Engine Core | ✅ Complete |
| Phase 11 | Indicator Calculator | ✅ Complete |
| Phase 12 | Signal Generator | ✅ Complete |
| Phase 13 | Risk Manager | ✅ Complete |
| Phase 14 | Docker & Deployment | ❌ Not started |
| Phase 15 | Testing & Hardening | ⚠️ Partial — unit tests done, API/integration tests + logging remaining |

### What Exists Today

**Backend files implemented:**
```
backend/app/
├── __init__.py
├── main.py              ✅ FastAPI app, CORS, routers, lifespan, TradingEngine lifecycle
├── config.py            ✅ pydantic-settings, all env vars
├── database.py          ✅ Async engine, session factory, get_db
├── models.py            ✅ Bot, Trade, Position ORM models + indexes (entry_indicator on Position)
├── schemas.py           ✅ All Pydantic schemas (entry_indicator on PositionResponse, no primary_indicator)
├── dependencies.py      ✅ Shared deps (get_db re-export)
├── websocket_manager.py ✅ Socket.IO server + WebSocketManager singleton
├── alpaca_client.py     ✅ Alpaca API wrapper (account, orders, positions, market data, safety)
├── trading_engine.py    ✅ TradingEngine + BotRunner (entry-indicator tracking strategy)
├── indicators.py        ✅ 7 indicators (RSI, MACD, SMA, EMA, BBands, Stochastic, OBV) via pandas/numpy
├── signal_generator.py  ✅ Signal enum + evaluate/evaluate_single/evaluate_per_indicator
├── risk_manager.py      ✅ 4 risk checks + 3 calculation helpers
└── routers/
    ├── __init__.py
    ├── bots.py          ✅ Full CRUD + start/stop/pause wired to TradingEngine
    ├── trades.py        ✅ Filtering, sorting, pagination, stats
    ├── positions.py     ✅ List, get, close with entry_indicator + Alpaca integration
    └── market_data.py   ✅ /summary, /market-status, /market-data wired to Alpaca
```

**Test files implemented:**
```
backend/tests/
├── conftest.py              ✅ OHLCV bar fixtures, indicator/bot/risk config presets
├── test_indicators.py       ✅ 44 tests — all 7 indicators + JSON serialization + edge cases
├── test_signal_generator.py ✅ 57 tests — per-indicator eval, majority vote, evaluate, evaluate_single
└── test_risk_manager.py     ✅ 47 tests — all risk checks, calculation helpers, async validate
```

**Other implemented items:**
- `backend/.env.example` — ✅ Created with all env vars
- `backend/alembic/versions/` — ✅ 3 migrations (initial, add primary_indicator, entry_indicator tracking)
- `alpaca-py`, `pandas`, `numpy` — ✅ Uncommented and installed in venv
- `pandas-ta` — ⚠️ Commented out (Python 3.14 incompatible; using raw pandas/numpy instead)

**Still missing:**
- `backend/Dockerfile` — no container definition
- `frontend/Dockerfile` — no container definition
- `docker-compose.yml` — no orchestration
- `scripts/init-db.sh` — no DB init script
- `backend/tests/test_bots.py` — no API endpoint tests
- `backend/tests/test_trades.py` — no API endpoint tests
- `backend/tests/test_positions.py` — no API endpoint tests
- `backend/tests/test_market_data.py` — no API endpoint tests
- `backend/tests/test_trading_engine.py` — no integration tests
- Structured logging (`structlog`) not yet implemented
- Global exception handler not yet added

### Signal Strategy Note

The signal strategy evolved from the original "Single Indicator Per Bot" (Option A) to **"Entry-Indicator Tracking: Per-Position Exit Strategy"** (see `ENTRY_INDICATOR_TRACKING.md`). Key changes:
- `primary_indicator` removed from `Bot` model/schemas/UI
- `entry_indicator` added to `Position` model/schemas
- `trading_engine.py` uses `evaluate_per_indicator()` for BUY (first indicator to signal BUY wins and tags the position)
- For SELL, only the `entry_indicator` of the open position is consulted
- Legacy positions without `entry_indicator` fall back to majority-vote `evaluate()`

---

## Implementation Roadmap

### Sprint A: Alpaca Client Integration (Phase 9) — ✅ COMPLETE

**Goal**: Create a complete wrapper around the Alpaca API for order execution, account data, market clock, quotes, and real-time streaming.

**Estimated effort**: 1–2 days  
**Completed**: February 17, 2026

#### Tasks

##### A.1 — Uncomment trading dependencies in `requirements.txt`
- [x] Uncomment `alpaca-py>=0.33.0`
- [x] ~~Uncomment `pandas-ta>=0.3.14b`~~ — skipped (Python 3.14 incompatible), using raw pandas/numpy
- [x] Uncomment `pandas>=2.2.0`
- [x] Uncomment `numpy>=1.26.0`
- [x] Run `pip install -r requirements.txt` in venv

##### A.2 — Create `app/alpaca_client.py`
- [x] Initialize `alpaca-py` `TradingClient` and `StockHistoricalDataClient`
- [x] **Account methods**: `get_account()` → buying power, equity, etc.
- [x] **Order methods**: `submit_order()`, `get_order()`, `cancel_order()`
- [x] **Position methods**: `get_positions()`, `close_position()`
- [x] **Market data methods**: `get_clock()`, `get_latest_quote()`, `get_bars()`
- [x] **Streaming methods**: `subscribe_to_trades()`, `subscribe_to_quotes()`, `unsubscribe()`

##### A.3 — Error handling & safety
- [x] Wrap all Alpaca calls in `try/except`
- [x] Handle rate limiting (429), market-closed errors, insufficient-funds errors
- [x] Log all API interactions
- [x] Add paper-vs-live safety check: refuse live trading unless `ALPACA_BASE_URL` explicitly set to live

##### A.4 — Wire up Phase 7 placeholders
- [x] `GET /api/market-status` → calls `alpaca_client.get_clock()` and returns real data
- [x] `GET /api/market-data/{symbol}` → calls `alpaca_client.get_latest_quote(symbol)` and returns real data

##### A.5 — Create `.env.example`
- [x] Created with `DATABASE_URL`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_BASE_URL`, `REDIS_URL`, `ENVIRONMENT`, `LOG_LEVEL`, `CORS_ORIGINS`, `WS_PING_INTERVAL/TIMEOUT`

#### Acceptance Criteria
- [x] Can submit paper-trading market orders via Alpaca
- [x] Can retrieve account info and positions
- [x] `GET /api/market-status` returns real Alpaca clock data
- [x] `GET /api/market-data/{symbol}` returns real latest quote
- [x] Error handling prevents crashes on API failures
- [x] Frontend `useMarketStatus` shows live market open/close

---

### Sprint B: Trading Engine Core (Phase 10) — ✅ COMPLETE

**Goal**: Build the main orchestrator that runs bots, processes market data, and executes trades.

**Estimated effort**: 2–3 days  
**Depends on**: Sprint A (Alpaca client)  
**Completed**: February 17, 2026

#### Tasks

##### B.1 — Create `app/trading_engine.py`
- [x] `TradingEngine` class with `__init__`, `bots` dict, `start()`, `stop()`, `register_bot()`, `unregister_bot()`, `pause_bot()`, `get_today_pnl()`, `get_open_position_count()`

##### B.2 — Create `BotRunner` class (inside `trading_engine.py`)
- [x] `__init__(bot_config, engine)`, `start()`, `stop()`
- [x] `_trading_loop()` — runs every `trading_frequency` seconds with full indicator → signal → risk → execute pipeline
- [x] `_is_within_trading_window()` — EST time comparison
- [x] `_execute_buy()` / `_execute_sell()` — Alpaca orders, DB records, SL/TP, WebSocket events
- [x] `_process_symbol()` — uses `evaluate_per_indicator()` for entry-indicator tracking strategy
- [x] SL/TP checking via `_check_stop_loss_take_profit()`

##### B.3 — Integrate engine into `main.py` lifecycle
- [x] `lifespan()` startup: instantiate `TradingEngine`, store on `app.state`
- [x] Load all bots with `status='running'` from DB, register them
- [x] `lifespan()` shutdown: call `engine.stop()`, dispose engine
- [x] Alpaca client initialized and connected on startup

##### B.4 — Wire bot routers to engine
- [x] `POST /api/bots/{id}/start` → `engine.register_bot(bot_id)`
- [x] `POST /api/bots/{id}/stop` → `engine.unregister_bot(bot_id)`
- [x] `POST /api/bots/{id}/pause` → `engine.pause_bot(bot_id)`
- [x] `POST /api/positions/{id}/close` → Alpaca sell order

##### B.5 — Market monitor loop
- [x] `_market_monitor_loop()` — checks Alpaca clock every 60s, emits `market_status_changed`

#### Acceptance Criteria
- [x] Engine starts on app startup, stops on shutdown
- [x] Bots run their trading loops at configured intervals
- [x] Market hours are respected (bots only trade during configured windows)
- [x] Multiple bots can run concurrently without interference
- [x] Bot errors are caught and logged (don't crash the engine)
- [x] Start/stop/pause from API correctly manages bot lifecycle

---

### Sprint C: Indicators, Signals & Risk Management (Phases 11–13) — ✅ COMPLETE

**Goal**: Build the trading brain — indicator calculations, signal evaluation, and risk enforcement.

**Estimated effort**: 2–3 days  
**Depends on**: Sprint A (for market data), Sprint B (for integration)  
**Completed**: February 17, 2026

#### Tasks — Phase 11: Indicator Calculator

##### C.1 — Create `app/indicators.py`
- [x] `IndicatorCalculator` class with `calculate(bars, config)` dispatcher
- [x] `_bars_to_dataframe(bars)` → pandas DataFrame
- [x] Individual calculators using raw pandas/numpy (not pandas-ta):
  - `_calc_rsi(df, params)` → `{ value, period, oversold, overbought }`
  - `_calc_macd(df, params)` → `{ macd, signal, histogram, fast, slow, signal_period }`
  - `_calc_sma(df, params)` → `{ value, period, price }`
  - `_calc_ema(df, params)` → `{ value, period, price }`
  - `_calc_bbands(df, params)` → `{ upper, middle, lower, price, bandwidth }`
  - `_calc_stochastic(df, params)` → `{ k, d, k_period, d_period }`
  - `_calc_obv(df, params)` → `{ value, change }`
- [x] Handle insufficient data gracefully (return `None` values)
- [x] All results are JSON-serializable (tested with 44 unit tests)

#### Tasks — Phase 12: Signal Generator

##### C.2 — Create `app/signal_generator.py`
- [x] `Signal` enum: `BUY`, `SELL`, `HOLD` (str-based)
- [x] `SignalGenerator` class with:
  - `evaluate(indicators, config)` → majority-vote signal + details
  - `evaluate_single(primary, indicators, config)` → single-indicator-driven signal
  - `evaluate_per_indicator(indicators, config)` → dict of indicator → Signal (for entry-indicator tracking)
  - Individual evaluators: `_eval_rsi`, `_eval_macd`, `_eval_sma`, `_eval_ema`, `_eval_bbands`, `_eval_stochastic`, `_eval_obv`
  - `_majority_vote()` — requires ≥2 votes for BUY/SELL, majority wins
- [x] 57 unit tests pass

#### Tasks — Phase 13: Risk Manager

##### C.3 — Create `app/risk_manager.py`
- [x] `RiskManager` class with:
  - `validate(signal, bot_config, symbol, current_price, today_pnl, open_position_count)` → `(bool, reason)`
  - Risk checks: `_check_capital_available`, `_check_position_size`, `_check_daily_loss_limit`, `_check_max_positions`
  - Calculation helpers: `calculate_position_size()`, `calculate_stop_loss()`, `calculate_take_profit()`
- [x] All checks must pass for trade to be allowed (SELL always allowed)
- [x] 47 unit tests pass

#### Acceptance Criteria
- [x] All 7 indicators calculate correctly from OHLCV data
- [x] Signal generator produces correct buy/sell signals for known scenarios
- [x] Majority voting only produces signals when majority of indicators agree
- [x] Risk manager blocks trades exceeding position size limits
- [x] Risk manager blocks trades when daily loss limit is exceeded
- [x] Risk manager blocks trades when max concurrent positions reached
- [x] Stop-loss and take-profit prices calculated correctly
- [x] **148 unit tests pass** for all three modules (indicators: 44, signals: 57, risk: 47)

---

### Sprint D: Docker & Deployment (Phase 14)

**Goal**: Containerize the full stack for easy deployment and local development.

**Estimated effort**: 0.5–1 day  
**Depends on**: Sprints A–C (all application code should be in place)

#### Tasks

##### D.1 — Create `backend/Dockerfile`
- [ ] Base image: `python:3.11-slim`
- [ ] Copy and install `requirements.txt`
- [ ] Copy application code
- [ ] Expose port 8000
- [ ] CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

##### D.2 — Create `frontend/Dockerfile`
- [ ] Base image: `node:20-alpine`
- [ ] Copy `package.json` and `package-lock.json`, run `npm ci`
- [ ] Copy source code
- [ ] CMD: `npm run dev -- --host`
- [ ] (Optional) Multi-stage build for production with `nginx`

##### D.3 — Create `docker-compose.yml` (project root)
- [ ] Services:
  - `db` — PostgreSQL 16 with health check
  - `redis` — Redis 7 Alpine with health check
  - `backend` — FastAPI app, depends on db + redis, volume mount for hot reload
  - `frontend` — React app, depends on backend, volume mount for hot reload
- [ ] Environment variables from `.env` file
- [ ] Named volume for `pgdata` persistence
- [ ] Network configuration

##### D.4 — Create `scripts/init-db.sh`
- [ ] Run Alembic migrations inside the backend container
- [ ] Optional: seed data for development

#### Acceptance Criteria
- [ ] `docker-compose up` starts all 4 services cleanly
- [ ] Backend connects to PostgreSQL and Redis
- [ ] Frontend loads and connects to backend API
- [ ] Database migrations run successfully on first start
- [ ] Hot reload works for both frontend and backend in dev mode

---

### Sprint E: Testing & Hardening (Phase 15) — ⚠️ PARTIALLY COMPLETE

**Goal**: Comprehensive testing, structured logging, and production-readiness.

**Estimated effort**: 2–3 days  
**Depends on**: All prior sprints

#### Tasks

##### E.1 — Test infrastructure
- [x] Create `backend/tests/conftest.py`:
  - OHLCV bar data factories (trending up/down, flat, volatile, overbought, oversold, few bars)
  - Indicator config presets (RSI, MACD, SMA, EMA, BBands, Stochastic, OBV, all-indicators)
  - Bot config and risk config presets
- [x] Configure `pytest-asyncio` for async test support

##### E.2 — API endpoint tests
- [ ] `test_bots.py`:
  - Test create bot (201 + correct response shape)
  - Test list bots (empty + with data)
  - Test get bot by ID (200 + 404)
  - Test update bot (200 + 404)
  - Test delete bot (success + running-bot guard + 404)
  - Test start/stop/pause transitions
- [ ] `test_trades.py`:
  - Test list trades (empty + with data)
  - Test date range filtering (today, week, month, custom, all)
  - Test bot/symbol/type filters
  - Test sorting (all fields, asc/desc)
  - Test pagination (page, pageSize, totalItems, totalPages)
  - Test get single trade (200 + 404)
  - Test trade stats computation (win rate, P&L, profit factor)
- [ ] `test_positions.py`:
  - Test list positions (filters, sorting)
  - Test get single position (200 + 404)
  - Test close position (success + already-closed guard + 404)
  - Test close creates sell trade record
- [ ] `test_market_data.py`:
  - Test summary stats computation
  - Test market status endpoint

##### E.3 — Unit tests for business logic
- [x] `test_indicators.py` — **44 tests** ✅:
  - Test each of 7 indicators with trending/overbought/oversold datasets
  - Test insufficient data handling (returns None)
  - Test JSON serializability
  - Test correct output keys
  - Test singleton instance
- [x] `test_signal_generator.py` — **57 tests** ✅:
  - Test RSI/MACD/SMA/EMA/BBands/Stochastic/OBV buy/sell/hold
  - Test majority voting (ties, no-majority, min-2-vote requirement)
  - Test evaluate (majority vote), evaluate_single (primary indicator), evaluate_per_indicator
  - Test edge cases (None values, unknown indicators, empty inputs)
- [x] `test_risk_manager.py` — **47 tests** ✅:
  - Test full validate() pipeline (BUY/SELL/HOLD)
  - Test capital availability, position size, daily loss, max positions
  - Test calculation helpers (position size, stop-loss, take-profit)
  - Test edge cases (zero capital, negative price, exact boundary values)
  - Test async validation

##### E.4 — Structured logging
- [ ] Replace all `print()` statements with `structlog` logger
- [ ] Configure JSON output in production, pretty output in development
- [ ] Log: API requests, trade executions, bot state changes, errors, WebSocket events

##### E.5 — Error handling
- [ ] Add global exception handler in FastAPI:
  - Return `{ "detail": "message", "error_code": "CODE" }` for all errors
  - Handle `ValueError`, `sqlalchemy` errors, Alpaca API errors
- [ ] Add request validation error formatting (422 responses)
- [ ] Add database connection retry logic

##### E.6 — Performance
- [ ] Verify database connection pooling is correctly sized (`pool_size`, `max_overflow`)
- [ ] Verify no blocking I/O in async code
- [ ] Add `select_in_loading` or `joined` eager loading where needed (avoid N+1 queries)

#### Acceptance Criteria
- [x] >80% test coverage on business logic (indicators, signals, risk) — **148 tests, all passing**
- [ ] All API endpoints have at least one happy-path and one error-case test
- [ ] Structured logging replaces all print statements
- [ ] Error responses are consistent and informative
- [x] All tests pass in CI (`pytest` returns exit 0)

---

## Dependency Graph

```
Sprint A: Alpaca Client (Phase 9)
    │
    ├──────────────────────┐
    │                      │
    ▼                      ▼
Sprint B: Trading Engine   Finish Phase 7 (market-status,
  (Phase 10)               market-data endpoints)
    │
    ▼
Sprint C: Indicators + Signals + Risk
  (Phases 11, 12, 13)
    │
    ├──────────────────────┐
    │                      │
    ▼                      ▼
Sprint D: Docker           Sprint E: Testing &
  (Phase 14)               Hardening (Phase 15)
```

---

## Estimated Timeline

| Sprint | Phases | Days | Cumulative |
|--------|--------|------|------------|
| **Sprint A** | 9 (+ finish 7) | 1–2 days | Days 1–2 |
| **Sprint B** | 10 | 2–3 days | Days 3–5 |
| **Sprint C** | 11, 12, 13 | 2–3 days | Days 6–8 |
| **Sprint D** | 14 | 0.5–1 day | Day 9 |
| **Sprint E** | 15 | 2–3 days | Days 10–12 |

**Total estimated effort: ~10–12 working days**

---

## Files To Create

| File | Sprint | Description | Status |
|------|--------|-------------|--------|
| `backend/app/alpaca_client.py` | A | Alpaca API wrapper | ✅ Created |
| `backend/.env.example` | A | Environment variable template | ✅ Created |
| `backend/app/trading_engine.py` | B | Core orchestrator + BotRunner | ✅ Created |
| `backend/app/indicators.py` | C | pandas/numpy indicator calculations | ✅ Created |
| `backend/app/signal_generator.py` | C | Signal generation with majority voting | ✅ Created |
| `backend/app/risk_manager.py` | C | Risk management enforcement | ✅ Created |
| `backend/Dockerfile` | D | Backend container | ❌ Not started |
| `frontend/Dockerfile` | D | Frontend container | ❌ Not started |
| `docker-compose.yml` | D | Full-stack orchestration | ❌ Not started |
| `scripts/init-db.sh` | D | DB migration script | ❌ Not started |
| `backend/tests/conftest.py` | E | Test fixtures (OHLCV bars, configs) | ✅ Created |
| `backend/tests/test_bots.py` | E | Bot API tests | ❌ Not started |
| `backend/tests/test_trades.py` | E | Trade API tests | ❌ Not started |
| `backend/tests/test_positions.py` | E | Position API tests | ❌ Not started |
| `backend/tests/test_market_data.py` | E | Market data API tests | ❌ Not started |
| `backend/tests/test_indicators.py` | E | Indicator unit tests (44 tests) | ✅ Created |
| `backend/tests/test_signal_generator.py` | E | Signal generator unit tests (57 tests) | ✅ Created |
| `backend/tests/test_risk_manager.py` | E | Risk manager unit tests (47 tests) | ✅ Created |
| `backend/tests/test_trading_engine.py` | E | Trading engine integration tests | ❌ Not started |

## Files To Modify

| File | Sprint | Changes | Status |
|------|--------|---------|--------|
| `backend/requirements.txt` | A | Uncomment `alpaca-py`, `pandas`, `numpy` | ✅ Done |
| `backend/app/routers/market_data.py` | A | Replace placeholders with real Alpaca calls | ✅ Done |
| `backend/app/main.py` | B | Add TradingEngine lifecycle (startup/shutdown) | ✅ Done |
| `backend/app/routers/bots.py` | B | Wire start/stop/pause to TradingEngine | ✅ Done |
| `backend/app/routers/positions.py` | B | Wire close to Alpaca sell order + entry_indicator | ✅ Done |
| `backend/app/models.py` | B | Add `entry_indicator` to Position, remove `primary_indicator` from Bot | ✅ Done |
| `backend/app/schemas.py` | B | Add `entry_indicator` to PositionResponse, remove `primary_indicator` | ✅ Done |
| `backend/app/main.py` | E | Add global exception handler | ❌ Not started |
| `backend/app/websocket_manager.py` | E | Replace `print()` with `structlog` | ❌ Not started |

---

## Risk Mitigation

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Alpaca API rate limits | Medium | Implement exponential backoff; cache market clock result for 60s | ✅ Handled in `alpaca_client.py` |
| pandas-ta version compatibility | Low | Skipped pandas-ta entirely; using raw pandas/numpy for Python 3.14 compat | ✅ Resolved |
| Trading engine async complexity | High | Start with single-bot testing; add concurrency incrementally | ✅ Engine implemented |
| WebSocket disconnections during trades | High | Make trade execution atomic; log state before/after each step | ⚠️ Basic impl, needs hardening |
| Insufficient test coverage | Medium | Write tests alongside each sprint, not deferred to Sprint E only | ✅ 148 unit tests passing |
| Live trading safety | Critical | Default to paper trading; require explicit env var for live; add confirmation log on startup | ✅ Safety check in `alpaca_client.py` |

---

## Quick-Start: Next Steps (Sprint D or E)

All application code (Sprints A–C) is complete. To continue:

```bash
cd backend

# 1. Activate venv
.\venv\Scripts\Activate.ps1

# 2. Run existing unit tests (148 tests)
python -m pytest tests/ -v

# 3. Next: Sprint D (Docker) or Sprint E (API tests + logging)
```

**Remaining work:**
- **Sprint D** (Phase 14): Dockerfiles + docker-compose — ~0.5–1 day
- **Sprint E** (Phase 15): API endpoint tests, trading engine integration tests, structured logging, global error handler — ~2 days

---

**Last Updated**: February 17, 2026  
**Version**: 2.0  
**Previous Plan References**: `BACKEND_IMPLEMENTATION_PLAN.md`, `SPRINT_0_SUMMARY.md`, `ENTRY_INDICATOR_TRACKING.md`
