# Implementation Plan — UI First (Architecture Reboot)

> **Sequencing for the living product.** Source of truth: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
>
> This plan replaces the old Sprint 0–12 UI plan (bot factory, indicator forms, “create a bot” MVP). It also supersedes backend phases that treat `bots` CRUD, indicator votes, and `bot_status_changed` as the product. `Feb16_Implementation_plan.md` is a historical status of that retired system.
>
> **UI first:** freeze screens, navigation, and TypeScript contracts against mocks before any trading-runtime or new settings API work. The backend is written to those contracts.

**Last updated:** 2026-09-21  
**Approach:** one book. Each bot is a universe profile with its own risk parameters, start/stop, and statistics. Screens and typed mocks first; control-plane API second; trading runtime last.

## Decision — bots are profiles (after UI-0–UI-3)

UI-0 through UI-3 shipped a single Universe section and removed the Bots tab. That is now incomplete. The product decision is:

- A bot has a name, universe filters, **its own risk parameters**, start/stop, and its own statistics.
- Create/edit does not restore capital, typed symbols, indicator checkboxes, or a trading window.
- Settings keeps the **book** ceiling: hard caps, the −2% flatten-and-lock, kill switch, feed, session, and account mode. A bot’s risk fields cannot be saved looser than those caps.
- Several bots may run. The book risk engine sizes from the bot’s parameters, then shrinks or refuses the order so the sum stays inside the book budget.
- Dashboard shows the book and the running bots. `/bots` is a real route again.

Next UI slice: restore Bots list, create, and edit in that narrower form, and show per-bot stats on the dashboard. Do not wire the old `useBots` factory payload back in. Add profile types (universe filters + `RiskCaps`) to the book contract first.

---

## Why UI first

The chassis already renders a broker dashboard: auth, layout, Settings (broker and prefs), Positions, Trades, Analytics, Socket.IO. The reboot changes what those screens *mean*. Building the runtime first would lock the API to the retired bot model (`useBots`, start/pause/stop, bot filters, bot comparison).

Order of work:

1. **Product UI on mocks** — nav, Settings → Universe, book dashboard, rebound Positions / Trades / Analytics.
2. **Control-plane API** — only the shapes the new UI already calls.
3. **Trading runtime** — session clock, SIP stream, regime, score, risk authority. Out of the UI-first cut except as states the screens already display.

Research console, crypto, extended hours, and shorts stay off. See architecture “First-production defaults.”

---

## What already exists (keep the chassis)

| Keep | Rebind or remove in the UI-first cut |
|---|---|
| React 18, MUI, TanStack Query, React Router, Axios, Socket.IO client | Primary nav item **Bots**; Theme Preview as a product tab |
| `Login`, Google OAuth, `ProtectedRoute`, `Layout`, `TopBar` | `/bots`, `/bots/create`, `/bots/:botId/edit` as product routes |
| Settings page shell, `SettingsSidebar`, Broker / Notifications / Display / Appearance / Data / Activity | Settings living only under the avatar |
| Positions, Trades, Analytics page shells, tables, charts, close-position | Bot column, bot filter, “performance by bot”, `BotComparisonChart` / `BotComparisonTable` as first-class |
| `PnLDisplay`, `Card`, `EmptyState`, `ErrorBoundary`, connection indicator | `StatusBadge` meanings tied to running/paused/stopped bots |
| Dashboard account summary and recent trades table | `ActiveBotsList`, `BotCard`, Create New Bot, `useBots` / start / pause / stop on Dashboard |

`App.tsx` today mounts Bots, Create, and Edit. `Navigation.tsx` lists Dashboard, Bots, Positions, Trades, Analytics, Theme Preview. `SettingsSidebar` starts at Broker. Those three files are the first cutover.

---

## Phase UI-0 — Freeze the frontend contract

**Goal:** TypeScript types and mock fixtures are the API the later backend must match. No new routes, no runtime.

### Types (extend `frontend/src/types`, do not add bot-factory fields)

