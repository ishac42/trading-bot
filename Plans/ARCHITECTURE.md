# Trader Bot — Architecture (Reboot)

> **Source of truth for the living product.** This document describes the agreed reboot: one hybrid strategy, one book, and a configured universe. It supersedes the multi-bot / first-hours / indicator-workshop architecture that the rest of `Plans/` and the current UI still describe.
>
> Product bible: research day-trading spec (minutes-to-hours hybrid). Do **not** treat `ENTRY_INDICATOR_TRACKING.md`, `SIGNAL_STRATEGY_UPGRADE.md`, or the sprint/implementation plans as architecture for new work.
>
> Visual companions (`ARCHITECTURE_DIAGRAMS.html`, `SYSTEM_ARCHITECTURE_DIAGRAMS.md`) still draw the retired multi-bot system. Update them to match this file; until then, this document wins.

## Overview

This is a **single-book, regime-aware day-trading system** on a FastAPI / React / PostgreSQL / Alpaca chassis. Live trading is **one hybrid strategy** scanning a **configured universe** of liquid U.S. names. The user does not create N independent bots, type symbols per bot, pick oscillators, or allocate capital per runner.

The old product was an indicator workshop: each bot had its own symbols, indicators, capital, trading window, and start/pause/stop. That model is retired. Configuration that used to live on Bots moves to **Settings**, especially a **Universe** section (filters, not a typed symbol list).

Optimize for **survival → execution correctness → positive net expectancy → risk-adjusted return → consistency → scale**. Daily profit is not a goal.

| Layer | Default | Job |
|---|---|---|
| Execution / risk | 1-minute + live quotes | Spread, slippage, stops, fills |
| Signals | Closed 5-minute bars | Entries, exits, setups |
| Regime | Closed 15-minute bars | Trend vs range vs compression |
| Context | 60-minute (optional) | Major-trend veto only |

Typical hold 15–120 minutes; hard max 4 hours. First production cut: **U.S. equities, regular hours only**, SIP-quality stock data, ~1× gross. Extended hours and crypto stay off until their own cost/session gates pass.

## Product model

### Live system (one book)

- **One hybrid selector**, not a vote of contradictory indicators and not “first BUY indicator wins.”
- **One portfolio risk engine** is the authority. Strategy may request; risk decides size and permission.
- **One universe** of liquid U.S. names, configured by filters (dollar volume, price floor, RTH spread), then scanned on a stream. Users do not type per-bot tickers.
- **One account mode** at a time on the live book: paper / shadow / min-size live. Two live parameter sets must not independently size the same buying power.
- **Kill switch, flatten, and lock** are first-class controls, not optional bot flags.

A named **strategy version** (locked parameter set + hash + promotion state `research → paper → shadow → live`) may exist for research and promotion. It is not a user-built “bot” and is not the risk unit.

### What Settings is for

Settings is the control-plane home for how the single book is allowed to trade:

| Settings section | Role |
|---|---|
| **Universe** (new, replaces Bots factory) | Membership rules: liquid U.S. names (target top 50–100 by recent dollar volume), price ≥ ~$5, RTH spread ~10–15 bps, point-in-time snapshot preview. Not a free-typed symbol list per runner. |
| Broker | Per-user Alpaca credentials, paper vs live URL guard, connection test |
| Feed | SIP required for research and for any production path that uses VWAP, volume, or spread. IEX is a degraded diagnostic feed only. |
| Session | RTH on by default; extended hours a separate flag, off |
| Risk | Research-default ladder, editable only inside hard caps; kill / flatten / lock |
| Account mode | Paper / shadow / min-size live |
| Fees | Versioned fee-tier refresh (never hardcoded) |
| Existing prefs | Notifications, display, appearance, data export/clear, activity log — keep |

### What happens to Bots (create / edit / list)

