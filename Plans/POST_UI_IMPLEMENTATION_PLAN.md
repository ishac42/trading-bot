# Implementation Plan — After the UI

> **Starts when the UI contract is frozen.** Prerequisite: [`UI_IMPLEMENTATION_PLAN.md`](./UI_IMPLEMENTATION_PLAN.md) Phase UI-0 (types and mocks). Phases UI-1 through UI-8 may still be in progress. Do not start from [`BACKEND_IMPLEMENTATION_PLAN.md`](./BACKEND_IMPLEMENTATION_PLAN.md) or [`Feb16_Implementation_plan.md`](./Feb16_Implementation_plan.md).
>
> Architecture: [`ARCHITECTURE.md`](./ARCHITECTURE.md). The frontend types are the response shapes. This plan does not invent a second product model.

**Last updated:** 2026-09-21

Two cuts, in order:

1. **Control plane** — settings, universe snapshot, book summary, positions/trades fields, flatten/lock, WebSocket events. The UI can drop its mocks. Nothing here places a strategy order.
2. **Runtime** — one event state machine for one book. Signal code never submits an order. Risk is the authority.

Research (walk-forward, holdout, promotion console) is a later cut. It uses the same decision functions. It does not come back as Bots.

---

## Chassis to keep

| Existing | Use |
|---|---|
| `app/auth.py`, `routers/auth.py` | Google OAuth + JWT. Already shipped. |
| `app/models.py` `User`, `AppSettings` | Per-user JSON settings. Add categories; do not replace the table. |
| `routers/settings.py` | Broker, notifications, display, export, data-stats, broker test. Extend; do not rewrite. |
| `routers/positions.py`, `routers/trades.py` | List, get, close, stats. Add book fields. Drop bot filters from the product query. |
| `routers/account.py` | Buying power and equity. Do not center PDT / `daytrade_count`. |
| `alpaca_client.py` | REST account, orders, positions, clock. Extend for SIP stream, capability, fee tier. |
| `reconciler.py` | Broker vs DB. Extend for the book; do not key it on `bot_id`. |
| `activity_logger.py`, `routers/activity_logs.py` | Keep. Add veto-code reasons. |
| `websocket_manager.py` | Keep Socket.IO `/ws`. Add book events. Stop emitting `bot_status_changed` as a product event. |
| `client_order_id` generation, unfilled-sell-stays-open, emergency flatten, paper-vs-live URL guard | Salvage into execution and risk. |

## Do not extend

`trading_engine.py` (`BotRunner` poll), `signal_generator.py` vote / `evaluate_single` / entry-indicator contract, `risk_manager.py` percent-of-bot-capital checks, `routers/bots.py` as a way to put risk on, IEX-as-truth bar polls.

Quarantine `tests/test_signal_generator.py` and any bot-runner tests so a green suite cannot redefine the new contract. New tests live beside the new modules.

---

## Cut A — Control plane

The UI already calls these shapes. Implement them before the runtime. Nullable strategy fields (score, regime, veto, shortfall) are fine until Cut B fills them.

### A1 — Settings categories

`AppSettings` already stores JSON by `category` (`models.py`). Add categories next to `broker`, notifications, and display. No new table for the filter documents themselves.

| Category | Document | Defaults (hard-capped) |
|---|---|---|
| `universe` | `top_n` (50–100), `min_price` (≥ 5), `max_spread_bps` (10–15 band) | Filters only. No symbol array the user types. |
| `session` | `rth_enabled: true`, `extended_hours: false` | Extended hours off. |
| `feed` | `primary: "sip"`, `iex_diagnostic: false` | SIP is the only production value. IEX cannot be saved as primary. |
| `risk` | Ladder below | Writes rejected when they exceed hard caps. |
| `mode` | `paper` \| `shadow` \| `min_size_live` | One value. Changing mode does not start a second book. |

Risk ladder stored in `risk`, with server-side caps the UI cannot raise:

| Field | Default | Hard cap |
|---|---|---|
| Risk per trade | 0.25% | ≤ 0.25% |
| Max aggregate open stop-risk | 0.75% | ≤ 0.75% |
| Soft throttle | −1.00% | not looser than −1% |
| Stop new risk | −1.50% | not looser than −1.5% |
| Hard daily lock | −2.00% | not looser than −2% |
| Max positions | 3 | ≤ 3 |
| Single-name notional | 25% stocks | ≤ 25% |
| Min score | 70 | ≥ 70 |
| Min target | ≥ 1.5R and ≥ 3× expected round-trip cost | cannot be lowered |

Endpoints on `routers/settings.py`:

- `GET /api/settings` includes the new categories (empty category → defaults, not null).
- `PUT /api/settings/universe`
- `PUT /api/settings/session`
- `PUT /api/settings/feed`
- `PUT /api/settings/risk`
- `PUT /api/settings/mode`
- `POST /api/settings/fees/refresh` — store a versioned fee-tier snapshot from the broker. Never a hardcoded commission in code as the live number.

Pydantic models in `schemas.py`. Invalid combinations return 422 (IEX as primary, extended hours used as the equity session, risk above the cap, two modes).

**Done when:** a settings round-trip from the UI mock client persists universe, session, feed, risk, and mode, and a too-loose risk write is rejected.

### A2 — Universe snapshot

Filters are settings. Membership is a snapshot, because research must not use “today’s survivors.”

New table `universe_snapshots`:

- `id`, `user_id`, `as_of` (timestamptz), `filters` (JSON copy), `members` (JSON list: symbol, price, dollar volume, spread bps)
- Index `(user_id, as_of desc)`

`GET /api/settings/universe` returns filters plus the latest snapshot (possibly empty).

`PUT /api/settings/universe` saves filters and asks the data layer for a new snapshot. Until Cut B’s stream exists, snapshot build may be a REST screen of liquid names (dollar volume, price floor, spread) and must still be stored point-in-time. Label that builder `build_universe_snapshot` so the stream path replaces the source, not the table.

On write, emit `universe_updated`.

**Done when:** changing filters creates a new row, the previous row remains, and the UI preview reads the latest row.

### A3 — Book commands

Risk state is server-side, not a bot flag.

New table `risk_events`: `id`, `user_id`, `kind` (`throttle` \| `stop_new` \| `lock` \| `flatten` \| `unlock` \| `mismatch`), `reason_code`, `payload` JSON, `created_at`.

Endpoints:

- `POST /api/book/flatten` — cancel entry orders, close positions, write `flatten`. Confirmation is the UI’s job; the API still requires an explicit body `{ "confirm": true }`.
- `POST /api/book/lock` — set lock, refuse new risk, write `lock`.
- `POST /api/book/unlock` — clear lock only. Does not reopen flattened positions. Refused while marked daily loss is still at or past −2%.

Wire flatten to the existing emergency-close path in the Alpaca client. Strategy code is not on this path.

Emit `risk_event` after each command.

**Done when:** flatten and lock work against paper positions (or a recorded broker fake in tests) with no `BotRunner` involved, and unlock is rejected while the daily lock condition still holds.

### A4 — Summary, positions, trades

`GET /api/summary` in `routers/market_data.py` currently counts bots. Replace that payload with the book summary the dashboard types expect:

- equity
- marked daily P&L (realized + unrealized + estimated liquidation cost)
- throttle stage (`normal` \| `half` \| `stop_new` \| `locked`)
- open stop-risk
- position count
- regime (nullable until the runtime publishes one)
- data freshness (quote age; `stale: true` when unknown)
- kill-switch / lock state

Remove `active_bots` from the product schema. Old clients are not a compatibility target.

Positions (`routers/positions.py`) and trades (`routers/trades.py`):

- Responses grow score, veto code, regime, expected vs realized cost, hold time, ATR stop, target (positions) and reason, shortfall, regime, session (trades).
- Columns may be nullable until Cut B writes them.
- List filters: symbol, side, date. No `bot_id` query parameter.
- `POST /api/positions/{id}/close` stays.
- Historical rows that still have `bot_id` remain readable as archive. The API does not group or filter by bot.

`GET /api/account` and `GET /api/market-status` stay.