- **Book summary** — equity, marked daily P&L (realized + unrealized + estimated flatten cost), progress vs the 2% lock, throttle stage (`normal` / `half` / `stop_new` / `locked`), open stop-risk, position count (max 3), regime, data freshness, kill-switch state.
- **Universe** — filters (liquidity rank or top-N dollar volume, price floor, RTH spread band) plus a point-in-time membership snapshot (symbol, price, dollar volume, spread). Not a free-typed symbol list.
- **Session** — RTH enabled (default on), extended hours (default off, separate flag).
- **Feed** — `sip` required; `iex` marked diagnostic only.
- **Risk caps** — the ladder from the architecture (0.25% per trade, 0.75% open risk, −1% / −1.5% / −2% daily). UI may edit only inside hard caps.
- **Account mode** — `paper` | `shadow` | `min_size_live`. One mode at a time.
- **Position row** — existing price/P&L fields plus score, veto code, regime, expected vs realized cost, hold time, ATR stop and target. No `bot_id` as a product column.
- **Trade row** — reason / veto code, implementation shortfall, regime, session. No bot column as a product field.
- **Analytics** — expectancy, turnover, CVaR, cost / gross alpha, splits by regime, session, and asset. No bot-comparison series.
- **WebSocket events** — `trade_executed`, `position_updated`, `price_update`, `market_status_changed`, `risk_event`, `regime_changed`, `data_health`, `universe_updated`. `bot_status_changed` is not a product event.

### Mocks

- One fixture module the new hooks read while `USE_MOCK` (or a book-specific flag) is on.
- Include empty, stale-feed, and daily-lock states so Dashboard and Settings can render them before the API exists.
- Activity log fixture rows may include veto codes (`NO_TRADE_COST`, `NO_TRADE_STALE_DATA`).

**Done when:** new screens can be built against these types with no import from `useBots` and no call to `/api/bots`.

---

## Phase UI-1 — Navigation and route cutover

**Goal:** The app no longer offers a bot factory. Settings is a primary destination.

### `frontend/src/components/layout/Navigation.tsx`

Primary tabs, in order:

`Dashboard · Positions · Trades · Analytics · Settings`

- Remove **Bots**.
- Remove **Theme Preview** from the product tab list. Keep `/theme-preview` as a hidden route (direct URL only).
- Mobile drawer uses the same list.
- Highlight Settings when `location.pathname` starts with `/settings` (query `section` must not break the tab).

### `frontend/src/App.tsx`

- Delete product routes for `Bots`, `CreateBot`, and `EditBot`.
- Replace them with redirects:
  - `/bots` → `/settings?section=universe`
  - `/bots/create` → `/settings?section=universe`
  - `/bots/:botId/edit` → `/settings?section=universe`
- Avatar menu may still link to `/settings`. It is not the only way in.

### Affordances to remove from reachable UI

- Dashboard “Create New Bot”, start / pause / stop.
- Any remaining link to `/bots/create` or edit.

Leave the retired page files in the tree until Phase UI-8 cleanup, but nothing in nav or dashboard may import them.

**Done when:** a user cannot create, edit, start, pause, or stop a bot from the UI, and Settings is in the tab bar on desktop and mobile.

---

## Phase UI-2 — Settings is the control plane

**Goal:** Universe, session, feed, risk, and account mode live in Settings, ahead of personalization. This replaces the Bots factory. Persist to the Phase UI-0 mocks (local state or mock mutation). Do not call bot endpoints.

### `SettingsSidebar` section order

1. **Universe** (new, default when `?section=universe` or when opening Settings from a bot redirect)
2. **Session**
3. **Feed**
4. **Risk**
5. **Account mode**
6. Broker Connection (existing)
7. Notifications, Display, Appearance, Data Management, Activity Log (existing)

Extend `SettingsSection` and `Settings.tsx` so the query param selects the section on load (needed for the redirects).

### New components under `frontend/src/components/settings/`

| Component | Behavior |
|---|---|
| `UniverseFilters` | Top-N / dollar-volume rule, price floor (default ≥ $5), RTH spread band (default ~10–15 bps). Save and reset. No symbol text field, no per-name capital. |
| `UniversePreview` | Table of the current snapshot: symbol, price, dollar volume, spread. Empty and loading states. |
| `SessionSettings` | RTH on by default. Extended hours is a separate switch, default off, with copy that it is not the live path. |
| `FeedSettings` | SIP as the production feed. IEX shown as diagnostic only, not a peer choice for research or live. |
| `RiskCaps` | Read-only hard caps and editable values clamped inside them. Show the 2% flatten-and-lock, −1.5% stop-new, −1% throttle. |
| `BookControls` | Kill switch, Flatten, Lock / Unlock. Flatten and Lock open a confirmation dialog. Buttons call mock mutations and surface success/error toasts. |
| `AccountMode` | Paper / shadow / min-size live as a single selection. Copy states that two modes must not size the same buying power. |
| Fee tier | Version label plus Refresh on Broker or Feed. Never a hardcoded number presented as live. |

Existing Broker test, notifications, display, appearance, export/clear, and activity log stay. Activity log may show veto-code rows from the mock; drop any bot-name filter that depends on `useBots` (`ActivityLogPanel` currently calls it).

**Done when:** Settings → Universe shows filters and a membership preview; session, feed, risk, and mode render with the architecture defaults; destructive book actions confirm; personalization sections still work.