| Current surface (as shipped) | Reboot fate |
|---|---|
| Primary nav **Bots** (`/bots`) | **Removed.** List of runners with search, status tabs, and start/pause/stop is not the product. |
| **Create bot** (`/bots/create`) | **Removed.** No form for name, capital, symbols, indicator checkboxes, percent SL/TP, or trading window. |
| **Edit bot** (`/bots/:botId/edit`) | **Removed.** Same factory form does not come back as “edit strategy.” |
| Dashboard **Active bots** cards / start-pause-stop | **Removed.** Dashboard shows book risk, regime, kill-switch state, open-risk, data freshness — not “how many bots are running.” |
| `GET/POST /api/bots`, start/pause/stop | **Retired as the live contract.** During cutover, routes may 410 or redirect; they must not remain the way to put risk on. |
| `bots` table / `Bot` ORM | **Not the risk unit.** Historical rows and voter fills are **archive** only. Do not train or validate the new system on old fills. A thin row may linger as a UI alias for a strategy version so old URLs do not 500 during cutover; it must not own capital, symbols, or indicators. |

Cutover UX: `/bots`, `/bots/create`, and `/bots/:id/edit` redirect to **Settings → Universe** (and Settings is reachable from primary nav, not only the avatar menu).

### Navigation

**Current (retired product):** `Dashboard · Bots · Positions · Trades · Analytics` (+ Theme Preview). Settings lives only under the user avatar.

**Target primary nav:** `Dashboard · Positions · Trades · Analytics · Settings`

- **Settings** moves into the primary tab bar because universe, session, feed, and risk caps are core product, not account chrome.
- Avatar menu may still deep-link to Settings.
- Theme Preview stays a hidden/dev route, not a product tab.
- No Bots tab. No “create bot” affordance.

## Technology stack

Chassis stays. The trading brain, risk contract, market-data path, and Bots UX do not.

### Backend

- **Framework**: FastAPI (Python 3.11+), Pydantic, structlog, request IDs, OpenAPI
- **Database**: PostgreSQL — ACID book, orders, fills, features, regimes, vetoes, research trials
- **ORM**: SQLAlchemy + Alembic
- **Broker**: Alpaca Trade API — paper/live URL guard, per-user credentials, REST for snapshots/commands/recovery, **streams for market data**
- **Features**: small complementary stack (EMA, VWAP, RSI, ATR, ADX, volume/OBV, spread / order-flow proxy). pandas-ta math may be reused; **signal mapping must be rewritten**. SMA is slow context only.
- **Auth**: Google OAuth + JWT (already shipped; not a future item)
- **Redis**: present in Compose only. **Not in the trading path** until a real pub/sub need appears. Do not document it as architecture.

### Frontend

- **React 18 + TypeScript**, MUI, TanStack Query, React Router
- **Charts**: TradingView Lightweight Charts / Recharts (positions and analytics)
- **Realtime**: existing Socket.IO client against `/ws` — keep broadcast; events become book/risk/regime/data-health, not `bot_status_changed`

### Infrastructure

- Docker Compose: API (Uvicorn), UI (Vite build / Nginx), PostgreSQL
- Alpaca is the first venue adapter. Crypto adapter stays dark until fee/liquidity gates pass.
- Cloud/process notes (health checks, env-specific config, GitHub Actions) are unchanged in spirit.

## System architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Control UI (React)                                          │
│  Dashboard · Positions · Trades · Analytics · Settings      │
│  Settings: Universe · Broker · Feed · Session · Risk · Mode │
└────────────────────────────┬────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────────┐
│ API / Control plane (FastAPI)                               │
│  auth · settings/universe · flatten/lock · reports          │
└────────────────────────────┬────────────────────────────────┘
                             │ commands / queries
┌────────────────────────────▼────────────────────────────────┐
│ Trading runtime (event state machine)                       │
│  SessionClock → MarketData (stream) → Features              │
│       → Regime → StrategySelector → Score → CostVeto        │
│       → RiskEngine (authority) → Execution → Protect        │
│       → Reconcile → Telemetry                               │
└───────┬──────────────────┬──────────────────┬───────────────┘
        │                  │                  │
   PostgreSQL         Venue adapters      Research job
   book, orders,      Alpaca equities     walk-forward,
   features,          Alpaca crypto*      holdout, stress,
   trials             (+ later venues)    paper replay
