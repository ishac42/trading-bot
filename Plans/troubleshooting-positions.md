---
description: Troubleshooting guide for position sync issues between the database and Alpaca. Use when investigating unmanaged positions, missing trades, or data discrepancies.
alwaysApply: false
---

# Position Sync Troubleshooting Guide

## Quick-Start Workflow

When a user reports a position sync issue (e.g., "unmanaged position", "missing trade", "wrong quantity"):

1. Connect to the **deployed** database (see connection details below) — do NOT use the local DB unless confirmed
2. Get Alpaca API keys from `app_settings` table (NOT from `.env`)
3. Compare DB positions vs Alpaca positions for the affected symbol
4. Check the trade history (DB trades vs Alpaca orders) to find where they diverged
5. Look for trades with status `"new"` or `"partially_filled"` — these indicate failed fill confirmations

## Quick Reference

- **Backend**: FastAPI + SQLAlchemy async (PostgreSQL)
- **Broker**: Alpaca (paper trading at `https://paper-api.alpaca.markets`)
- **Position tracking**: DB positions are compared against Alpaca positions to detect drift
- **Key files**:
  - `backend/app/trading_engine.py` — `_execute_buy`, `_execute_sell`, `_wait_for_fill`
  - `backend/app/routers/positions.py` — unmanaged position detection logic
  - `backend/app/routers/account.py` — `/api/account/reconcile` endpoint
  - `backend/app/alpaca_client.py` — Alpaca API wrapper
  - `backend/app/models.py` — `Position` and `Trade` ORM models

## Connecting to the Databases

### Deployed Database (Production — Render)

The deployed database is hosted on **Render** (PostgreSQL). The local `.env` file points to `localhost` which is the LOCAL dev database — NOT production. Always confirm you are querying the correct one.

```
DATABASE_URL: postgresql://fishac:eDfeEnuHB8qDfY9o7ZoCBvZ59fynvRxY@dpg-d6c9kp4r85hc73bkr6kg-a.oregon-postgres.render.com/tradebot_1wac
```

**Connect via psql:**

```powershell
$env:PGPASSWORD = "eDfeEnuHB8qDfY9o7ZoCBvZ59fynvRxY"; & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h dpg-d6c9kp4r85hc73bkr6kg-a.oregon-postgres.render.com -U fishac -d tradebot_1wac -c "<SQL>"
```

### Local Database (Development)

```
DATABASE_URL: postgresql://trading_bot_user:trading_bot_pass@localhost:5432/trading_bot
```

```powershell
$env:PGPASSWORD = "trading_bot_pass"; & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U trading_bot_user -d trading_bot -c "<SQL>"
```

### Important Notes

- `psql` is at `C:\Program Files\PostgreSQL\18\bin\psql.exe`
- Docker is NOT installed on this machine. The local PostgreSQL runs natively.
- The local and deployed databases have **different data, users, and bots**. Always verify which environment the user's issue relates to before querying.

## Finding Alpaca API Credentials

Alpaca credentials are stored **per-user** in the `app_settings` table, NOT in `.env` (the `.env` keys may be stale/rotated and will return "unauthorized").

**Query the deployed DB to get credentials:**

```sql
SELECT u.email, u.name, s.user_id, s.settings
FROM app_settings s
JOIN users u ON s.user_id = u.id
WHERE s.category = 'broker';
```

The `settings` JSON column contains `alpaca_api_key`, `alpaca_secret_key`, and `base_url`.

### Known Users (as of Feb 2026)

| Email | User ID | Has Alpaca Keys |
|-------|---------|-----------------|
| ishac7@gmail.com | 010c0dfb-9dc9-4528-bc9e-0482b9a25be3 | Yes |
| mack.farid@gmail.com | 1b15821e-0773-46df-a73b-d336f66d3ec8 | No (uses shared default) |
| fouad@radishapps.com | 74b9a7a5-9eb8-471e-8668-4847d5c82e07 | No |
| aaron@radishapps.com | 51a7668a-0eb6-4891-afdc-672005377e6b | No |
| gabrielmzachary@gmail.com | 73c68b72-bc64-4ac6-9721-bb5b6c8d2e3d | No |

Multiple users can have bots that share the SAME Alpaca brokerage account (via the default client loaded at startup). Check `bots.user_id` to see which user owns a bot, then find the Alpaca client for that user.

### Querying Alpaca via PowerShell

Do NOT use `curl` — PowerShell aliases it to `Invoke-WebRequest` which has incompatible syntax. Use `Invoke-RestMethod` instead:

```powershell
# First get the keys from the DB query above, then:
$headers = @{
    "APCA-API-KEY-ID" = "<api_key>";
    "APCA-API-SECRET-KEY" = "<secret_key>"
}

# All positions
Invoke-RestMethod -Uri "https://paper-api.alpaca.markets/v2/positions" -Headers $headers | ConvertTo-Json

# Single symbol position
Invoke-RestMethod -Uri "https://paper-api.alpaca.markets/v2/positions/TSLA" -Headers $headers | ConvertTo-Json

# Order history for a symbol
Invoke-RestMethod -Uri "https://paper-api.alpaca.markets/v2/orders?status=all&symbols=TSLA&limit=100&direction=desc" -Headers $headers | Select-Object id, side, qty, filled_qty, filled_avg_price, status, created_at, client_order_id | Format-Table -AutoSize

# Account info
Invoke-RestMethod -Uri "https://paper-api.alpaca.markets/v2/account" -Headers $headers | ConvertTo-Json
```