---

## Phase UI-3 — Dashboard is the book

**Goal:** `/` shows book risk, regime, freshness, and kill-switch state. It does not show “how many bots are running.”

### Replace `ActiveBotsList` on `Dashboard.tsx`

Summary cards (reuse `SummaryCards` / `PnLDisplay` / `Card`):

- Book equity
- Marked daily P&L vs the 2% lock (include a staged throttle indicator)
- Open stop-risk
- Open positions (count, cap 3)
- Regime
- Data freshness (age; stale is a visible fail-closed state)
- Kill-switch / lock state, with the same Flatten / Lock actions as Settings (or a link into Risk)

### Recent trades

Keep `RecentTradesTable`. Drop the Bot column. Row click still opens trade detail.

### Data

- New `useBookSummary()` (and reuse account + recent trades hooks).
- `useRealtimeDashboard` stops subscribing to `bot_status_changed`. It may subscribe to `risk_event`, `regime_changed`, and `data_health` once Phase UI-7 lands; until then, mock refetch is enough.

Loading, error, empty book, stale feed, and locked-day states are required, not optional polish.

**Done when:** Dashboard has no bot list, no start/pause/stop, and the lock / stale / empty states render from fixtures.

---

## Phase UI-4 — Positions rebound to the book

**Goal:** Same page, book-scoped. File: `pages/Positions.tsx` and `components/positions/`.

- Remove the bot filter (`PositionFilters`) and bot column. `Positions.tsx` and `PositionDetail` must not call `useBots`.
- Table columns to add: regime, score, veto, hold time, ATR stop, target. Keep symbol, qty, entry, current, P&L.
- Summary bar stays (count, value, P&L) and adds aggregate open stop-risk when the summary payload has it.
- Detail panel: expected vs realized cost, hold time, ATR stop/target lines on `PositionChart`. Close position and its confirmation stay.
- Symbol filter and sort stay.

**Done when:** positions render from the book fixture with no bot identifier on screen, and close-position still confirms.

---

## Phase UI-5 — Trades rebound

**Goal:** History explains why a name did or did not trade. Files: `pages/Trades.tsx`, `components/trades/`.

- Remove bot filter and bot column. `Trades.tsx` and `TradeDetailModal` must not call `useBots`.
- Add reason / veto code, shortfall, regime, session.
- Date range, symbol, side, pagination, URL query params, and CSV export stay.
- Trade analysis: drop “performance by bot.” Keep symbol breakdown. Regime and session splits can be a compact table if the fixture includes them; otherwise leave a labeled empty state until Analytics (Phase UI-6) owns the charts.

**Done when:** the trades table and detail modal show veto, shortfall, regime, and session, and CSV export still downloads the filtered set.

---

## Phase UI-6 — Analytics without bot comparison

**Goal:** `pages/Analytics.tsx` measures expectancy and cost, not runners.

Remove from the page (and from the analytics barrel if nothing else imports them):

- `BotComparisonChart`
- `BotComparisonTable`
- `useBotPerformance` as a page dependency

Add sections, mocked:

- Expectancy
- Turnover
- CVaR
- Cost / gross alpha
- Splits by regime, session, and asset

Keep `PerformanceOverview` and `CumulativePnLChart` where the metrics still apply. Time-range control stays.

**Done when:** Analytics loads from the book analytics fixture and has no bot comparison chart or table.

---

## Phase UI-7 — Realtime product events

**Goal:** Socket.IO stays; payloads become book, risk, regime, and data health.

- `useWebSocket` event union includes `risk_event`, `regime_changed`, `data_health`, `universe_updated`.
- Remove `useRealtimeBotStatus` from product hooks (or stop exporting it). Dashboard, Positions, Trades, and Settings → Universe update the React Query cache from the new events.
- Connection indicator stays (`ConnectionStatusIndicator`).
- A new risk or lock event updates the dashboard throttle/lock card without a full reload.
- `universe_updated` refreshes the membership preview.

**Done when:** with a mock socket (or a tiny dev emitter), a `risk_event` and a `universe_updated` change the visible dashboard and universe preview, and no screen listens for `bot_status_changed`.

---

## Phase UI-8 — Polish on the new surfaces only

Do not polish Create/Edit bot forms.

- Skeletons for dashboard cards, universe preview, positions, and trades.
- Confirmation dialogs for Flatten, Lock, and Close position.
- Tooltips on risk-cap fields (what the hard cap is, what throttle does).
- Toasts for settings save and book actions.
- Keyboard focus and labels on new Settings controls and primary nav, including the mobile drawer.
- Responsive: Settings section select already exists for small screens; Universe preview becomes a card list under `md`. Dashboard cards stack. Positions and trades keep the existing card-vs-table behavior.
- Delete unused product imports: bot pages and bot components once grep shows no route or page imports them. Theme preview route stays.

