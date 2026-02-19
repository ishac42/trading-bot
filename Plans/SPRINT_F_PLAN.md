# Sprint F: Alpaca Integration, Sync & Emergency Controls

## Overview
**Goal**: Tighten the integration between our app and Alpaca — link every order to its bot via `client_order_id`, display real account info, enforce capital and symbol constraints, add reconciliation to catch sync issues, and add an emergency SELL button.  
**Estimated effort**: 3–4 days  
**Depends on**: Sprint C (Indicators, Signals & Risk Management ✅)

---

## Requirements Summary

| # | Requirement | Impact |
|---|------------|--------|
| 1 | Display Alpaca account info (cash, buying power) in the app | New endpoint + UI component |
| 2 | Validate bot capital against available buying power | Backend validation on create/update/start |
| 3 | Link all orders to bots via `client_order_id` + add reconciliation | Order submission changes + new sync endpoint |
| 5 | Emergency SELL button with auto-pause | New UI button + backend endpoint |

---

## Core Design: `client_order_id` as the Bridge

Every order we submit to Alpaca will include a `client_order_id` that encodes which bot placed it:

```
Format:  bot-{bot_id_first_8_chars}-{short_uuid}
Example: bot-a1b2c3d4-f9e8d7c6
```

This gives us:
- **Our DB** = primary data store for trades (fast queries, bot attribution, analytics)
- **Alpaca** = source of truth for order execution (actual fills, prices, statuses)
- **`client_order_id`** = the key that links the two, enabling reconciliation

We keep creating Trade records in our DB as we do today, but now every Trade has a `client_order_id` that matches the Alpaca order. If anything gets out of sync, we can compare the two sides and fix discrepancies.

---

## Known Problems & Design Decisions

### P1: Alpaca orders have no `bot_id`
**Problem**: Alpaca doesn't know about our bots.  
**Decision**: Encode `bot_id` in `client_order_id` on every order submission. Our DB Trade records continue to have `bot_id` as a foreign key for fast queries. The `client_order_id` is stored on both sides (our Trade.client_order_id + Alpaca order.client_order_id) as the reconciliation key.

### P2: Sync can drift
**Problem**: Network errors, partial fills, or crashes could cause our DB to disagree with Alpaca.  
**Decision**: Add a reconciliation endpoint that fetches recent Alpaca orders, compares them against our Trade records (matching on `order_id` or `client_order_id`), and reports discrepancies. Users can trigger this manually, and we can optionally run it periodically.