## Diagnosing Unmanaged Positions

An "unmanaged" position means Alpaca holds more shares of a symbol than the DB tracks. The detection logic is in `backend/app/routers/positions.py` (`get_unmanaged_positions`):

1. Fetches all positions from Alpaca
2. Sums all open DB positions per symbol (filtered by user's bots)
3. If `alpaca_qty > db_qty`, the difference is "unmanaged"

### Step-by-step diagnosis

**1. Check what Alpaca actually holds:**

```sql
-- Or query the API directly (see Alpaca section above)
```

**2. Check what the DB thinks is open:**

```sql
SELECT symbol, SUM(quantity) as db_qty
FROM positions
WHERE is_open = true
GROUP BY symbol
ORDER BY symbol;
```

**3. Compare per-bot:**

```sql
SELECT b.name, b.id as bot_id, p.symbol, p.quantity, p.entry_price,
       p.is_open, p.opened_at, p.entry_indicator
FROM positions p
JOIN bots b ON p.bot_id = b.id
WHERE p.symbol = '<SYMBOL>' AND p.is_open = true
ORDER BY p.opened_at DESC;
```

**4. Check trade history for buy/sell imbalance:**

```sql
SELECT type, COUNT(*) as count, SUM(quantity) as total_shares
FROM trades
WHERE symbol = '<SYMBOL>'
GROUP BY type;
```

Net shares = total buys - total sells. This should match Alpaca's position.

**5. Check for ghost trades (in DB but not in Alpaca, or vice versa):**

```sql
-- Trades with non-terminal status (may indicate failed fill confirmation)
SELECT id, type, quantity, price, status, order_id, timestamp
FROM trades
WHERE symbol = '<SYMBOL>' AND status NOT IN ('filled', 'canceled', 'cancelled', 'rejected', 'expired')
ORDER BY timestamp DESC;
```

**6. Check Alpaca order history:**

```powershell
Invoke-RestMethod -Uri "https://paper-api.alpaca.markets/v2/orders?status=all&symbols=<SYMBOL>&limit=100&direction=desc" -Headers $headers |
    Select-Object id, side, qty, filled_qty, filled_avg_price, status, created_at, client_order_id |
    Format-Table -AutoSize
```

**7. Count Alpaca buys vs sells to find the true net:**

```powershell
$orders = Invoke-RestMethod -Uri "https://paper-api.alpaca.markets/v2/orders?status=all&symbols=<SYMBOL>&limit=500" -Headers $headers
$buys = ($orders | Where-Object { $_.side -eq 'buy' -and $_.status -eq 'filled' })
$sells = ($orders | Where-Object { $_.side -eq 'sell' -and $_.status -eq 'filled' })
Write-Host "Buys: $($buys.Count) orders, $(($buys | Measure-Object -Property filled_qty -Sum).Sum) shares"
Write-Host "Sells: $($sells.Count) orders, $(($sells | Measure-Object -Property filled_qty -Sum).Sum) shares"
```

## Common Root Causes

### 1. Runaway buy loop (FIXED Feb 2026)

**Symptom**: Dozens of buy orders in Alpaca over a few minutes, but only 1-2 recorded in DB.

**Cause**: `_execute_buy` used to submit an order to Alpaca, wait for fill confirmation, and only then record in the DB. If `_wait_for_fill` timed out, the order still filled on Alpaca but was never recorded. The next cycle saw "no open position" and bought again.

**Fix applied**: `_execute_buy` now records the Trade and Position in the DB immediately after order submission (with status="new"), then updates with fill data. This prevents re-buys because `_get_open_position` finds the pending position.

### 2. Bot deletion with open positions

**Symptom**: Shares exist in Alpaca but no corresponding DB records at all.

**Cause**: The `positions` table has `ON DELETE CASCADE` on `bot_id`. Deleting a bot removes all its positions and trades from the DB, but does NOT sell the shares on Alpaca.

### 3. Multiple bots trading the same symbol

**Symptom**: Position quantities don't add up; confusing trade history.

**Root cause**: Two bots can independently buy/sell the same symbol. They share the same Alpaca account but have separate DB position records. Check `bots.symbols` to see which bots trade which symbols, and cross-reference with `bots.user_id` to see if they share an Alpaca account.

```sql
SELECT b.id, b.name, b.symbols, b.user_id, b.trading_frequency
FROM bots b
WHERE b.symbols::text LIKE '%<SYMBOL>%';
```

### 4. App crash during order execution

**Symptom**: Trade exists in Alpaca but not in DB (or trade has status="new" in DB).

**Diagnosis**: Check for trades with non-terminal status and verify against Alpaca.

## Useful Tables Overview

| Table | Key Columns | Notes |
|-------|------------|-------|
| `users` | `id`, `email`, `name` | Users who own bots |
| `bots` | `id`, `name`, `symbols`, `user_id`, `trading_frequency`, `status` | Bot config; `user_id` links to Alpaca credentials |
| `positions` | `id`, `bot_id`, `symbol`, `quantity`, `is_open`, `entry_price`, `entry_indicator` | CASCADE deletes with bot |
| `trades` | `id`, `bot_id`, `symbol`, `type`, `quantity`, `price`, `status`, `order_id`, `client_order_id` | `order_id` matches Alpaca order ID |
| `app_settings` | `user_id`, `category`, `settings` | `category='broker'` has Alpaca keys |