**Done when:** summary, positions, and trades match the UI types with the mock flag off, and no response field is a bot count or bot name.

### A5 — WebSocket

In `websocket_manager.py`:

- Add `emit_risk_event`, `emit_regime_changed`, `emit_data_health`, `emit_universe_updated`.
- Keep `trade_executed`, `position_updated`, `price_update`, `market_status_changed`.
- `emit_bot_status_changed` is not called on the live path. Delete it once grep is clean.

**Done when:** the UI’s Phase UI-7 handlers receive these events from the API process.

### A6 — Retire the bot live contract

After the UI no longer calls `/api/bots`:

- `GET/POST /api/bots`, `GET/PUT/DELETE /api/bots/{id}`, `POST /api/bots/{id}/start|stop|pause` return **410** with a body that points at Settings → Universe. Do not leave them mounted as working CRUD.
- `main.py` lifespan stops constructing `TradingEngine` / loading bots. Health payload drops `active_bots`.
- `Bot` ORM and the `bots` table stay for archive. No migration that deletes historical rows in this cut. New code must not read `bots.indicators`, `bots.capital`, or `bots.symbols` to size or scan.

**Done when:** the process boots with no bot runner, bot routes are 410, and positions/trades/settings still serve the signed-in user.

### A7 — Control-plane tests

- Settings validation (caps, SIP-only, single mode).
- Universe snapshot append-only behavior.
- Flatten/lock/unlock, including unlock refused at −2%.
- Summary shape has no bot counts.
- Bot routes return 410.

**Cut A is done when** the UI runs against the API for Dashboard, Settings → Universe, Positions, and Trades, and no strategy order can be placed by saving settings.

---

## Cut B — Runtime

One book. One risk engine. Equities, regular hours, SIP, ~1× gross. Crypto, extended hours, and shorts stay off (capability checks return “not enabled,” not a silent stock path).

State machine (`app/trading_runtime.py`), replacing `BotRunner`:

`BOOT → SYNC → WARMUP → READY → VALIDATE_SIGNAL → RISK_CHECK → ENTERING → OPEN → EXITING → COOLDOWN`, plus `HALTED`.

`HALTED` is the kill/lock state. Exit and flatten are allowed from `HALTED`. New entries are not.

### B1 — Session clock

New `app/session_clock.py`. Pure functions, America/New_York, DST-correct. Do not use a fixed `UTC-5` offset.

- Sessions: `PREMARKET → RTH → POSTMARKET → OVERNIGHT`.
- Live default: new equity risk only in RTH. Extended hours is a separate flag and stays off.
- Rolling 24h window helper for the risk engine (marked P&L is not “UTC midnight, realized only”).

**Done when:** tests cover a DST spring-forward and fall-back date, and RTH boundaries match the exchange clock.

### B2 — Closed-bar features

New `app/features/`. No I/O. Input is closed bars only.

- Build 5m (signals), 15m (regime), and optional 60m (major-trend veto) from 1m bars.
- Session VWAP resets at RTH. Premarket VWAP is a separate series and is not the RTH VWAP.
- Indicators: EMA 9/21/50, RSI 14, ATR 14, ADX 14, volume/OBV, spread / order-flow proxy. Bollinger 20,2 and MACD 12/26/9 exist only as inputs to the trend/momentum block, not as full-weight voters.
- SMA is slow context only.
- NaN or impossible values return a freeze for that symbol, not a neutral vote.

Reuse pandas math from `indicators.py` where it already matches these definitions. Do not reuse its signal mapping.

**Done when:** a fixture of 1m bars produces stable 5m/15m values, an incomplete current bar is excluded, and a NaN ATR freezes the symbol.

### B3 — Regime, engines, score, cost veto

New `app/strategy/`. Pure functions. No broker import.

| Engine | May trade when | Otherwise |
|---|---|---|
| Trend / momentum | ADX ≥ 23 and a real trend | Primary |
| Volatility breakout | Compression then expansion | Second |
| Mean reversion to VWAP | ADX ≤ 18 | Conditional |
| Transition | 18 < ADX < 23, or mixed | No trade |