Possible discrepancies:
- **Missing in DB**: Alpaca has a filled order we don't have a Trade for (e.g., crash after order submission but before DB write)
- **Missing in Alpaca**: We have a Trade record but Alpaca has no matching order (shouldn't happen, but could if DB write succeeded on a rejected order)
- **Status mismatch**: Our Trade says "filled" but Alpaca says "cancelled" (or vice versa)
- **Price mismatch**: Our recorded fill price differs from Alpaca's actual fill price

### P3: Historical orders won't have `client_order_id`
**Problem**: Orders already placed before this change don't have the encoded `client_order_id`.  
**Decision**: Accept this. Existing Trade records already have `bot_id` in our DB, so they're fine for our purposes. They just won't be reconcilable against Alpaca orders by `client_order_id`. This is a one-time transition issue.

### P4: Buying power is dynamic
**Problem**: Alpaca buying power changes in real-time as positions open/close.  
**Decision**: Validate at both bot creation AND bot start. If buying power dropped between creation and start, the start will be rejected with a clear error message.

### P5: "Allocated capital" definition
**Problem**: How do we calculate what's already "spoken for"?  
**Decision**: `allocated_capital = sum(capital) for ALL bots` (including stopped bots). Conservative — stopped bots still reserve their capital. To free up capital, reduce a bot's capital or delete the bot.

### P6: Multiple bots trading the same symbol
**Problem**: Can two bots trade the same symbol without interference?  
**Decision**: Yes. Each bot's orders are linked via `client_order_id` (Alpaca side) and `bot_id` (DB side), so there's no confusion about which bot owns which position or trade. Capital overlap is prevented by the buying power validation in Phase 2. No symbol uniqueness constraint needed.

---

## Phase 1: Alpaca Account Info Endpoint & UI

Display the Alpaca account info, capital breakdown, and realized gains on the Dashboard.

### Backend
- [ ] **New endpoint `GET /api/account`** in a new router `routers/account.py`
  - Calls `alpaca_client.get_account()`
  - Queries DB for allocated capital and total realized gains
  - Returns:
    - `account_number` — Alpaca account number
    - `equity` — total account value (cash + positions)
    - `cash` — settled cash
    - `buying_power` — available buying power from Alpaca
    - `portfolio_value` — current portfolio value
    - `allocated_capital` — sum of all bots' capital from DB
    - `available_capital` — `buying_power - allocated_capital`
    - `total_realized_gains` — sum of `Position.realized_pnl` for all closed positions
  - Falls back gracefully if Alpaca client unavailable
- [ ] **Update `alpaca_client.get_account()`** to also return `account_number`
- [ ] **Helper function** `get_allocated_capital(db, exclude_bot_id=None)` — reusable by Phase 2
- [ ] **Register the router** in `main.py`

- [ ] **Add `realized_gains` to bot responses** in `routers/bots.py`
  - For `GET /api/bots` (list): subquery that sums `Position.realized_pnl` where `bot_id` matches and `is_open = False`, grouped by bot
  - For `GET /api/bots/{id}` (detail): same sum for the single bot
  - Add `realized_gains` field to `BotResponseSchema`
  - Frontend bot cards/detail already render what the schema returns — just needs the new field displayed

- [ ] **Show unmanaged Alpaca positions** in the positions table
  - New endpoint (or extend existing `GET /api/positions`) to detect unmanaged positions:
    1. Fetch all positions from Alpaca (`alpaca_client.get_positions()` → symbol + qty)
    2. Fetch all open positions from our DB, summing quantity per symbol across all bots
    3. Compare: if Alpaca qty for a symbol exceeds our DB total, the difference is "unmanaged"
    4. If Alpaca has a symbol we don't track at all, the entire position is "unmanaged"
  - Return unmanaged positions with a flag (e.g., `managed: false`, `bot_id: null`)
  - Frontend displays them in the same PositionsTable but with a clear **"Unmanaged"** badge/label
  - Unmanaged rows show: symbol, quantity, current price, unrealized P&L (all from Alpaca), no bot name, no entry indicator

> **Note**: Alpaca's Trading API does not return the account holder's name. Only the `account_number` is available. A user display name could be added later via app settings if desired.

### Frontend
- [ ] **New API method** `api.getAccount()` in `services/api.ts`
- [ ] **New hook** `useAccount()` in `hooks/useAccount.ts`
- [ ] **New component** `AccountSummary` displayed on the Dashboard page
  - Header: Alpaca account number (e.g., "Account #PA12345678")
  - Cards: Total Account Value (equity), Cash, Buying Power, Total Realized Gains
  - Capital breakdown: Allocated Capital vs Available Capital
  - Color-code available capital (green if healthy, yellow if low, red if overallocated)
  - Color-code total realized gains (green if positive, red if negative)
- [ ] **Show available capital in the Bot creation form** so user knows the limit before entering a value

### Files touched
```
backend/app/routers/account.py        (NEW)
backend/app/routers/bots.py           (add realized_gains to bot responses)
backend/app/schemas.py                (add realized_gains to BotResponseSchema)
backend/app/alpaca_client.py          (add account_number to get_account)
backend/app/main.py                   (register router)
frontend/src/types/index.ts           (add realized_gains to Bot type)
frontend/src/services/api.ts          (add getAccount)
frontend/src/hooks/useAccount.ts      (NEW)
frontend/src/components/dashboard/AccountSummary.tsx  (NEW)
frontend/src/pages/Dashboard.tsx      (add AccountSummary)
frontend/src/components/bots/form/BotForm.tsx  (show available capital hint)
frontend/src/components/positions/PositionsTable.tsx  (unmanaged position rows + badge)
backend/app/routers/positions.py      (unmanaged position detection logic)
```

---

## Phase 2: Bot Capital Validation

Enforce constraints so bots can't over-allocate capital beyond the account's buying power.

### Backend — Capital Validation
- [ ] **On bot CREATE** (`POST /api/bots`): Fetch Alpaca buying power, compute `available = buying_power - sum(all bots' capital)`. Reject if `new_bot_capital > available`.
- [ ] **On bot UPDATE** (`PUT /api/bots/{id}`): Same check, but exclude the current bot's capital from the sum: `available = buying_power - sum(other bots' capital)`.
- [ ] **On bot START** (`POST /api/bots/{id}/start`): Re-validate capital against current buying power. Reject with clear error if buying power has decreased.

### Frontend
- [ ] **Bot form validation**: Before submit, call the account endpoint to check available capital. Show inline error if capital exceeds available.

### Files touched
```
backend/app/routers/bots.py           (add validation to create/update/start)
backend/app/routers/account.py        (helper functions used by bots router)
frontend/src/components/bots/form/BotForm.tsx  (capital validation UX)
```

---

## Phase 3: `client_order_id` Linking + Reconciliation

Link every order to its bot via `client_order_id` on both our DB and Alpaca. Add a reconciliation mechanism to detect and report sync issues.

### Step 3A: Add `client_order_id` and `reason` to the Trade model
- [ ] **Add `client_order_id` column** to the Trade model in `models.py` (nullable String, indexed)
- [ ] **Add `reason` column** to the Trade model in `models.py` (nullable String)
  - Human-readable explanation of why the trade was made
  - Examples: `"RSI buy signal"`, `"MACD sell signal"`, `"Stop-loss triggered (price ≤ $155.00)"`, `"Take-profit triggered (price ≥ $170.00)"`, `"Manual close"`
- [ ] **Create Alembic migration** to add both `client_order_id` and `reason` to the `trades` table
- [ ] **Update Trade schemas** to include `client_order_id` and `reason` in responses

### Step 3B: Add `client_order_id` to order submissions
- [ ] **Update `alpaca_client.submit_market_order()`** to accept and pass `client_order_id` parameter
- [ ] **Update `alpaca_client.submit_limit_order()`** to accept and pass `client_order_id` parameter
- [ ] **Helper function** `generate_client_order_id(bot_id)` → returns `bot-{bot_id[:8]}-{uuid4()[:8]}`
- [ ] **Update `trading_engine._execute_buy()`**:
  - Generate `client_order_id` and pass to `submit_market_order()`
  - Store `client_order_id` on the Trade record
  - Set `reason` = `"{indicator} buy signal"` (e.g., `"RSI buy signal"`)
- [ ] **Update `trading_engine._execute_sell()`**:
  - Generate `client_order_id` and pass to `submit_market_order()`
  - Store `client_order_id` on the Trade record
  - Set `reason` based on context:
    - Indicator sell: `"{indicator} sell signal"` (e.g., `"MACD sell signal"`)
    - Legacy majority vote: `"Majority vote sell signal"`
- [ ] **Update `trading_engine._check_stop_loss_take_profit()`**:
  - Pass reason through to `_execute_sell()`:
    - Stop-loss: `"Stop-loss triggered (price ≤ ${sl_price})"`
    - Take-profit: `"Take-profit triggered (price ≥ ${tp_price})"`
- [ ] **Update `routers/positions.py` `close_position()`**:
  - Generate `client_order_id` and pass to `submit_market_order()`
  - Store `client_order_id` on the Trade record
  - Set `reason` = `"Manual close"`

### Step 3C: Reconciliation endpoint
- [ ] **New endpoint `GET /api/account/reconcile`** in `routers/account.py`
  - Fetches recent orders from Alpaca (e.g., last 100 closed orders, configurable)
  - Fetches corresponding Trade records from our DB (matching on `order_id` or `client_order_id`)
  - Compares and reports discrepancies:
    - `missing_in_db`: Orders in Alpaca with no matching Trade in our DB
    - `missing_in_alpaca`: Trades in our DB with no matching order in Alpaca
    - `status_mismatch`: Trade.status differs from Alpaca order status
    - `price_mismatch`: Trade.price differs from Alpaca filled_avg_price
  - Returns: `{ synced_count, discrepancies[], last_checked }`
  - Read-only — reports issues but doesn't auto-fix (user decides what to do)

### Step 3D: Verify order status after submission (harden existing flow)
- [ ] **Improve `_execute_buy()`**: After the 1-second wait, if order status is not "filled", retry the status check (up to 3 attempts with 1s delay). Log a warning if still not filled.
- [ ] **Improve `_execute_sell()`**: Same retry logic.
- [ ] **Update Trade status** in DB based on actual Alpaca order status (not assumed "filled").

### Frontend
- [ ] **Display `reason` in trade table and detail modal** — new column in `TradeTable.tsx`, shown in `TradeDetailModal.tsx`
- [ ] **Add reconciliation UI** — a button on the Dashboard or a section in Settings
  - "Check Sync" button triggers `GET /api/account/reconcile`
  - Shows results: "X orders synced, Y discrepancies found"
  - List discrepancies with details (order_id, type, what's different)
  - For now, display-only (no auto-fix buttons)

### Files touched
```
backend/app/models.py                  (add client_order_id to Trade)
backend/app/schemas.py                 (add client_order_id to Trade schemas)
backend/app/alpaca_client.py           (client_order_id param on submit methods)
backend/app/trading_engine.py          (generate + store client_order_id, retry logic)
backend/app/routers/positions.py       (client_order_id on close)
backend/app/routers/account.py         (reconciliation endpoint)
alembic/versions/xxx_add_client_order_id.py  (NEW migration)
frontend/src/services/api.ts           (add reconcile method)
frontend/src/components/dashboard/AccountSummary.tsx  (or new ReconcileButton)
```

---

## Phase 4: Emergency SELL Button with Auto-Pause

Add a "SELL" button next to each position in the positions table that immediately closes the position at market price and pauses the owning bot.

### Backend
- [ ] **Update `POST /api/positions/{id}/close`** to accept optional `pause_bot` query param (default `true`)
  - After closing position: if `pause_bot=true`, pause the owning bot (set DB status to `paused`, call `trading_engine.pause_bot()`)
  - Emit `bot_status_changed` WebSocket event so the UI updates in real-time
  - Include `client_order_id` on the sell order (already done in Phase 3)

### Frontend
- [ ] **Add SELL button to `PositionsTable.tsx`**
  - Red button on each position row (desktop) and each card (mobile)
  - Visible inline — no need to open the detail modal
- [ ] **Confirmation dialog** before executing
  - Text: "Sell all X shares of {SYMBOL} at market price? Bot '{Bot Name}' will be paused."
  - Confirm button: "Sell & Pause Bot"
  - Cancel button: "Cancel"
- [ ] **Call `closePosition(id)`** on confirm (with `pause_bot=true`)
- [ ] **Toast notification** on success: "Position closed. Bot '{Bot Name}' has been paused."
- [ ] **Real-time UI update** via WebSocket — position disappears from table, bot status changes to "paused"

### Files touched
```
backend/app/routers/positions.py       (pause_bot logic after close)
frontend/src/components/positions/PositionsTable.tsx  (SELL button + confirmation)
frontend/src/services/api.ts           (update closePosition to pass pause_bot param)
```

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4
```