**Done when:** the five primary tabs and Settings sections are usable at ~320px, ~768px, and desktop, with loading, error, empty, stale, and locked states.

---

## Phase API — Control plane follows the UI

Sequenced in [`POST_UI_IMPLEMENTATION_PLAN.md`](./POST_UI_IMPLEMENTATION_PLAN.md) Cut A. Start only after Phases UI-0 through UI-2 have frozen types (UI-3–UI-6 may proceed on mocks in parallel). Implement to the frontend types, not to `BACKEND_IMPLEMENTATION_PLAN.md`.

| UI already calls | Backend adds or rebinds |
|---|---|
| `GET/PUT` universe filters + snapshot | Settings category `universe`; `universe_snapshots` |
| Session, feed, mode, risk caps | Settings categories `session`, `feed`, `mode`, `risk` |
| Flatten / lock / unlock | Book commands; strategy cannot bypass them |
| `GET /api/summary` | Book equity, marked P&L, throttle, open-risk, regime, freshness, kill state — not bot counts |
| Positions and trades list/detail | Book fields (score, veto, regime, cost, shortfall, hold). Old `bot_id` rows stay archive and are not a product filter |
| `WS /ws` | Add `risk_event`, `regime_changed`, `data_health`, `universe_updated`; stop emitting `bot_status_changed` as a product event |
| Existing broker, notifications, display, export, activity | Keep |

Retired live contract, after the UI no longer calls it: `GET/POST /api/bots`, `GET/PUT/DELETE /api/bots/{id}`, `POST /api/bots/{id}/start|stop|pause`. During cutover those routes return **410** (or are unmounted). They must not remain the way to put risk on.

`bots` table and `Bot` ORM stay archive or a thin cutover alias. They do not own capital, symbols, or indicators.

**Done when:** flipping the UI mock flag off renders Dashboard, Settings → Universe, Positions, and Trades from the API without a `/api/bots` call.

---

## Phase Runtime — after the control UI

Not part of the UI-first cut. Full sequence: [`POST_UI_IMPLEMENTATION_PLAN.md`](./POST_UI_IMPLEMENTATION_PLAN.md) Cut B (Cut C is research, later). Start the wired runtime only after the control-plane API matches the screens:

`SessionClock → MarketData (SIP stream) → Features (closed 5m/15m) → Regime → StrategySelector → Score → CostVeto → RiskEngine → Execution → Protect → Reconcile → Telemetry`

Salvage lifespan restore, `client_order_id`, reconciler, unfilled-sell-stays-open, emergency flatten, activity-log reasons, and the paper-vs-live URL guard.

Do not extend `TradingEngine` / `BotRunner`, majority vote, entry-indicator tracking, or the IEX poll loop as the engine. Quarantine those tests so they cannot become the new contract.

A research console (trials, gates, promotion) is a later UI. It does not restore Bots.

---

## Dependency order

```
UI-0 types + mocks
    ↓
UI-1 nav + redirects          UI-2 Settings (Universe first)
    ↓                              ↓
UI-3 Dashboard    UI-4 Positions    UI-5 Trades    UI-6 Analytics
    ↓
UI-7 WebSocket product events
    ↓
UI-8 polish + delete unused bot UI
    ↓
API control plane matching the frozen types
    ↓
Post-UI plan: control plane, then runtime (see POST_UI_IMPLEMENTATION_PLAN.md)
```

UI-3 through UI-6 can proceed in parallel once UI-0 types exist. UI-2 should land before UI-1 redirects, or the redirect target is an empty section.

---

## Out of scope

- Research console, walk-forward UI, parameter grids
- Crypto, extended-hours trading, equity shorts
- Redis in the UI or as a documented trading dependency
- Reviving indicator checkboxes, per-bot capital, trading windows, or symbol multi-select
- Rewriting `UI_DESIGN.md` in this pass (architecture wins where they disagree)

---

## Done for the UI-first cut

- Primary nav is Dashboard, Positions, Trades, Analytics, Settings.
- `/bots`, create, and edit redirect to Settings → Universe.
- Universe filters and a membership preview work on mocks, with no typed symbol list.
- Dashboard shows book risk, regime, freshness, and kill/lock state, including stale and locked fixtures.
- Positions, Trades, and Analytics do not show a bot column, bot filter, or bot comparison.
- Flatten, Lock, and Close position confirm before acting.
- No product screen imports `useBots` or listens for `bot_status_changed`.
- Frontend types are the contract for the following API phase.