```

`*` Crypto adapter stays dark until fee/liquidity gates pass.

**Layer rules**

1. **Venue adapter** — capability matrix, fee tier, session, rate limits, orders, streams. Strategy does not import this except through ports.
2. **Session clock** — equity sessions vs crypto continuous; DST-correct `America/New_York`; rolling 24h risk window. Default live path is RTH only. Do not use `UTC-5` “ignoring DST.”
3. **Market data** — **stream first**, REST snapshot/repair; **SIP for stocks**; venue-native for crypto; stale/gap freezes the asset. IEX is not research or production truth.
4. **Features** — closed 5m/15m/(60m) derived from 1m; session VWAP (RTH reset; premarket isolated).
5. **Regime + strategies + score** — pure functions. **Signal generation never places an order.**
6. **Cost model** — all-in round trip; 3× veto; versioned fees.
7. **Risk engine** — last word on size and permission; kill switch lives here.
8. **Execution** — idempotent orders, protect emulation, implementation shortfall.
9. **Research** — same decision functions as live; different clock.

## Core components

### 1. Trading runtime (replaces `TradingEngine` / `BotRunner`)

An event-processing state machine, not a per-bot poll loop that REST-fetches 50 × 1-minute IEX bars and votes indicators.

`BOOT → SYNC → WARMUP → READY → VALIDATE_SIGNAL → RISK_CHECK → ENTERING → OPEN → EXITING → COOLDOWN`, plus `HALTED`.

**Responsibilities**

- Honor the session clock (equities: `PREMARKET → RTH → POSTMARKET → OVERNIGHT`; live default RTH).
- Stream the configured universe; repair with REST; enforce quote-age / gap gates.
- Build features only from **closed** 5m (signals) and 15m (regime) bars.
- Classify regime; select at most one engine (trend/momentum, breakout, mean-reversion). Transition (18 < ADX < 23, or mixed) is usually no trade.
- Score candidates; apply hard vetoes; hand a *request* to risk.
- Execute only after risk and cost approve; reconcile fills; protect open risk; emit telemetry.

**Salvage from current code:** lifespan start/restore, `client_order_id` + reconciler, “unfilled sell stays open,” emergency flatten endpoints, activity-log reason strings, paper-vs-live URL guard.

**Throw away:** majority vote, entry-indicator tracking (first BUY opens; only that indicator’s SELL closes), `evaluate_single` primary-indicator mode, IEX-as-truth, poll-50-bars loop as the engine.

### 2. Hybrid strategy (replaces `signal_generator` vote contract)

| Engine | When it may trade | Role |
|---|---|---|
| Trend / momentum (pullback or continuation) | ADX ≥ 23 and a real trend | Primary |
| Volatility breakout | Compression then expansion | Second |
| Mean reversion to VWAP | ADX ≤ 18, low-trend only | Conditional |
| Transition | 18 < ADX < 23, or mixed | Usually no trade |

Core features: **EMA + VWAP + RSI + ATR + ADX + volume/OBV + spread / order-flow proxy**. MACD and Bollinger Bands live inside the trend/momentum or compression blocks with a **capped** weight — not independent full-weight votes.

RSI is not “below 30 means buy.” Momentum longs live around RSI 55–72; mean-reversion longs around 25–35 **after** price starts reclaiming the extreme.

Transparent score (not a win probability until calibrated):

`score = 25R + 20T + 15M + 15S + 10V + 10O + 5E`  
(regime, trend/location, momentum, setup, volume, order-flow, execution quality)

Trade only at **≥ 70/100**. 60–69 is watch-only. Hard vetoes always beat score: daily lock, stale data, wide spread, cost too high, halt, unknown account state, possible duplicate, correlation/risk cap.

Default parameters are the spec’s first hypothesis. Nobody grid-searches them until the research harness exists.

### 3. Risk engine (replaces percent-of-bot-capital checklist)

Risk sits **above** strategy. Starting book for a **$5,000** design default, 1× gross:

| Control | Default |
|---|---|
| Hard combined daily loss | 2.00% — cancel entries, flatten, lock |
| Soft throttle | −1.00% — half new-trade risk |
| Stop new risk | −1.50% |
| Risk per trade | 0.25% |
| Max aggregate open stop-risk | 0.75% |
| Normal max positions | 3 |
| Single-name notional | 25% stocks / 20% crypto |
| Min confidence | 70/100 |
| Min gross target | ≥ 1.5R and ≥ 3× expected round-trip cost |

Daily P&L is **realized + unrealized + estimated liquidation cost**, session-correct (not UTC-midnight realized-only per bot). Size from **stop distance + emergency-exit cost**, then cap notional, portfolio, and correlation. ATR stops (~1.2 ATR stocks), not a fixed 2% of price. Correlation: names above ~0.75 share a cluster budget.

SELL/flatten paths stay allowed when reducing risk; strategy code cannot bypass halt / flatten / lock.

### 4. Execution adapter (replaces market-order + software poll)

Keep Alpaca as the first venue. Replace “submit market and poll 30 × 1s”:

- Quote + spread + depth/proxy; all-in cost estimate
- Normal entries: passive / marketable-limit first; one reprice; never chase past max slippage
- Breakouts: aggressive limit allowed
- Hard stop / kill switch: **certainty of exit** over maker fees
- Idempotent `client_order_id`s; no cancel/repost loops
- Implementation-shortfall on every order
- Broker state is authoritative on rejects and buying power
- Software `protect_position()` emulates missing brackets (needed later for crypto)

Capability is a **matrix**, not assumptions: long/short, market/limit/stop, bracket/OCO, sessions. Equity shorts need live shortable/borrow checks and stay off for the first live book. Alpaca crypto is not shortable and not marginable.

### 5. Universe + market data

Universe is **Settings configuration**, then a streaming scan:

- Point-in-time membership (no “today’s top 100 survivors” in research)
- Filters: liquid U.S. names, price floor, RTH spread band
- Stream quotes/trades/bars for members; REST only for snapshot, command, and repair
- Token bucket, backoff, jitter, reconnect, gap detection, periodic reconcile
- Stale quotes or NaN/impossible features freeze that symbol; they do not silently vote

### 6. Control-plane API

Product endpoints (target). Paths stay under `/api` as today.

**Settings / universe (primary config)**

- Existing: `GET /api/settings`, broker / notifications / display updates, broker test, export, data-stats, activity
- Add: universe get/update (filters + current membership snapshot), session flags, feed (SIP/IEX diagnostic), fee-tier refresh, account mode, risk-cap get/update (hard-capped), flatten / lock / unlock

**Book ops (rebind; drop bot filters as the product)**

- `GET /api/positions`, `GET /api/positions/{id}`, `POST /api/positions/{id}/close`
- `GET /api/trades`, `GET /api/trades/{id}`, `GET /api/trades/stats`
- `GET /api/account`, `GET /api/market-status`, `GET /api/summary` (book risk / regime / freshness, not bot counts)
- `WS /ws` — `trade_executed`, `position_updated`, `price_update`, `market_status_changed`, plus `risk_event`, `regime_changed`, `data_health`, `universe_updated`. Drop `bot_status_changed` as a product event.

**Auth (shipped)**

- Google OAuth + JWT; per-user broker credentials and settings

**Retired live contract**

- `GET/POST /api/bots`, `GET/PUT/DELETE /api/bots/{id}`, `POST /api/bots/{id}/start|stop|pause`

### 7. Database schema (target)

Greenfield strategy/orders/research is cleaner than migrating `bots.indicators`. Keep **users**, **app_settings**, and historical trades/positions as **archive**.

| Area | Intent |
|---|---|
| `users`, `app_settings` | Keep. Add settings categories: `universe`, `session`, `risk`, `feed`, `mode` (alongside `broker`, notifications, display). |
| `strategy_versions` | Locked parameter set + hash + promotion state |
| `universe_snapshots` | Point-in-time membership from filters |
| `market_bars` / quotes (or external research store) | 1m and derived 5m/15m/60m |
| `feature_snapshots` | Values used for a decision |
| `signals` | Candidate, regime, score components, veto code |
| `orders` / `fills` | Client id, intended vs broker, fees, slippage, shortfall |
| `positions` | Side, stop, target, trail, max hold, cluster, sleeve — **book-scoped**, not `bot_id` |
| `trades` | Rebind off `bot_id` as the product FK; keep old rows as archive |
| `risk_events` | Throttle, lock, flatten, mismatch |
| `research_trials` | Every parameter attempt, including failures |
| `activity_logs` | Keep; extend with veto-code telemetry |
| `bots` | Archive / optional cutover alias only |

Do not keep `indicators` JSON as the product.

## Frontend surfaces

| Surface | Job after reboot |
|---|---|
| **Dashboard** (`/`) | Book equity, marked daily P&L vs 2% lock, staged throttle, open-risk, position count, regime, data freshness, kill-switch. Not “active bots.” |
| **Positions** (`/positions`) | Same page, rebound to the book: score, veto, regime, expected vs realized cost, hold time, ATR stop/target |
| **Trades** (`/trades`) | Same page + reason/veto codes, shortfall, regime/session |
| **Analytics** (`/analytics`) | Add expectancy, turnover, CVaR, cost/gross-alpha, regime/session/asset splits. Drop “bot comparison” as a first-class chart. |
| **Settings** (`/settings`) | **Universe + broker + feed + session + risk + mode** plus existing prefs. This is where the Bots factory’s job goes. |
| **Bots / Create / Edit** | Deleted as product routes; redirect to Settings → Universe |
| **Research console** (later) | Trials, gates, promotion checklist, veto telemetry — not a second live book |

Settings sidebar today: Broker, Notifications, Display, Appearance, Data, Activity. **Universe** (and Session / Risk / Feed / Mode as needed) insert ahead of personalization. Broker stays; add SIP vs IEX, fee-tier refresh, paper/live mode, session flags there or as sibling sections — not on a bot form.

## Trading logic flow

```
1. Session clock: RTH? Else no new equity risk (extended is a separate, off strategy)
   ↓