- **Phase 1** is foundational — gives us account info that Phase 2 validates against.
- **Phase 2** adds the safety constraints (capital + symbols) that should be in place before any more trading.
- **Phase 3** adds `client_order_id` linking and reconciliation, hardening the connection between our DB and Alpaca.
- **Phase 4** is a self-contained feature that builds on Phase 3's `client_order_id` support.

---

## Acceptance Criteria

- [ ] Dashboard shows account number, total account value (equity), cash, buying power, allocated/available capital, and total realized gains
- [ ] Positions table shows unmanaged Alpaca positions with a clear "Unmanaged" label
- [ ] Cannot create a bot with capital exceeding available buying power
- [ ] Multiple bots can trade the same symbol without interference (each tracked via `client_order_id`)
- [ ] Cannot start a bot if buying power has dropped below its capital allocation
- [ ] Every order submitted to Alpaca includes a `client_order_id` linking it to the bot
- [ ] Trade records in our DB store `client_order_id` matching the Alpaca order
- [ ] Reconciliation endpoint detects discrepancies between DB and Alpaca
- [ ] Reconciliation UI shows sync status and any issues
- [ ] Order status is verified after submission (retry logic, correct status in DB)
- [ ] Emergency SELL button closes position at market and pauses the bot
- [ ] Confirmation dialog shown before emergency sell
- [ ] Bot status updates in real-time after emergency sell

---

**Last Updated**: February 19, 2026  
**Status**: Planning — approved, ready to implement  
**Previous**: `SPRINT_C_PLAN.md`
