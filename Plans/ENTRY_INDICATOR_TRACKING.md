# Entry-Indicator Tracking: Per-Position Exit Strategy

**Date**: February 17, 2026
**Status**: Planned
**Priority**: High (replaces Option A single-primary-indicator approach)

---

## Background

Option A (single primary indicator per bot) was implemented but doesn't match the desired behavior. The user wants:

1. **Multiple indicators active simultaneously** — no "primary" selection needed
2. **Any indicator can trigger a BUY** — first enabled indicator that says BUY opens the position
3. **Exit tracks entry** — once a position is opened by indicator X, only indicator X's SELL signal can close it
4. **Other indicators are irrelevant for that position** — they keep computing for monitoring but don't influence the exit

This is a **per-position indicator tracking** strategy, not a per-bot strategy.

---

## How It Works

### Buy Flow

```
Each trading cycle, for each symbol:
  1. If an open position already exists for this symbol → skip buy logic (go to sell flow)
  2. Calculate ALL enabled indicators
  3. Evaluate each indicator independently
  4. Find the FIRST indicator that produces a BUY signal
  5. If found → execute buy, tag the position with entry_indicator = that indicator's key
  6. If none → HOLD, do nothing
```

### Sell Flow

```
Each trading cycle, for each symbol:
  1. If NO open position for this symbol → nothing to sell
  2. Look up the position's entry_indicator (e.g. "RSI")
  3. Calculate ALL enabled indicators (for monitoring snapshot)
  4. Evaluate ONLY the entry_indicator's signal
  5. If entry_indicator says SELL → execute sell
  6. If entry_indicator says HOLD or BUY → keep position open
  (Stop-loss and take-profit still trigger independently, as they do today)
```

### Example

Bot configured with RSI and MACD enabled, trading AAPL:

| Cycle | RSI Signal | MACD Signal | Open Position? | Action |
|-------|-----------|-------------|----------------|--------|
| 1 | HOLD | HOLD | No | Do nothing |
| 2 | **BUY** | HOLD | No | **BUY AAPL** — tag position with `entry_indicator="RSI"` |
| 3 | HOLD | SELL | Yes (RSI) | Do nothing — only RSI matters for this position |
| 4 | HOLD | BUY | Yes (RSI) | Do nothing — position already open |
| 5 | **SELL** | BUY | Yes (RSI) | **SELL AAPL** — RSI said SELL, position closed |
| 6 | HOLD | **BUY** | No | **BUY AAPL** — tag position with `entry_indicator="MACD"` |
| 7 | SELL | HOLD | Yes (MACD) | Do nothing — only MACD matters now |
| 8 | BUY | **SELL** | Yes (MACD) | **SELL AAPL** — MACD said SELL, position closed |

---

## Design Decisions

### One position per symbol (unchanged)
The current system allows one open position per bot+symbol. This stays the same. Whichever indicator triggers a BUY first "claims" that symbol's position. Other indicators that also say BUY are ignored until the position closes.

### Indicator priority for simultaneous BUY signals
When multiple indicators say BUY in the same cycle and there's no open position, we take the **first one** found (iteration order of the indicators dict, which matches the order they were configured in the form). This is deterministic and predictable.

### Stop-loss / take-profit are independent
SL/TP exits fire regardless of indicator signals, exactly as they do today. The `entry_indicator` field is purely for indicator-based exits.

### Legacy bots (`entry_indicator` is empty)
For any position with `entry_indicator=""` (pre-migration positions), the sell flow falls back to majority voting (existing `evaluate()` behavior). This ensures backward compatibility.

---

## Changes Required

### Rollback: Remove `primary_indicator` from Bot (Option A cleanup)

The `primary_indicator` field on the Bot model/schemas/types is no longer needed. The form no longer asks users to select a primary — all enabled indicators are equal.