2. Stream universe members (SIP). Freeze stale / halted / gapped names
   ↓
3. On closed 15m: classify regime (trend / range / compression / transition)
   ↓
4. On closed 5m: evaluate only the engine the regime allows
   ↓
5. Score ≥ 70? Else watch / no-trade
   ↓
6. Hard vetoes (cost, spread, data, halt, duplicate, lock, correlation…)
   ↓
7. Risk engine: size from stop + exit cost; apply book caps; or reject
   ↓
8. Execution policy (limit-first; certainty exits for protect / kill)
   ↓
9. Reconcile fills; protect; time stop / max hold / trail
   ↓
10. Telemetry + WebSocket (book, not bot)
```

Signal code stops at step 5–6. It never submits an order.

## Risk management features

1. **Dollar stop-risk sizing** including emergency-exit cost (not `capital × max_position_size% / price`)
2. **ATR / structure stops** and 1.5–2.0R targets; trail ~1.5 ATR
3. **Staged daily + rolling-24h** marked P&L (includes estimated flatten cost)
4. **Flatten-and-lock** at −2%; no new risk at −1.5%; throttle at −1.0%
5. **Aggregate open-risk, 1× gross, max 3 names**, single-name notional cap
6. **Correlation clusters** (combined cluster risk ≤ 0.35% of equity at the spec default)
7. **Time stop ~60 minutes** if the trade has not progressed; hard max hold 4 hours
8. **No averaging down**
9. **Capability checks** (shortable, borrow, venue) before any short or crypto path
10. **Kill switch** uses existing emergency-close instinct; strategy cannot bypass it

Retired as the risk system: fixed % SL/TP, capital-% sizing, realized-only UTC daily loss, independent per-bot books that may trade the same symbol.

## Security

1. **API keys**: environment and per-user encrypted settings; never in code
2. **Authentication**: Google OAuth + JWT (live)
3. **Paper-vs-live URL guard**: keep and tighten
4. **Rate limiting**, Pydantic validation, structured error logs
5. **Idempotent client order IDs**; broker is source of truth on rejects
6. Promotion to live is gated (research harness), not “one good backtest”

Account UI must not center deprecated PDT / `daytrade_count` fields. Use current buying-power / intraday-margin fields.

## Scalability and ops

- Stateless control-plane API; one production runtime, **one book**, one risk engine
- A second experiment runs in paper against a **shadow book**, never sharing live buying power
- SQLAlchemy pool; async FastAPI
- Event-driven market data; REST for repair only
- Structured JSON logs; veto reason codes (`NO_TRADE_COST`, `NO_TRADE_STALE_DATA`, …)
- Health: `/api/health`

## Development workflow

1. **Local**: Docker Compose (API, UI, Postgres). Redis optional and unused.
2. **Tests**: rewrite contracts around closed-bar features, regime, score, vetoes, and risk authority. Quarantine voter / entry-indicator tests so they cannot become the new contract.
3. **Deploy**: Docker; env-specific config; paper before any live size.

## Environment variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/trading_bot

# Alpaca (defaults; per-user settings override trading credentials)
ALPACA_API_KEY=your_api_key
ALPACA_SECRET_KEY=your_secret_key
ALPACA_BASE_URL=https://paper-api.alpaca.markets

# Data
# Production/research equity feed is SIP. IEX is diagnostic only.

# Auth
GOOGLE_CLIENT_ID=...
JWT secrets per existing app config

# Application
ENVIRONMENT=development
LOG_LEVEL=INFO
```

