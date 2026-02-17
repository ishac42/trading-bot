# Feb 16 Implementation Plan — Backend Phases 9–15

## Current Status Summary

**Date**: February 16, 2026  
**Overall Progress**: Phases 1–8 complete. The API shell, database layer, all CRUD endpoints, and WebSocket layer are fully operational. The frontend has `USE_MOCK = false` on every hook and is wired to the live backend.

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Project Foundation & Setup | ✅ Complete |
| Phase 2 | Database Layer | ✅ Complete |
| Phase 3 | Pydantic Schemas & API Contracts | ✅ Complete |
| Phase 4 | Bot Management API | ✅ Complete |
| Phase 5 | Trade Management API | ✅ Complete |
| Phase 6 | Position Management API | ✅ Complete |
| Phase 7 | Market Data API & Dashboard Summary | ⚠️ Partial — placeholders for market-status & market-data |
| Phase 8 | WebSocket Real-time Layer | ✅ Complete |
| Phase 9 | Alpaca Client Integration | ❌ Not started |
| Phase 10 | Trading Engine Core | ❌ Not started |
| Phase 11 | Indicator Calculator | ❌ Not started |
| Phase 12 | Signal Generator | ❌ Not started |
| Phase 13 | Risk Manager | ❌ Not started |
| Phase 14 | Docker & Deployment | ❌ Not started |
| Phase 15 | Testing & Hardening | ❌ Not started |

### What Exists Today

**Backend files implemented:**
```
backend/app/
├── __init__.py
├── main.py              ✅ FastAPI app, CORS, routers, lifespan, health endpoint
├── config.py            ✅ pydantic-settings, all env vars
├── database.py          ✅ Async engine, session factory, get_db
├── models.py            ✅ Bot, Trade, Position ORM models + indexes
├── schemas.py           ✅ All Pydantic schemas matching frontend types
├── dependencies.py      ✅ Shared deps (get_db re-export)
├── websocket_manager.py ✅ Socket.IO server + WebSocketManager singleton
└── routers/
    ├── __init__.py
    ├── bots.py          ✅ Full CRUD + start/stop/pause with WS events
    ├── trades.py        ✅ Filtering, sorting, pagination, stats
    ├── positions.py     ✅ List, get, close with WS events
    └── market_data.py   ⚠️ /summary done, /market-status & /market-data are placeholders
```

**Backend files NOT yet created:**
```
backend/app/
├── alpaca_client.py      ❌ Phase 9
├── trading_engine.py     ❌ Phase 10
├── indicators.py         ❌ Phase 11
├── signal_generator.py   ❌ Phase 12
└── risk_manager.py       ❌ Phase 13
```

**Other missing items:**
- `backend/.env.example` — no template file
- `backend/Dockerfile` — no container definition
- `docker-compose.yml` — no orchestration
- `backend/tests/conftest.py` — no test fixtures
- `backend/tests/test_*.py` — no test files
- `alpaca-py`, `pandas-ta`, `pandas`, `numpy` still commented out in `requirements.txt`

---

## Implementation Roadmap

### Sprint A: Alpaca Client Integration (Phase 9)

**Goal**: Create a complete wrapper around the Alpaca API for order execution, account data, market clock, quotes, and real-time streaming.

**Estimated effort**: 1–2 days

#### Tasks

##### A.1 — Uncomment trading dependencies in `requirements.txt`
- [ ] Uncomment `alpaca-py>=0.33.0`
- [ ] Uncomment `pandas-ta>=0.3.14b`
- [ ] Uncomment `pandas>=2.2.0`
- [ ] Uncomment `numpy>=1.26.0`
- [ ] Run `pip install -r requirements.txt` in venv

##### A.2 — Create `app/alpaca_client.py`
- [ ] Initialize `alpaca-py` `TradingClient` and `StockHistoricalDataClient`
- [ ] **Account methods**:
  - `get_account()` → buying power, equity, etc.
- [ ] **Order methods**:
  - `submit_order(symbol, qty, side, type='market', time_in_force='day')` → order dict
  - `get_order(order_id)` → order status dict
  - `cancel_order(order_id)` → cancellation dict
- [ ] **Position methods**:
  - `get_positions()` → list of position dicts
  - `close_position(symbol)` → close result dict
- [ ] **Market data methods**:
  - `get_clock()` → market open/close/next times
  - `get_latest_quote(symbol)` → latest bid/ask/last price
  - `get_bars(symbol, timeframe, limit)` → OHLCV bar list