**Files to modify:**
| File | Change |
|------|--------|
| `frontend/src/types/index.ts` | Remove `primary_indicator` from `Bot` and `BotFormData` interfaces |
| `frontend/src/components/bots/form/IndicatorConfigSection.tsx` | Remove radio buttons, `primaryIndicator`/`onPrimaryChange` props, `Chip`, `Radio` imports |
| `frontend/src/components/bots/form/BotForm.tsx` | Remove `primary_indicator` from `DEFAULT_FORM_DATA`, `buildInitial`, handlers, validation, JSX props |
| `frontend/src/mocks/dashboardData.ts` | Remove `primary_indicator` from all mock bots |
| `backend/app/schemas.py` | Remove `primary_indicator` from `BotCreateSchema`, `BotUpdateSchema`, `BotResponseSchema` |
| `backend/app/models.py` | Remove `primary_indicator` column from `Bot` model |
| `backend/app/routers/bots.py` | Remove `primary_indicator` from `_bot_to_response`, `create_bot`, `update_bot` |
| `backend/app/trading_engine.py` | Remove `primary_indicator` from `register_bot` config dict |
| `backend/alembic/versions/a1b2c3d4e5f6_...py` | Update migration: drop `primary_indicator` column (or create new migration) |

---

### Layer 1: Frontend Types (`frontend/src/types/index.ts`)

**Add `entry_indicator` to Position interface:**

```typescript
export interface Position {
  // ... existing fields ...
  entry_indicator?: string   // NEW — which indicator triggered the buy (e.g. "RSI")
}
```

**Remove `primary_indicator` from Bot and BotFormData interfaces.**

---

### Layer 2: Frontend Form (rollback only, no new UI)

**`IndicatorConfigSection.tsx`** — Revert to the original version:
- Remove `Radio`, `Chip` imports
- Remove `primaryIndicator`, `onPrimaryChange`, `primaryError` props
- Remove radio buttons and "Primary" chip from JSX
- Restore original description text
- Restore original `borderColor` logic (just `primary.main` vs `divider`)

**`BotForm.tsx`** — Revert primary-indicator logic:
- Remove `primary_indicator` from `DEFAULT_FORM_DATA`
- Remove `primary_indicator` from `buildInitial()`
- Remove `primary_indicator` case from `validateField()`
- Remove `'primary_indicator'` from `validateAll()` fields array and `handleSubmit` allFields
- Remove `handlePrimaryIndicatorChange` callback
- Revert `handleIndicatorsChange` to not manage primary indicator
- Remove `primaryIndicator`, `onPrimaryChange`, `primaryError` props from `<IndicatorConfigSection>`

---

### Layer 3: Backend Schemas (`backend/app/schemas.py`)

**Remove `primary_indicator` from bot schemas.**

**Add `entry_indicator` to position response schema:**

```python
class PositionResponseSchema(BaseModel):
    # ... existing fields ...
    entry_indicator: str | None = None   # NEW
```

---

### Layer 4: Backend Position Model (`backend/app/models.py`)

**Remove `primary_indicator` from Bot model.**

**Add `entry_indicator` column to Position table:**

```python
class Position(Base):
    # ... existing columns ...
    entry_indicator: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None
    )   # Which indicator triggered the entry (e.g. "RSI", "MACD")
```

---

### Layer 5: Alembic Migration

**Create a new migration that:**
1. Drops `primary_indicator` from `bots` table
2. Adds `entry_indicator` to `positions` table

```python
def upgrade() -> None:
    op.drop_column('bots', 'primary_indicator')
    op.add_column(
        'positions',
        sa.Column('entry_indicator', sa.String(50), nullable=True)
    )

def downgrade() -> None:
    op.drop_column('positions', 'entry_indicator')
    op.add_column(
        'bots',
        sa.Column('primary_indicator', sa.String(50), nullable=False, server_default='')
    )
```

**Backward compatibility**: Existing open positions will have `entry_indicator=NULL`. The trading engine falls back to majority voting for these positions (see Layer 7).

---

