# Sprint C: Indicators, Signals & Risk Management (Phases 11–13)

## Overview
**Goal**: Build the trading brain — indicator calculations, signal evaluation, and risk enforcement.  
**Estimated effort**: 2–3 days  
**Depends on**: Sprint A (Alpaca Client ✅), Sprint B (Trading Engine ✅)

---

## Current Status

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Indicator Calculator | `app/indicators.py` | ✅ Complete | All 7 indicators, pure pandas/numpy |
| Signal Generator | `app/signal_generator.py` | ✅ Complete | majority voting + single + per-indicator modes |
| Risk Manager | `app/risk_manager.py` | ✅ Complete | All 4 risk checks + calculation helpers |
| Trading Engine Integration | `app/trading_engine.py` | ✅ Complete | Entry-indicator tracking, two-phase buy/sell |
| Database Migration | `alembic/versions/b2c3d4...` | ✅ Complete | `entry_indicator` on positions |
| Position Schema | `app/schemas.py` | ✅ Complete | `entry_indicator` in PositionResponseSchema |
| Test Infrastructure | `tests/conftest.py` | ✅ Created | Async fixtures, factories, in-memory SQLite |
| Indicator Tests | `tests/test_indicators.py` | ✅ Created | All 7 indicators + edge cases |
| Signal Generator Tests | `tests/test_signal_generator.py` | ✅ Created | All evaluators + voting logic |
| Risk Manager Tests | `tests/test_risk_manager.py` | ✅ Created | All 4 checks + calculation helpers |
| `.env.example` | `backend/.env.example` | ✅ Created | All env vars documented |

---

## Implemented Indicators

| # | Indicator | Method | Returns |
|---|-----------|--------|---------|
| 1 | RSI (Relative Strength Index) | Wilder's smoothed avg | `{ value, period, oversold, overbought }` |
| 2 | MACD | EMA fast - EMA slow | `{ macd, signal, histogram, fast, slow, signal_period }` |
| 3 | SMA (Simple Moving Average) | Rolling mean | `{ value, period, price }` |
| 4 | EMA (Exponential Moving Average) | ewm span | `{ value, period, price }` |
| 5 | Bollinger Bands | SMA ± stdDev × std | `{ upper, middle, lower, price, bandwidth }` |
| 6 | Stochastic Oscillator | %K / %D | `{ k, d, k_period, d_period }` |
| 7 | OBV (On-Balance Volume) | Cumulative signed volume | `{ value, change }` |

---

## Signal Generation Modes

| Mode | Method | Use Case |
|------|--------|----------|
| Majority Voting | `evaluate()` | Legacy bots / confluence strategy |
| Single Indicator | `evaluate_single()` | Primary indicator per bot (Option A) |
| Per-Indicator | `evaluate_per_indicator()` | Entry-indicator tracking (current default) |

---

## Risk Checks

| Check | Method | Blocks Trade When |
|-------|--------|-------------------|
| Capital Available | `_check_capital_available()` | Capital ≤ 0 or price > capital |
| Position Size | `_check_position_size()` | Single share exceeds max_position_size % |
| Daily Loss Limit | `_check_daily_loss_limit()` | Today's P&L < -max_daily_loss % |
| Max Concurrent Positions | `_check_max_positions()` | Open positions ≥ max_concurrent_positions |

### Calculation Helpers

| Helper | Returns |
|--------|---------|
| `calculate_position_size(capital, price, config)` | Number of whole shares |
| `calculate_stop_loss(entry_price, config)` | Stop-loss price level |
| `calculate_take_profit(entry_price, config)` | Take-profit price level |

---

## Acceptance Criteria

- [x] All 7 indicators calculate correctly from OHLCV data
- [x] Signal generator produces correct buy/sell signals for known scenarios
- [x] Majority voting only produces signals when majority of indicators agree
- [x] Risk manager blocks trades exceeding position size limits
- [x] Risk manager blocks trades when daily loss limit is exceeded
- [x] Risk manager blocks trades when max concurrent positions reached
- [x] Stop-loss and take-profit prices calculated correctly
- [x] Unit tests created for all three modules
- [x] Entry-indicator tracking integrated in trading engine
- [x] `.env.example` template created

---

## Dependencies

| Dependency | Version | Status | Notes |
|------------|---------|--------|-------|
| `pandas` | ≥ 2.2.0 | ✅ In requirements.txt | Used for DataFrame operations |
| `numpy` | ≥ 1.26.0 | ✅ In requirements.txt | Used for numeric operations |
| `pandas-ta` | ≥ 0.3.14b | ⏸️ Commented out | Not needed — pure pandas/numpy implementation |
| `pytest` | ≥ 8.3.0 | ✅ In requirements.txt | Test runner |
| `pytest-asyncio` | ≥ 0.24.0 | ✅ In requirements.txt | Async test support |

> **Note**: `pandas-ta` was originally planned but is NOT required. All indicators
> are implemented using pure pandas + numpy, avoiding the `numba` dependency
> that doesn't yet support Python 3.14.

---

## Running Tests

```bash
cd backend
.\venv\Scripts\Activate.ps1

# Run all Sprint C tests
pytest tests/test_indicators.py tests/test_signal_generator.py tests/test_risk_manager.py -v

# Run with coverage
pytest tests/test_indicators.py tests/test_signal_generator.py tests/test_risk_manager.py -v --tb=short
```

---

## File Structure

```
backend/
├── app/
│   ├── indicators.py          ✅ 7 indicators, pure pandas/numpy
│   ├── signal_generator.py    ✅ 3 evaluation modes, 7 evaluators
│   ├── risk_manager.py        ✅ 4 risk checks, 3 calculation helpers
│   └── trading_engine.py      ✅ Entry-indicator tracking integration
├── tests/
│   ├── conftest.py            ✅ Test fixtures and factories
│   ├── test_indicators.py     ✅ Unit tests for all indicators
│   ├── test_signal_generator.py ✅ Unit tests for signal generation
│   └── test_risk_manager.py   ✅ Unit tests for risk management
└── .env.example               ✅ Environment variable template
```

---

## Next Steps (After Sprint C)

| Sprint | Phases | Description |
|--------|--------|-------------|
| **Sprint D** | 14 | Docker & Deployment — containerize the full stack |
| **Sprint E** | 15 | Testing & Hardening — API endpoint tests, structured logging, error handling |

---

**Last Updated**: February 17, 2026  
**Status**: Ready for validation  
**Previous**: `SPRINT_0_SUMMARY.md`, `SPRINT_1_PLAN.md`, `Feb16_Implementation_plan.md`