- [ ] **Streaming methods** (for real-time prices):
  - `subscribe_to_trades(symbols, callback)` → register trade stream
  - `subscribe_to_quotes(symbols, callback)` → register quote stream
  - `unsubscribe(symbols)` → unregister streams

##### A.3 — Error handling & safety
- [ ] Wrap all Alpaca calls in `try/except`
- [ ] Handle rate limiting (429), market-closed errors, insufficient-funds errors
- [ ] Log all API interactions
- [ ] Add paper-vs-live safety check: refuse live trading unless `ALPACA_BASE_URL` explicitly set to live

##### A.4 — Wire up Phase 7 placeholders
- [ ] `GET /api/market-status` → call `alpaca_client.get_clock()` and return real data
- [ ] `GET /api/market-data/{symbol}` → call `alpaca_client.get_latest_quote(symbol)` and return real data

##### A.5 — Create `.env.example`
- [ ] Add template for `DATABASE_URL`, `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_BASE_URL`, `REDIS_URL`, `ENVIRONMENT`, `LOG_LEVEL`

#### Acceptance Criteria
- [ ] Can submit paper-trading market orders via Alpaca
- [ ] Can retrieve account info and positions
- [ ] `GET /api/market-status` returns real Alpaca clock data
- [ ] `GET /api/market-data/{symbol}` returns real latest quote
- [ ] Error handling prevents crashes on API failures
- [ ] Frontend `useMarketStatus` shows live market open/close

---

### Sprint B: Trading Engine Core (Phase 10)

**Goal**: Build the main orchestrator that runs bots, processes market data, and executes trades.

**Estimated effort**: 2–3 days  
**Depends on**: Sprint A (Alpaca client)

#### Tasks

##### B.1 — Create `app/trading_engine.py`
- [ ] `TradingEngine` class:
  - `__init__(db_session_factory, alpaca_client, ws_manager)` — hold references
  - `bots: dict[str, BotRunner]` — map of active bot runners
  - `start()` — set running flag, launch `_market_monitor_loop()` as async task
  - `stop()` — halt all bots, cancel loop task
  - `register_bot(bot_id)` — load bot config from DB, create `BotRunner`, start it
  - `unregister_bot(bot_id)` — stop and remove a `BotRunner`
  - `pause_bot(bot_id)` — set `BotRunner.is_paused = True`
  - `get_today_pnl(bot_id)` — query DB for today's realized P&L
  - `get_open_position_count(bot_id)` — query DB for open position count

##### B.2 — Create `BotRunner` class (inside `trading_engine.py` or separate file)
- [ ] `__init__(bot_config, engine)` — store config and reference to engine
- [ ] `start()` — set `is_running = True`, create `_trading_loop()` async task
- [ ] `stop()` — set `is_running = False`, cancel task
- [ ] `_trading_loop()` — runs every `trading_frequency` seconds:
  1. Check `_is_within_trading_window()`
  2. For each symbol in `config['symbols']`:
     a. Fetch latest bars via `engine.alpaca.get_bars()`
     b. Calculate indicators via `engine.indicator_calculator.calculate()`
     c. Generate signals via `engine.signal_generator.evaluate()`
     d. Validate via `engine.risk_manager.validate()`
     e. Execute trade if signal passes
  3. Update `last_run_at` in DB
  4. Handle errors (increment `error_count`, emit status if threshold exceeded)
- [ ] `_is_within_trading_window()` — compare current EST time to bot's start/end hours
- [ ] `_execute_trade(symbol, signal, indicators)`:
  1. Calculate position size via risk manager
  2. Submit order via Alpaca
  3. Wait for fill / check status
  4. Create `Trade` record in DB
  5. Create/update `Position` record in DB
  6. Calculate stop-loss / take-profit prices
  7. Emit `trade_executed` and `position_updated` WebSocket events

##### B.3 — Integrate engine into `main.py` lifecycle
- [ ] In `lifespan()` startup: instantiate `TradingEngine`, store on `app.state`
- [ ] Load all bots with `status='running'` from DB, register them
- [ ] In `lifespan()` shutdown: call `engine.stop()`, dispose engine
- [ ] Add `get_trading_engine` dependency for routers

##### B.4 — Wire bot routers to engine
- [ ] `POST /api/bots/{id}/start` → call `engine.register_bot(bot_id)`
- [ ] `POST /api/bots/{id}/stop` → call `engine.unregister_bot(bot_id)`
- [ ] `POST /api/bots/{id}/pause` → call `engine.pause_bot(bot_id)`
- [ ] `POST /api/positions/{id}/close` → call Alpaca sell order (in live mode)