### Layer 6: Signal Generator (`backend/app/signal_generator.py`)

**Add `evaluate_per_indicator()` method** — returns a clean dict of each indicator's individual signal without any voting:

```python
def evaluate_per_indicator(
    self,
    indicators: dict[str, dict[str, Any] | None],
    config: dict[str, Any],
) -> dict[str, Signal]:
    """
    Evaluate each indicator independently and return a mapping of
    indicator_name → Signal.

    Unlike evaluate() (majority voting) or evaluate_single() (one indicator),
    this returns ALL per-indicator signals so the caller can decide what to do
    with each one.

    Parameters
    ----------
    indicators : dict
        Output of IndicatorCalculator.calculate().
    config : dict
        Bot's indicator config.

    Returns
    -------
    dict[str, Signal]
        Mapping of indicator_name → Signal (BUY/SELL/HOLD).
        Indicators with insufficient data or errors are omitted.
    """
    results: dict[str, Signal] = {}

    for name, values in indicators.items():
        if values is None:
            continue  # insufficient data — skip
        evaluator_name = self._EVALUATORS.get(name)
        if not evaluator_name:
            continue  # unknown indicator — skip
        try:
            params = config.get(name, {}) or {}
            evaluator = getattr(self, evaluator_name)
            results[name] = evaluator(values, params)
        except Exception as e:
            logger.error("Error evaluating %s: %s", name, e)

    return results
```

The existing `evaluate()` (majority voting) and `evaluate_single()` methods remain unchanged for now. They can be cleaned up later if no longer needed.

---

### Layer 7: Trading Engine (`backend/app/trading_engine.py`)

**This is the core change.** Replace the current `_process_symbol()` with a two-phase approach:

```python
async def _process_symbol(self, symbol: str) -> None:
    """
    Full trading pipeline for a single symbol (entry-indicator tracking mode):
      Phase 1 — SELL CHECK: If we have an open position, check only its
                entry_indicator for a SELL signal.
      Phase 2 — BUY CHECK:  If no open position, check all indicators
                for a BUY signal. First one wins.
    """
    if not alpaca_client:
        return

    try:
        # 1. Fetch recent bars
        bars = await alpaca_client.get_bars(symbol, timeframe="1Min", limit=50)
        if not bars:
            return

        # 2. Calculate all indicators
        indicators_config = self.config.get("indicators", {})
        indicators_snapshot = indicator_calculator.calculate(bars, indicators_config)

        # 3. Evaluate each indicator independently
        per_indicator_signals = signal_generator.evaluate_per_indicator(
            indicators_snapshot, indicators_config
        )

        # Build snapshot for DB storage
        full_snapshot = {
            "indicators": indicators_snapshot,
            "per_indicator_signals": {k: v.value for k, v in per_indicator_signals.items()},
        }

        # 4. Check for open position on this symbol
        open_position = await self._get_open_position(symbol)

        if open_position:
            # ---- SELL PHASE ----
            entry_ind = open_position.entry_indicator or ""

            if not entry_ind:
                # Legacy position (no entry_indicator) — fall back to majority vote
                signal, signal_details = signal_generator.evaluate(
                    indicators_snapshot, indicators_config
                )
                if signal == Signal.SELL:
                    current_price = await alpaca_client.get_latest_price(symbol)
                    if current_price > 0:
                        full_snapshot["signal_details"] = signal_details
                        await self._execute_sell(symbol, current_price, full_snapshot)
            else:
                # Check only the entry indicator's signal
                entry_signal = per_indicator_signals.get(entry_ind, Signal.HOLD)
                if entry_signal == Signal.SELL:
                    current_price = await alpaca_client.get_latest_price(symbol)
                    if current_price > 0:
                        full_snapshot["exit_indicator"] = entry_ind
                        full_snapshot["exit_signal"] = entry_signal.value
                        await self._execute_sell(symbol, current_price, full_snapshot)
                else:
                    logger.debug(
                        "Position open for %s via %s — signal is %s, holding",
                        symbol, entry_ind, entry_signal.value,
                    )
        else:
            # ---- BUY PHASE ----
            # Find the first indicator that says BUY
            buy_indicator: str | None = None
            for ind_name, ind_signal in per_indicator_signals.items():
                if ind_signal == Signal.BUY:
                    buy_indicator = ind_name
                    break

            if not buy_indicator:
                return  # All indicators say HOLD or SELL — no action

            # Get current price
            current_price = await alpaca_client.get_latest_price(symbol)
            if current_price <= 0:
                return

            # Risk checks
            today_pnl = await self.engine.get_bot_today_pnl(self.bot_id)
            open_count = await self._count_open_positions()

            allowed, block_reason = await risk_manager.validate(
                signal=Signal.BUY,
                bot_config=self.config,
                symbol=symbol,
                current_price=current_price,
                today_pnl=today_pnl,
                open_position_count=open_count,
            )
            if not allowed:
                logger.info("Risk blocked BUY for %s: %s", symbol, block_reason)
                return

            # Execute buy and tag position with entry_indicator
            full_snapshot["entry_indicator"] = buy_indicator
            full_snapshot["entry_signal"] = "buy"
            await self._execute_buy(
                symbol, current_price, full_snapshot, entry_indicator=buy_indicator
            )

    except Exception as e:
        logger.error("Error processing %s for bot %s: %s", symbol, self.bot_id[:8], e)
```