`REDIS_URL` may remain in Compose for local leftovers; it is not required by the runtime.

## Research and promotion (architecture, not a sprint plan)

Deployment is gated:

historical sim → walk-forward OOS → locked holdout → paper → shadow live → min-size live → scale

Acceptance: **robust positive out-of-sample expectancy after real costs, under stressed execution, inside the 2% daily-loss architecture.** Old voter fills are a different strategy and are not evidence.

A research console (trials, gates, promotion checklist) is a later UI. It does not restore the Bots factory.

## Component communication

| Component | Communicates with | Protocol | Purpose |
|---|---|---|---|
| React UI | FastAPI | HTTP REST | Settings/universe, book queries, flatten/lock |
| React UI | FastAPI | WebSocket (Socket.IO) | Book, risk, regime, data-health, fills |
| FastAPI | PostgreSQL | SQLAlchemy | Persistence |
| Runtime | Alpaca | REST | Orders, account, repair snapshots |
| Runtime | Alpaca | Stream (SIP stocks) | Universe scan, quotes, bars |
| Features / regime / score | Runtime | In-process, no I/O | Candidates only |
| Risk engine | Runtime | In-process | Permission, size, kill |
| Research job | Same decision functions | Batch clock | Walk-forward / holdout |

### Key data flows

**Universe configuration (replaces bot create):**