- At most one engine per symbol per bar.
- RSI is not “below 30 means buy.” Momentum longs around 55–72. Mean-reversion longs around 25–35 only after price starts reclaiming the extreme.
- Score: `25R + 20T + 15M + 15S + 10V + 10O + 5E`. Trade only at ≥ 70. 60–69 is watch-only.
- Hard vetoes beat score: daily lock, stale data, wide spread, cost ≥ 3× gross target, halt, unknown account, possible duplicate, correlation/risk cap. Reason codes (`NO_TRADE_COST`, `NO_TRADE_STALE_DATA`, …) are part of the return value.
- These functions return a candidate or a veto. They do not call `submit_order`.

Default parameters are the architecture’s first hypothesis. No grid search in this cut.

**Done when:** unit tests cover each engine’s allow/deny, the score threshold, and every hard veto. A test fails if any strategy module imports the Alpaca client.

### B4 — Risk authority

New `app/risk/`. Replaces `risk_manager.py` for the live path. Given account equity, open positions, and a candidate, it returns size and permission or a rejection.

- Size from stop distance (default ~1.2 ATR on stocks) plus estimated emergency-exit cost. Then cap by single-name notional (25%), aggregate open stop-risk (0.75%), and gross exposure (~1×).
- Marked daily P&L = realized + unrealized + estimated flatten cost, on the session clock.
- −1.0% soft throttle halves new-trade risk. −1.5% stops new risk. −2.0% cancels entries, flattens, and locks (writes `risk_events`, emits `risk_event`).
- Max 3 positions. No averaging down.
- Names with correlation above ~0.75 share a cluster budget (combined cluster risk ≤ 0.35% of equity).
- SELL and flatten stay allowed when they reduce risk. Nothing in `app/strategy/` can clear `HALTED`.

Leave `risk_manager.py` in the tree until Cut B tests replace it, then stop importing it from the runtime.

**Done when:** tests show a −2% book flattens and locks, a −1% book halves size, a fourth position is refused, and a strategy veto cannot override a lock.

### B5 — Market data and universe stream

New `app/market_data/`.

- Subscribe to SIP quotes, trades, and bars for the latest `universe_snapshots` members.
- REST only for the snapshot build, commands, and gap repair.
- Token bucket, backoff, jitter, reconnect, gap detection, periodic reconcile against the broker clock.
- Stale quote or gap → freeze that symbol and emit `data_health`. Do not fall back to IEX to “keep trading.”
- On settings change, resubscribe and emit `universe_updated` only after the new snapshot is stored (A2).

`alpaca_client.py` grows the stream and a capability matrix (long/short, market/limit/stop, bracket/OCO, sessions, fee tier). Equity short and crypto capabilities stay false.

**Done when:** a forced stale quote freezes one symbol and leaves the others eligible, and a feed drop emits `data_health` without submitting an order.

### B6 — Execution and protection

New `app/execution/`. Alpaca remains the venue.

- Idempotent `client_order_id` (salvage the current generator; drop `bot_id` from the id, use book + symbol + intent).
- Normal entries: passive or marketable limit, one reprice, never chase past max slippage.
- Breakouts: aggressive limit allowed.
- Hard stop and kill switch: certainty of exit over maker fees.
- Record intended price vs fill, fees, slippage, implementation shortfall on every order.
- Broker is authoritative on rejects and buying power.
- `protect_position()` emulates a missing bracket (software stop). Unfilled protective sells leave the position open (salvage current behavior).
- No cancel/repost loops.

New tables (Alembic), book-scoped, not `bot_id`:

- `orders`, `fills` — client id, intended vs broker, fees, slippage, shortfall
- `signals` — candidate, regime, score components, veto code
- `feature_snapshots` — values used for that decision
- `strategy_versions` — locked parameter set, hash, promotion state `research → paper → shadow → live`. One live version. This is not a user-built bot.

`positions` and `trades` gain the nullable columns A4 already returns: side, stop, target, trail, max hold, cluster, score, veto, regime, costs. Stop deleting or ignoring old rows; new writes do not set `bot_id`.