**Also refactor `_execute_trade()` → split into `_execute_buy()` and `_execute_sell()`:**

`_execute_buy()` gains an `entry_indicator` parameter and writes it to the Position record:

```python
async def _execute_buy(
    self,
    symbol: str,
    current_price: float,
    indicators_snapshot: dict[str, Any] | None,
    entry_indicator: str = "",
) -> None:
    # ... same as current buy logic in _execute_trade ...
    position = Position(
        # ... existing fields ...
        entry_indicator=entry_indicator,   # NEW — tag which indicator triggered this
    )
```

`_execute_sell()` stays the same (it already exists as a separate method).

**Add `_get_open_position()` helper:**

```python
async def _get_open_position(self, symbol: str) -> Position | None:
    """Fetch the open position for this bot+symbol, if any."""
    async with async_session() as session:
        result = await session.execute(
            select(Position).where(
                Position.bot_id == self.bot_id,
                Position.symbol == symbol,
                Position.is_open.is_(True),
            )
        )
        return result.scalar_one_or_none()
```

---

### Layer 8: Bot Router (`backend/app/routers/bots.py`)

**Remove `primary_indicator` from `_bot_to_response()`, `create_bot()`, `update_bot()`.**

No other router changes needed — the `entry_indicator` lives on Position, not Bot.

