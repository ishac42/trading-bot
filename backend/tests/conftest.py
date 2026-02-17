"""
Shared test fixtures for Sprint C unit tests.

Provides:
  - Sample OHLCV bar data (various scenarios)
  - Indicator config presets
  - Bot config presets
  - Risk config presets
"""

from __future__ import annotations

import pytest
import numpy as np


# ---------------------------------------------------------------------------
# OHLCV Bar Data Factories
# ---------------------------------------------------------------------------

def _make_bars(
    prices: list[float],
    *,
    spread: float = 0.5,
    volume_base: int = 10000,
) -> list[dict]:
    """
    Generate OHLCV bar dicts from a list of close prices.

    Each bar gets:
      open  = close ± small offset
      high  = max(open, close) + spread
      low   = min(open, close) - spread
      volume = volume_base with some variation
    """
    bars = []
    for i, close in enumerate(prices):
        open_price = prices[i - 1] if i > 0 else close
        high = max(open_price, close) + spread
        low = min(open_price, close) - spread
        vol = volume_base + (i * 100)
        bars.append({
            "timestamp": f"2026-02-17T09:{30 + i}:00Z",
            "open": round(open_price, 4),
            "high": round(high, 4),
            "low": round(low, 4),
            "close": round(close, 4),
            "volume": float(vol),
        })
    return bars


@pytest.fixture
def trending_up_bars() -> list[dict]:
    """50 bars with a steady uptrend (with enough noise to create some down-bars for RSI)."""
    # Noise must be wide enough that delta = 0.5 + noise[i] - noise[i-1] can go negative
    # so avg_loss > 0 and RSI doesn't become NaN.
    rng = np.random.RandomState(42)
    noise = rng.uniform(-0.8, 0.3, 50)
    prices = [100.0 + i * 0.5 + noise[i] for i in range(50)]
    return _make_bars(prices)


@pytest.fixture
def trending_down_bars() -> list[dict]:
    """50 bars with a steady downtrend (with enough noise to create some up-bars for RSI)."""
    rng = np.random.RandomState(42)
    noise = rng.uniform(-0.3, 0.8, 50)
    prices = [125.0 - i * 0.5 + noise[i] for i in range(50)]
    return _make_bars(prices)


@pytest.fixture
def oversold_bars() -> list[dict]:
    """50 bars ending in an extreme drop — triggers RSI oversold."""
    # Start with mild oscillation so RSI has a baseline, then drop hard
    rng = np.random.RandomState(42)
    mild = [100.0 + rng.uniform(-0.5, 0.5) for _ in range(20)]
    drop = [mild[-1] - i * 1.5 + rng.uniform(-0.1, 0.1) for i in range(30)]
    return _make_bars(mild + drop)


@pytest.fixture
def overbought_bars() -> list[dict]:
    """50 bars ending in an extreme rally — triggers RSI overbought."""
    rng = np.random.RandomState(42)
    mild = [100.0 + rng.uniform(-0.5, 0.5) for _ in range(20)]
    rally = [mild[-1] + i * 1.5 + rng.uniform(-0.1, 0.1) for i in range(30)]
    return _make_bars(mild + rally)


@pytest.fixture
def flat_bars() -> list[dict]:
    """50 bars with flat price action — no trend."""
    prices = [100.0] * 50
    return _make_bars(prices)


@pytest.fixture
def volatile_bars() -> list[dict]:
    """50 bars with high volatility — oscillating between 90 and 110."""
    prices = [100.0 + 10.0 * np.sin(i * 0.5) for i in range(50)]
    return _make_bars(prices)


@pytest.fixture
def few_bars() -> list[dict]:
    """Only 3 bars — insufficient for most indicators."""
    return _make_bars([100.0, 101.0, 99.0])


# ---------------------------------------------------------------------------
# Indicator Config Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def rsi_config() -> dict:
    return {"RSI": {"period": 14, "oversold": 30, "overbought": 70}}


@pytest.fixture
def macd_config() -> dict:
    return {"MACD": {"fast": 12, "slow": 26, "signal": 9}}


@pytest.fixture
def sma_config() -> dict:
    return {"SMA": {"period": 20}}


@pytest.fixture
def ema_config() -> dict:
    return {"EMA": {"period": 20}}


@pytest.fixture
def bbands_config() -> dict:
    return {"Bollinger Bands": {"period": 20, "stdDev": 2}}


@pytest.fixture
def stochastic_config() -> dict:
    return {"Stochastic": {"kPeriod": 14, "dPeriod": 3}}


@pytest.fixture
def obv_config() -> dict:
    return {"OBV": {}}


@pytest.fixture
def all_indicators_config() -> dict:
    return {
        "RSI": {"period": 14, "oversold": 30, "overbought": 70},
        "MACD": {"fast": 12, "slow": 26, "signal": 9},
        "SMA": {"period": 20},
        "EMA": {"period": 20},
        "Bollinger Bands": {"period": 20, "stdDev": 2},
        "Stochastic": {"kPeriod": 14, "dPeriod": 3},
        "OBV": {},
    }


# ---------------------------------------------------------------------------
# Bot / Risk Config Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def default_risk_config() -> dict:
    return {
        "stop_loss": 2.0,
        "take_profit": 5.0,
        "max_position_size": 10.0,
        "max_daily_loss": 5.0,
        "max_concurrent_positions": 5,
    }


@pytest.fixture
def default_bot_config(default_risk_config: dict) -> dict:
    return {
        "name": "Test Bot",
        "capital": 10000.0,
        "trading_frequency": 60,
        "symbols": ["AAPL", "MSFT"],
        "indicators": {
            "RSI": {"period": 14, "oversold": 30, "overbought": 70},
            "MACD": {"fast": 12, "slow": 26, "signal": 9},
        },
        "risk_management": default_risk_config,
        "start_hour": 9,
        "start_minute": 30,
        "end_hour": 16,
        "end_minute": 0,
    }