```
User → Settings → Universe filters → PUT /api/settings/universe →
Postgres snapshot → runtime resubscribes stream → WS universe_updated
```

**Decision / trade:**

```
SIP stream → closed 5m/15m features → regime → hybrid engine → score →
vetoes → risk authority → execution → Alpaca → reconcile → DB → WS
```

**Dashboard:**

```
GET /api/summary + GET /api/account + WS risk/regime/data-health
```

There is no “create bot → start bot → per-symbol poll” flow.

## Technology stack layers

- **Presentation**: React 18, MUI, charts as today; pages rebound as above
- **State**: TanStack Query, React Router, Socket.IO client, Axios
- **API**: FastAPI routers — Settings (incl. universe), Auth, Account, Positions, Trades, Market/Summary — **not** Bots CRUD as product
- **Business**: session clock, features, regime, hybrid selector, score, cost veto, **risk authority**, execution, reconcile
- **Data**: PostgreSQL + Alembic; optional external research store for 1m history
- **External**: Alpaca REST + SIP stream

## File structure (target)

```
trading-bot/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── models.py              # users, settings, book, research — not bots-as-product
│   │   ├── alpaca_client.py       # venue adapter: SIP, streams, capability, fees
│   │   ├── session_clock.py
│   │   ├── market_data/           # stream + repair
│   │   ├── features/              # closed-bar EMA/VWAP/RSI/ATR/ADX/…
│   │   ├── strategy/              # regime, engines, score (no I/O)
│   │   ├── risk/                  # authority, kill, clusters
│   │   ├── execution/
│   │   ├── reconciler.py          # keep / extend
│   │   ├── trading_runtime.py     # state machine (replaces BotRunner)
│   │   └── routers/
│   │       ├── settings.py        # + universe, session, risk, mode
│   │       ├── auth.py
│   │       ├── account.py
│   │       ├── trades.py
│   │       ├── positions.py
│   │       └── market_data.py
│   └── alembic/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx      # book, not bots
│       │   ├── Settings.tsx       # Universe section replaces Bots factory
│       │   ├── Positions.tsx
│       │   ├── Trades.tsx
│       │   └── Analytics.tsx
│       └── components/
│           ├── layout/            # nav without Bots; Settings in primary tabs
│           └── settings/          # UniverseFilters, membership preview
├── docker-compose.yml
├── Plans/
│   └── ARCHITECTURE.md            # this file — living architecture
└── README.md
```