**Update position serialization** (if there's a position response helper) to include `entry_indicator`.

---

### Layer 9: Frontend Position Display (minor)

Update the positions UI to show which indicator triggered each position. This is a nice-to-have display enhancement:

- Show `entry_indicator` as a badge/chip on each position card
- e.g. "AAPL — Opened via RSI" or a small "RSI" chip

**Files**: Whichever component renders position cards (likely in the dashboard or bot detail page).

---

## Summary of All File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/types/index.ts` | Modify | Remove `primary_indicator` from `Bot`/`BotFormData`; add `entry_indicator?` to `Position` |
| `frontend/src/components/bots/form/IndicatorConfigSection.tsx` | Modify | Revert to pre-Option-A (remove radio buttons, primary props) |
| `frontend/src/components/bots/form/BotForm.tsx` | Modify | Revert primary_indicator state/validation/handlers |
| `frontend/src/mocks/dashboardData.ts` | Modify | Remove `primary_indicator` from mock bots |
| `backend/app/schemas.py` | Modify | Remove `primary_indicator` from bot schemas; add `entry_indicator` to `PositionResponseSchema` |
| `backend/app/models.py` | Modify | Remove `primary_indicator` from `Bot`; add `entry_indicator` to `Position` |
| `backend/alembic/versions/XXXX_...py` | Create | Drop `primary_indicator` from bots; add `entry_indicator` to positions |
| `backend/app/signal_generator.py` | Modify | Add `evaluate_per_indicator()` method |
| `backend/app/trading_engine.py` | Modify | Rewrite `_process_symbol()` with two-phase buy/sell logic; split `_execute_trade()` → `_execute_buy()` |
| `backend/app/routers/bots.py` | Modify | Remove `primary_indicator` from bot CRUD |

**Total files modified**: 9
**Total files created**: 1 (Alembic migration)
**Estimated effort**: 1–2 hours

---

## Migration / Backward Compatibility

- **Existing bots**: Removing `primary_indicator` from the Bot model has no impact on bot behavior — bots just use whatever indicators are in their `indicators` JSON config.
- **Existing open positions**: Will have `entry_indicator=NULL`. The trading engine detects this and falls back to majority voting for sell signals on these legacy positions.
- **New positions**: Will always have `entry_indicator` set to the indicator key that triggered the buy.
- **Stop-loss / take-profit**: Continue to work independently — they fire regardless of indicator signals.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Multiple indicators say BUY simultaneously, no position | First indicator (in config order) wins; position tagged with that indicator |
| Position open via RSI; MACD says SELL | Ignored — only RSI matters for this position |
| Position open via RSI; RSI says HOLD | Hold — wait for RSI to say SELL |
| Position open via RSI; RSI has insufficient data | Hold — can't generate signal, position stays open |
| Position open via RSI; RSI is removed from bot config | Position stays open; RSI can't be evaluated → HOLD. User should manually close or add RSI back. (Could add a warning in UI for orphaned entry indicators.) |
| SL/TP price hit while entry indicator says HOLD | SL/TP exit fires normally — risk exits are always independent |
| Bot has only one indicator enabled | That indicator controls everything — same as Option A but without explicit selection |
| Legacy position (`entry_indicator=NULL`) | Falls back to majority voting for sell signal (backward compatible) |

---

## Acceptance Criteria

- [ ] Bot creation form allows enabling multiple indicators (no primary selection)
- [ ] All enabled indicators are evaluated every cycle
- [ ] A BUY is triggered when ANY enabled indicator produces a BUY signal (and no open position)
- [ ] The position is tagged with `entry_indicator` recording which indicator triggered the buy
- [ ] SELL is only triggered when the position's `entry_indicator` produces a SELL signal
- [ ] Other indicators' SELL signals are ignored for an open position
- [ ] Trade records show `entry_indicator` in `indicators_snapshot`
- [ ] Stop-loss and take-profit exits still work independently
- [ ] Legacy positions (`entry_indicator=NULL`) fall back to majority voting
- [ ] `primary_indicator` field is fully removed from Bot model, schemas, and UI

---

## Comparison: Option A vs Entry-Indicator Tracking

| Aspect | Option A (Single Primary) | Entry-Indicator Tracking |
|--------|--------------------------|--------------------------|
| Indicator selection | User picks ONE primary | No selection needed — all equal |
| Which indicator triggers BUY | Only the primary | Any enabled indicator |
| Which indicator triggers SELL | Only the primary | The indicator that triggered the BUY for that position |
| Tracking level | Per bot | Per position |
| Multiple indicators useful? | Only for monitoring | Yes — any can trigger entries |
| Exit consistency | Always same indicator | Always same indicator (matched to entry) |
| User configuration | More choices to make | Simpler — just enable indicators |

---

**Last Updated**: February 17, 2026
**Replaces**: `SIGNAL_STRATEGY_UPGRADE.md` (Option A)
**Related**: `BACKEND_IMPLEMENTATION_PLAN.md`, `SIGNAL_STRATEGY_UPGRADE.md`