**Done when:** a paper entry uses a limit, stores shortfall, and a rejected order does not leave a phantom position. A second submit with the same client id does not double-fill.

### B7 — Wire the state machine

`trading_runtime.py` owns the loop:

1. Session clock says RTH, or no new equity risk.
2. Stream members; freeze stale, halted, or gapped names.
3. On closed 15m, classify regime and emit `regime_changed` when it changes.
4. On closed 5m, run only the allowed engine.
5. Score ≥ 70 or watch / no-trade. Persist `signals` either way when a name was evaluated.
6. Hard vetoes.
7. Risk sizes or rejects.
8. Execution policy.
9. Reconcile (`reconciler.py`), protect, time stop (~60 minutes if the trade has not progressed), hard max hold 4 hours, trail ~1.5 ATR.
10. Telemetry: activity log reason codes, `trade_executed`, `position_updated`, `risk_event`, `data_health`.

Lifespan in `main.py` starts this runtime in `BOOT` only when mode is `paper` or the operator has explicitly enabled shadow/min-size. Default for a fresh settings row is paper, and the runtime still does not enter unless session and feed gates pass (RTH, SIP, snapshot non-empty).

`SYNC` restores open positions and working orders from the broker, then the DB.

**Done when:** a scripted 5m fixture walks `READY → VALIDATE_SIGNAL → RISK_CHECK → ENTERING → OPEN` on paper, a veto stops at `VALIDATE_SIGNAL`, and a lock forces `HALTED` without a strategy import on the flatten path.

### B8 — Runtime tests and quarantine

New tests:

- Session clock DST
- Closed-bar features and freeze-on-NaN
- Regime selection and score
- Each hard veto code
- Risk ladder and cluster cap
- Idempotent client order id
- Stale-data freeze

Move `test_signal_generator.py` (vote, `evaluate_single`, entry-indicator) to a `tests/quarantine/` package excluded from the default suite, or delete it once nothing imports that contract. Do not “fix” those tests to pass against the new score.

**Cut B is done when** paper mode can scan a snapshot, refuse most bars, take a risk-approved paper entry, protect it, and flatten on the −2% lock — and the default test suite does not import `BotRunner`.

---

## Cut C — Research (not required to finish A or B)

Same functions as B2–B4. A different clock (historical bars, no live stream).

- `research_trials` stores every parameter attempt, including failures.
- Gates: historical sim → walk-forward OOS → locked holdout → paper → shadow → min-size live → scale.
- Acceptance is robust positive out-of-sample expectancy after costs, under stressed execution, inside the 2% daily-loss architecture.
- Old voter fills are not a training or validation set.
- A research console UI is separate and does not restore `/bots`.

Do not start Cut C by exposing parameter grids in Settings.

---

## Order

```
UI-0 types frozen
    ↓
A1 settings categories → A2 universe snapshots → A3 flatten/lock
    ↓
A4 summary + positions + trades → A5 WebSocket → A6 retire bots → A7 tests
    ↓
B1 session clock → B2 features → B3 strategy/score/veto → B4 risk
    ↓
B5 stream → B6 execution → B7 state machine → B8 tests
    ↓
C research (later)
```

B1–B4 have no broker I/O and can be written in parallel with late Cut A, as long as they are not wired into `main.py` until A6 has removed the bot runner. B5–B7 wait until A2 snapshots and A5 events exist.

---

## Out of scope

- Crypto adapter, extended-hours strategy, equity shorts
- Redis on the trading path
- Grid search or a research console
- Migrating `bots.indicators` into `strategy_versions`
- Training or validating on historical bot fills
- A second live book sharing buying power

---

## Done for the post-UI plan

- Settings → Universe, session, feed, risk, and mode persist, with hard caps enforced on the server.
- Dashboard summary, positions, and trades match the UI types with mocks off.
- Flatten, lock, and unlock are book commands and emit `risk_event`.
- `/api/bots` returns 410. The process does not start `BotRunner`.
- Paper runtime trades only after session, fresh SIP data, score ≥ 70, cost veto, and risk approval.
- A −2% marked day flattens and locks. Strategy code cannot bypass it.