Retired product files (do not extend as the live path): `pages/Bots.tsx`, `CreateBot.tsx`, `EditBot.tsx`, `components/bots/`, `components/dashboard/ActiveBotsList.tsx` / `BotCard.tsx`, `routers/bots.py`, `signal_generator.py` vote/entry-indicator contract.

## Performance targets

- Control-plane CRUD: &lt; 100ms typical
- Stream-to-feature freshness: fail closed on stale data rather than trade a late poll
- Kill / flatten: certainty of exit over latency cosmetics
- **One** live book; no “10+ concurrent bots” target

## Monitoring and logging

- Structured JSON logs; request IDs
- Veto codes and risk events on the dashboard and activity log
- Metrics: data age, spread, shortfall, lock state, open-risk
- Alerts: stale feed, flatten, daily lock, reconcile mismatch

## Implementation notes

### Current repo vs this document

Code as of the last mainline (early March 2026) still implements the **retired** product: `BotRunner` poll, IEX 1m bars, indicator vote / entry-indicator tracking, percent risk, Bots nav and factory forms. Auth, settings (broker/prefs), positions/trades pages, reconciler, `client_order_id`, and emergency close are chassis to keep.

This file is the architecture to implement against. Implementation sequencing is [`UI_IMPLEMENTATION_PLAN.md`](./UI_IMPLEMENTATION_PLAN.md) (UI first), then [`POST_UI_IMPLEMENTATION_PLAN.md`](./POST_UI_IMPLEMENTATION_PLAN.md) (control-plane API, then runtime, then research). Do not revive sprint plans that assume N bots.

### WebSocket

Keep the existing Socket.IO `/ws` mount. Change payloads to the book.

### Data

JSON settings categories are fine for universe filters and risk caps. Do not store a live “indicators” blob as the strategy.

### Caching

No Redis requirement. Do not draw Redis on new diagrams until it is actually subscribed.

### First-production defaults (from the spec; not for tuning yet)

- $5,000, 1× gross, 3 positions, 0.25% / 0.75% / 2% risk ladder
- Equities only, RTH, SIP, top 50–100 liquid names via Settings → Universe
- EMA 9/21/50, RSI 14, ADX 14/23, ATR 14, BB 20,2, MACD 12/26/9 inside the trend block
- Score ≥ 70, cost multiple 3×, max hold 4h
- Crypto off; extended hours off; shorts off

---

The chassis is a competent broker dashboard. The reboot makes it a **cost-aware, regime-switching, risk-authoritative minutes-to-hours system** that refuses to trade most of the time — configured from Settings, not from a bot factory.