##### B.5 — Market monitor loop
- [ ] `_market_monitor_loop()`:
  - Every 60 seconds check `alpaca_client.get_clock()`
  - If market just opened → activate eligible bots
  - If market just closed → deactivate all bots, emit `market_status_changed`
  - Emit `market_status_changed` on transitions

#### Acceptance Criteria
- [ ] Engine starts on app startup, stops on shutdown
- [ ] Bots run their trading loops at configured intervals
- [ ] Market hours are respected (bots only trade during configured windows)
- [ ] Multiple bots can run concurrently without interference
- [ ] Bot errors are caught and logged (don't crash the engine)
- [ ] Start/stop/pause from API correctly manages bot lifecycle

---

### Sprint C: Indicators, Signals & Risk Management (Phases 11–13)

**Goal**: Build the trading brain — indicator calculations, signal evaluation, and risk enforcement.

**Estimated effort**: 2–3 days  
**Depends on**: Sprint A (for market data), Sprint B (for integration)

#### Tasks — Phase 11: Indicator Calculator

##### C.1 — Create `app/indicators.py`
- [ ] `IndicatorCalculator` class with:
  - `calculate(bars, config)` → dict of indicator name → current values
  - `_bars_to_dataframe(bars)` → convert Alpaca bars to pandas DataFrame
  - Individual calculators using `pandas-ta`:
    - `_calc_rsi(df, params)` → `{ value, period, oversold, overbought }`
    - `_calc_macd(df, params)` → `{ macd, signal, histogram }`
    - `_calc_sma(df, params)` → `{ value, period }`
    - `_calc_ema(df, params)` → `{ value, period }`
    - `_calc_bbands(df, params)` → `{ upper, middle, lower }`
    - `_calc_stochastic(df, params)` → `{ k, d }`
    - `_calc_obv(df, params)` → `{ value }`
- [ ] Handle insufficient data gracefully (return `None` values)
- [ ] Ensure all results are JSON-serializable for `indicators_snapshot`

#### Tasks — Phase 12: Signal Generator

##### C.2 — Create `app/signal_generator.py`
- [ ] `Signal` enum: `BUY`, `SELL`, `HOLD`
- [ ] `SignalGenerator` class with:
  - `evaluate(indicators, config)` → `Signal | None`
  - Individual evaluators:
    - `_eval_rsi(values, params)` → buy below oversold, sell above overbought
    - `_eval_macd(values)` → buy on bullish crossover, sell on bearish
    - `_eval_ma(values)` → price vs moving average comparison
    - `_eval_bbands(values)` → buy near lower band, sell near upper
    - `_eval_stochastic(values, params)` → buy below 20, sell above 80
  - `_combine_signals(signals)` → majority voting logic
- [ ] Return `None` when no clear signal (prevents unnecessary trades)

#### Tasks — Phase 13: Risk Manager

##### C.3 — Create `app/risk_manager.py`
- [ ] `RiskManager` class with:
  - `validate(signal, bot_config, engine, symbol, current_price)` → `bool`
  - Risk checks:
    - `_check_position_size(signal, config, price)` → max % of capital per position
    - `_check_daily_loss_limit(config, engine)` → stop if daily loss exceeds threshold
    - `_check_max_positions(config, engine)` → concurrent position limit
    - `_check_capital_available(signal, config, price)` → sufficient capital check
  - Calculation helpers:
    - `calculate_position_size(config, current_price)` → number of shares
    - `calculate_stop_loss(entry_price, config)` → stop-loss price
    - `calculate_take_profit(entry_price, config)` → take-profit price
- [ ] All checks must pass (`all(checks)`) for trade to be allowed

#### Acceptance Criteria
- [ ] All 7 indicators calculate correctly from OHLCV data
- [ ] Signal generator produces correct buy/sell signals for known scenarios
- [ ] Majority voting only produces signals when majority of indicators agree
- [ ] Risk manager blocks trades exceeding position size limits
- [ ] Risk manager blocks trades when daily loss limit is exceeded
- [ ] Risk manager blocks trades when max concurrent positions reached
- [ ] Stop-loss and take-profit prices calculated correctly
- [ ] Unit tests pass for all three modules

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

### Sprint E: Testing & Hardening (Phase 15)

**Goal**: Comprehensive testing, structured logging, and production-readiness.

**Estimated effort**: 2–3 days  
**Depends on**: All prior sprints

#### Tasks

##### E.1 — Test infrastructure
- [ ] Create `backend/tests/conftest.py`:
  - Test database (SQLite in-memory or test PostgreSQL)
  - `TestClient` fixture with overridden `get_db`
  - Factory fixtures for creating test bots, trades, positions
- [ ] Configure `pytest-asyncio` for async test support

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
- [ ] `test_indicators.py`:
  - Test each indicator with known datasets
  - Test insufficient data handling
  - Test JSON serializability
- [ ] `test_signal_generator.py`:
  - Test RSI buy/sell/hold
  - Test MACD buy/sell/hold
  - Test Bollinger Bands buy/sell/hold
  - Test majority voting (mixed signals)
  - Test no-signal case
- [ ] `test_risk_manager.py`:
  - Test position sizing calculation
  - Test daily loss limit
  - Test max concurrent positions
  - Test capital availability
  - Test stop-loss / take-profit calculation

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
- [ ] >80% test coverage on business logic (indicators, signals, risk)
- [ ] All API endpoints have at least one happy-path and one error-case test
- [ ] Structured logging replaces all print statements
- [ ] Error responses are consistent and informative
- [ ] All tests pass in CI (`pytest` returns exit 0)

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

| File | Sprint | Description |
|------|--------|-------------|
| `backend/app/alpaca_client.py` | A | Alpaca API wrapper |
| `backend/.env.example` | A | Environment variable template |
| `backend/app/trading_engine.py` | B | Core orchestrator + BotRunner |
| `backend/app/indicators.py` | C | pandas-ta indicator calculations |
| `backend/app/signal_generator.py` | C | Signal generation with majority voting |
| `backend/app/risk_manager.py` | C | Risk management enforcement |
| `backend/Dockerfile` | D | Backend container |
| `frontend/Dockerfile` | D | Frontend container |
| `docker-compose.yml` | D | Full-stack orchestration |
| `scripts/init-db.sh` | D | DB migration script |
| `backend/tests/conftest.py` | E | Test fixtures |
| `backend/tests/test_bots.py` | E | Bot API tests |
| `backend/tests/test_trades.py` | E | Trade API tests |
| `backend/tests/test_positions.py` | E | Position API tests |
| `backend/tests/test_market_data.py` | E | Market data API tests |
| `backend/tests/test_indicators.py` | E | Indicator unit tests |
| `backend/tests/test_signal_generator.py` | E | Signal generator unit tests |
| `backend/tests/test_risk_manager.py` | E | Risk manager unit tests |
| `backend/tests/test_trading_engine.py` | E | Trading engine integration tests |

## Files To Modify

| File | Sprint | Changes |
|------|--------|---------|
| `backend/requirements.txt` | A | Uncomment `alpaca-py`, `pandas-ta`, `pandas`, `numpy` |
| `backend/app/routers/market_data.py` | A | Replace placeholders with real Alpaca calls |
| `backend/app/main.py` | B | Add TradingEngine lifecycle (startup/shutdown) |
| `backend/app/routers/bots.py` | B | Wire start/stop/pause to TradingEngine |
| `backend/app/routers/positions.py` | B | Wire close to Alpaca sell order |
| `backend/app/main.py` | E | Add global exception handler |
| `backend/app/websocket_manager.py` | E | Replace `print()` with `structlog` |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Alpaca API rate limits | Medium | Implement exponential backoff; cache market clock result for 60s |
| pandas-ta version compatibility | Low | Pin to known-good version; test on install |
| Trading engine async complexity | High | Start with single-bot testing; add concurrency incrementally |
| WebSocket disconnections during trades | High | Make trade execution atomic; log state before/after each step |
| Insufficient test coverage | Medium | Write tests alongside each sprint, not deferred to Sprint E only |
| Live trading safety | Critical | Default to paper trading; require explicit env var for live; add confirmation log on startup |

---

## Quick-Start: Sprint A

To begin implementation immediately, run:

```bash
cd backend

# 1. Activate venv
.\venv\Scripts\Activate.ps1

# 2. Uncomment and install trading deps
pip install alpaca-py pandas-ta pandas numpy

# 3. Create alpaca_client.py
#    (see Phase 9 tasks above)

# 4. Test connection
python -c "from app.alpaca_client import AlpacaClient; print('OK')"
```

---

**Last Updated**: February 16, 2026  
**Version**: 1.0  
**Previous Plan References**: `BACKEND_IMPLEMENTATION_PLAN.md`, `SPRINT_0_SUMMARY.md`
