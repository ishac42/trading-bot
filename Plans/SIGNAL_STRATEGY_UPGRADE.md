# Signal Strategy Upgrade: Single-Indicator Mode (Option A)

**Date**: February 17, 2026
**Status**: Planned
**Priority**: High (should be implemented before bots go live)

---

## Background

The current signal generator uses **majority voting** across all enabled indicators. While this is conservative, it has fundamental problems:

1. **Conflicting philosophies** — Mean-reversion indicators (RSI, Bollinger Bands, Stochastic) and trend-following indicators (SMA, EMA, MACD) often disagree by design. A stock dropping hard triggers a mean-reversion BUY *and* a trend-following SELL simultaneously.

2. **No exit strategy** — The majority-vote system doesn't track *which* indicator caused the entry, so the exit signal comes from a different voting round that may have nothing to do with the original trade thesis.

3. **Industry standard** — Most production trading bots follow a single clear strategy: one indicator (or indicator pair) drives entry AND exit for the same position.

---

## Option A: Single Indicator Per Bot

**Concept**: Each bot is configured with a **primary indicator** that drives all BUY/SELL decisions. Other indicators may still be enabled for monitoring/display, but only the primary one triggers trades.

### How It Works

1. User creates a bot and enables indicators (RSI, MACD, SMA, etc.)
2. User selects **one** of those enabled indicators as the **primary indicator**
3. The bot's trading loop:
   - Calculates ALL enabled indicators (for monitoring and `indicators_snapshot`)
   - Evaluates ONLY the primary indicator for BUY/SELL/HOLD
   - If the primary indicator says BUY and risk checks pass -> execute buy
   - If the primary indicator says SELL (and we have an open position) -> execute sell
   - All other indicators are logged but don't affect trade decisions

### Example

A bot configured with:
- **Primary indicator**: RSI (period=14, oversold=30, overbought=70)
- **Monitoring indicators**: MACD, SMA (displayed in UI but don't trigger trades)

Trading behavior:
- RSI drops to 25 -> **BUY** (regardless of what MACD or SMA say)
- RSI rises to 75 -> **SELL** (regardless of what MACD or SMA say)
- RSI at 50, MACD histogram < 0, SMA bearish -> **HOLD** (only RSI matters)

---

## Changes Required

### Layer 1: Frontend Types (`frontend/src/types/index.ts`)

**Add `primary_indicator` field to `BotFormData` and `Bot`**:

```typescript
// In Bot interface, add:
export interface Bot {
  // ... existing fields ...
  primary_indicator: string   // NEW — key of the primary indicator (e.g. "RSI")
}

// In BotFormData interface, add:
export interface BotFormData {
  // ... existing fields ...
  primary_indicator: string   // NEW — key of the primary indicator
}
```

**Files**: `frontend/src/types/index.ts`
**Lines affected**: Bot interface (~line 3-21), BotFormData interface (~line 93-104)

---

### Layer 2: Frontend Bot Form (`frontend/src/components/bots/form/`)

**2a. Add primary indicator selector to `IndicatorConfigSection.tsx`**

After the user enables indicators via checkboxes, add a radio button group or dropdown that lets them select which enabled indicator is the primary one.

```
Current UI:
  [x] RSI (period=14, oversold=30, overbought=70)
  [x] MACD (fast=12, slow=26, signal=9)
  [ ] SMA

Proposed UI:
  [x] RSI (period=14, oversold=30, overbought=70)     (o) Primary
  [x] MACD (fast=12, slow=26, signal=9)                ( ) Primary
  [ ] SMA
```

- Radio buttons only appear next to *enabled* indicators
- If only one indicator is enabled, it auto-selects as primary
- If the user disables the currently-primary indicator, reset `primary_indicator` to the first remaining enabled one (or empty)

**Files**: `frontend/src/components/bots/form/IndicatorConfigSection.tsx`
**Props change**: Add `primaryIndicator: string` and `onPrimaryChange: (key: string) => void`

**2b. Update `BotForm.tsx` to manage `primary_indicator` state**

- Add `primary_indicator` to `DEFAULT_FORM_DATA` (default: `""`)
- Add handler for primary indicator changes
- Auto-select primary when only one indicator is enabled
- Clear primary if its indicator is disabled

**Files**: `frontend/src/components/bots/form/BotForm.tsx`
**Lines affected**: DEFAULT_FORM_DATA (~line 18-35), handlers section, JSX props to IndicatorConfigSection

**2c. Update form validation**

Current validation only checks `Object.keys(formData.indicators).length > 0`. Add:
- `primary_indicator` must be non-empty
- `primary_indicator` must be a key in `formData.indicators` (i.e., an enabled indicator)

**Files**: `frontend/src/components/bots/form/BotForm.tsx`
**Lines affected**: `validateField` function (~line 54-102)

---

### Layer 3: Backend Pydantic Schemas (`backend/app/schemas.py`)

**Add `primary_indicator` to create/update/response schemas**:

```python
class BotCreateSchema(BaseModel):
    # ... existing fields ...
    primary_indicator: str          # NEW — key of the primary indicator

class BotResponseSchema(BaseModel):
    # ... existing fields ...
    primary_indicator: str          # NEW
```

**Files**: `backend/app/schemas.py`
**Lines affected**: BotCreateSchema (~line 37-51), BotUpdateSchema (inherits), BotResponseSchema (~line 62-85)

---

### Layer 4: Backend Database Model (`backend/app/models.py`)

**Add `primary_indicator` column to Bot table**:

```python
class Bot(Base):
    # ... existing columns ...
    primary_indicator: Mapped[str] = mapped_column(
        String(50), nullable=False, default=""
    )
```

**Files**: `backend/app/models.py`
**Lines affected**: Bot class (~after line 50)

---

### Layer 5: Alembic Migration

**Create a new migration to add the column**:

```bash
alembic revision --autogenerate -m "add_primary_indicator_to_bots"
```

This generates a migration that adds:
```python
op.add_column('bots', sa.Column('primary_indicator', sa.String(50), nullable=False, server_default=''))
```

**Files**: New file `backend/alembic/versions/XXXX_add_primary_indicator_to_bots.py`

**Data migration for existing bots**: Set `primary_indicator` to the first key in their `indicators` JSON, or leave as `""` if no indicators configured.

---

### Layer 6: Signal Generator (`backend/app/signal_generator.py`)

**Add `evaluate_single()` method** that evaluates only one indicator:

```python
def evaluate_single(
    self,
    primary_indicator: str,
    indicators: dict[str, dict[str, Any] | None],
    config: dict[str, Any],
) -> tuple[Signal, dict[str, Any]]:
    """
    Single-indicator evaluation: only the primary indicator drives the signal.
    All other indicators are recorded in details for monitoring only.
    """
    # Evaluate ALL indicators for the snapshot (monitoring)
    per_indicator = {}
    for name, values in indicators.items():
        if values is None:
            per_indicator[name] = "insufficient_data"
            continue
        evaluator_name = self._EVALUATORS.get(name)
        if evaluator_name:
            evaluator = getattr(self, evaluator_name)
            params = config.get(name, {}) or {}
            signal = evaluator(values, params)
            per_indicator[name] = signal.value

    # Use ONLY the primary indicator for the trading decision
    primary_values = indicators.get(primary_indicator)
    if primary_values is None:
        return Signal.HOLD, {
            "per_indicator": per_indicator,
            "primary_indicator": primary_indicator,
            "primary_signal": "insufficient_data",
            "final_signal": "hold",
        }

    evaluator_name = self._EVALUATORS.get(primary_indicator)
    if not evaluator_name:
        return Signal.HOLD, {...}

    params = config.get(primary_indicator, {}) or {}
    evaluator = getattr(self, evaluator_name)
    final_signal = evaluator(primary_values, params)

    return final_signal, {
        "per_indicator": per_indicator,
        "primary_indicator": primary_indicator,
        "primary_signal": final_signal.value,
        "final_signal": final_signal.value,
    }
```

The existing `evaluate()` method (majority voting) remains unchanged for forward compatibility with Option C.

**Files**: `backend/app/signal_generator.py`
**Lines affected**: Add new method (~after line 128)

---

### Layer 7: Trading Engine (`backend/app/trading_engine.py`)

**7a. Update `register_bot` to load `primary_indicator` into config**:

```python
config = {
    # ... existing fields ...
    "primary_indicator": bot.primary_indicator,  # NEW
}
```

**Files**: `backend/app/trading_engine.py`
**Lines affected**: `register_bot()` config dict (~line 688-699)

**7b. Update `_process_symbol` to call `evaluate_single()`**:

Replace:
```python
signal, signal_details = signal_generator.evaluate(
    indicators_snapshot, indicators_config
)
```

With:
```python
primary = self.config.get("primary_indicator", "")
if primary:
    signal, signal_details = signal_generator.evaluate_single(
        primary, indicators_snapshot, indicators_config
    )
else:
    # Fallback to majority voting if no primary set (legacy bots)
    signal, signal_details = signal_generator.evaluate(
        indicators_snapshot, indicators_config
    )
```

**Files**: `backend/app/trading_engine.py`
**Lines affected**: `_process_symbol()` (~lines 190-193)

---

### Layer 8: Bot Router (`backend/app/routers/bots.py`)

No structural changes needed. The `BotCreateSchema` already controls what fields are accepted, and the ORM model handles persistence. Just verify that existing create/update endpoints pass through the new `primary_indicator` field correctly.

**Verify only** — no code changes expected.

---

## Summary of All File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/types/index.ts` | Modify | Add `primary_indicator` to `Bot` and `BotFormData` |
| `frontend/src/components/bots/form/IndicatorConfigSection.tsx` | Modify | Add radio buttons for primary indicator selection |
| `frontend/src/components/bots/form/BotForm.tsx` | Modify | Manage `primary_indicator` state, validation, auto-select |
| `backend/app/schemas.py` | Modify | Add `primary_indicator` to create/update/response schemas |
| `backend/app/models.py` | Modify | Add `primary_indicator` column to Bot table |
| `backend/alembic/versions/XXXX_...py` | Create | Migration to add `primary_indicator` column |
| `backend/app/signal_generator.py` | Modify | Add `evaluate_single()` method |
| `backend/app/trading_engine.py` | Modify | Load `primary_indicator` in config; call `evaluate_single()` |

**Total files modified**: 7
**Total files created**: 1 (Alembic migration)
**Estimated effort**: 0.5-1 day

---

## Migration / Backward Compatibility

- **Existing bots in DB**: The migration sets `primary_indicator = ""` for all existing bots. The trading engine falls back to majority voting when `primary_indicator` is empty, so existing bots continue working unchanged.
- **Frontend**: The form's `DEFAULT_FORM_DATA` starts with `primary_indicator: ""`. If only one indicator is enabled, it auto-selects as primary.
- **API**: The `BotCreateSchema` requires `primary_indicator` going forward. Old API clients that don't send it will get a validation error (422), which is acceptable since there are no external API consumers.

---

## Acceptance Criteria

- [ ] Bot creation form shows radio buttons to select a primary indicator
- [ ] Primary indicator auto-selects when only one indicator is enabled
- [ ] Validation blocks form submission if no primary indicator is selected
- [ ] Backend stores `primary_indicator` in the database
- [ ] Signal generator uses ONLY the primary indicator for trading decisions
- [ ] All other indicators still calculate and appear in `indicators_snapshot`
- [ ] Existing bots (with `primary_indicator=""`) fall back to majority voting
- [ ] Trade records show which indicator was primary in their snapshot
- [ ] Stop-loss and take-profit exits still work independently of indicators

---

## Future: Option C (Strategy Mode Selector)

See note in `BACKEND_IMPLEMENTATION_PLAN.md` Phase 12 for the planned Option C upgrade, which lets users choose between single-indicator and confluence (majority-voting) modes per bot.

---

**Last Updated**: February 17, 2026
**Related**: `Feb16_Implementation_plan.md`, `BACKEND_IMPLEMENTATION_PLAN.md` Phase 12
