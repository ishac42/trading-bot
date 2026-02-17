"""
Unit tests for app.indicators — IndicatorCalculator.

Tests each of the 7 indicators with known data scenarios plus edge cases:
  - RSI, MACD, SMA, EMA, Bollinger Bands, Stochastic, OBV

Run:
    pytest tests/test_indicators.py -v
"""

from __future__ import annotations

import pytest

from app.indicators import IndicatorCalculator, indicator_calculator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def assert_keys(result: dict | None, expected_keys: set[str]) -> None:
    """Assert the result is not None and has the expected keys."""
    assert result is not None, "Expected non-None result"
    assert set(result.keys()) == expected_keys


# ===========================================================================
# IndicatorCalculator.calculate() — dispatch tests
# ===========================================================================

class TestCalculateDispatch:
    """Tests for the top-level calculate() dispatcher."""

    def test_returns_none_for_all_when_insufficient_bars(self, few_bars, all_indicators_config):
        """When fewer than MIN_BARS bars are provided, all indicators return None."""
        results = indicator_calculator.calculate(few_bars, all_indicators_config)
        assert all(v is None for v in results.values())

    def test_returns_none_for_empty_bars(self, all_indicators_config):
        """Empty bar list returns None for all indicators."""
        results = indicator_calculator.calculate([], all_indicators_config)
        assert all(v is None for v in results.values())

    def test_unknown_indicator_returns_none(self, trending_up_bars):
        """Unknown indicator names are logged and return None."""
        config = {"FakeIndicator": {"period": 14}}
        results = indicator_calculator.calculate(trending_up_bars, config)
        assert results["FakeIndicator"] is None

    def test_only_requested_indicators_are_computed(self, trending_up_bars):
        """Only indicators present in config are calculated."""
        config = {"RSI": {"period": 14}, "SMA": {"period": 20}}
        results = indicator_calculator.calculate(trending_up_bars, config)
        assert set(results.keys()) == {"RSI", "SMA"}

    def test_all_indicators_return_values_with_enough_data(
        self, trending_up_bars, all_indicators_config
    ):
        """With 50 uptrending bars, every indicator should return non-None."""
        results = indicator_calculator.calculate(trending_up_bars, all_indicators_config)
        for name, value in results.items():
            assert value is not None, f"{name} returned None unexpectedly"


# ===========================================================================
# RSI
# ===========================================================================

class TestRSI:
    """Tests for RSI (Relative Strength Index)."""

    def test_rsi_returns_correct_keys(self, trending_up_bars, rsi_config):
        results = indicator_calculator.calculate(trending_up_bars, rsi_config)
        assert_keys(results["RSI"], {"value", "period", "oversold", "overbought"})

    def test_rsi_value_range(self, trending_up_bars, rsi_config):
        """RSI should always be between 0 and 100."""
        result = indicator_calculator.calculate(trending_up_bars, rsi_config)["RSI"]
        assert 0 <= result["value"] <= 100

    def test_rsi_high_on_uptrend(self, overbought_bars, rsi_config):
        """In a strong uptrend, RSI should be high (above 60)."""
        result = indicator_calculator.calculate(overbought_bars, rsi_config)["RSI"]
        assert result["value"] > 60, f"Expected RSI > 60 in uptrend, got {result['value']}"

    def test_rsi_low_on_downtrend(self, oversold_bars, rsi_config):
        """In a strong downtrend, RSI should be low (below 40)."""
        result = indicator_calculator.calculate(oversold_bars, rsi_config)["RSI"]
        assert result["value"] < 40, f"Expected RSI < 40 in downtrend, got {result['value']}"

    def test_rsi_returns_none_insufficient_data(self, few_bars, rsi_config):
        """RSI needs period+1 bars minimum."""
        result = indicator_calculator.calculate(few_bars, rsi_config)["RSI"]
        assert result is None

    def test_rsi_respects_custom_period(self, trending_up_bars):
        """RSI period should match the config."""
        config = {"RSI": {"period": 7, "oversold": 25, "overbought": 75}}
        result = indicator_calculator.calculate(trending_up_bars, config)["RSI"]
        assert result["period"] == 7
        assert result["oversold"] == 25
        assert result["overbought"] == 75


# ===========================================================================
# MACD
# ===========================================================================

class TestMACD:
    """Tests for MACD (Moving Average Convergence Divergence)."""

    def test_macd_returns_correct_keys(self, trending_up_bars, macd_config):
        results = indicator_calculator.calculate(trending_up_bars, macd_config)
        assert_keys(results["MACD"], {"macd", "signal", "histogram", "fast", "slow", "signal_period"})

    def test_macd_positive_histogram_on_uptrend(self, trending_up_bars, macd_config):
        """In an uptrend, the MACD histogram should be positive."""
        result = indicator_calculator.calculate(trending_up_bars, macd_config)["MACD"]
        assert result["histogram"] > 0, f"Expected positive histogram, got {result['histogram']}"

    def test_macd_negative_histogram_on_downtrend(self, trending_down_bars, macd_config):
        """In a downtrend, the MACD histogram should be negative."""
        result = indicator_calculator.calculate(trending_down_bars, macd_config)["MACD"]
        assert result["histogram"] < 0, f"Expected negative histogram, got {result['histogram']}"

    def test_macd_returns_none_insufficient_data(self, few_bars, macd_config):
        """MACD needs slow + signal bars minimum."""
        result = indicator_calculator.calculate(few_bars, macd_config)["MACD"]
        assert result is None

    def test_macd_respects_custom_params(self, trending_up_bars):
        config = {"MACD": {"fast": 8, "slow": 17, "signal": 5}}
        result = indicator_calculator.calculate(trending_up_bars, config)["MACD"]
        assert result["fast"] == 8
        assert result["slow"] == 17
        assert result["signal_period"] == 5


# ===========================================================================
# SMA
# ===========================================================================

class TestSMA:
    """Tests for SMA (Simple Moving Average)."""

    def test_sma_returns_correct_keys(self, trending_up_bars, sma_config):
        results = indicator_calculator.calculate(trending_up_bars, sma_config)
        assert_keys(results["SMA"], {"value", "period", "price"})

    def test_sma_below_price_in_uptrend(self, trending_up_bars, sma_config):
        """In an uptrend, current price should be above the SMA."""
        result = indicator_calculator.calculate(trending_up_bars, sma_config)["SMA"]
        assert result["price"] > result["value"], "Price should be above SMA in uptrend"

    def test_sma_above_price_in_downtrend(self, trending_down_bars, sma_config):
        """In a downtrend, current price should be below the SMA."""
        result = indicator_calculator.calculate(trending_down_bars, sma_config)["SMA"]
        assert result["price"] < result["value"], "Price should be below SMA in downtrend"

    def test_sma_equals_price_when_flat(self, flat_bars, sma_config):
        """In flat price action, SMA should equal the price."""
        result = indicator_calculator.calculate(flat_bars, sma_config)["SMA"]
        assert abs(result["value"] - result["price"]) < 0.01

    def test_sma_returns_none_insufficient_data(self, few_bars, sma_config):
        result = indicator_calculator.calculate(few_bars, sma_config)["SMA"]
        assert result is None


# ===========================================================================
# EMA
# ===========================================================================

class TestEMA:
    """Tests for EMA (Exponential Moving Average)."""

    def test_ema_returns_correct_keys(self, trending_up_bars, ema_config):
        results = indicator_calculator.calculate(trending_up_bars, ema_config)
        assert_keys(results["EMA"], {"value", "period", "price"})

    def test_ema_below_price_in_uptrend(self, trending_up_bars, ema_config):
        result = indicator_calculator.calculate(trending_up_bars, ema_config)["EMA"]
        assert result["price"] > result["value"], "Price should be above EMA in uptrend"

    def test_ema_above_price_in_downtrend(self, trending_down_bars, ema_config):
        result = indicator_calculator.calculate(trending_down_bars, ema_config)["EMA"]
        assert result["price"] < result["value"], "Price should be below EMA in downtrend"

    def test_ema_returns_none_insufficient_data(self, few_bars, ema_config):
        result = indicator_calculator.calculate(few_bars, ema_config)["EMA"]
        assert result is None


# ===========================================================================
# Bollinger Bands
# ===========================================================================

class TestBollingerBands:
    """Tests for Bollinger Bands."""

    def test_bbands_returns_correct_keys(self, trending_up_bars, bbands_config):
        results = indicator_calculator.calculate(trending_up_bars, bbands_config)
        assert_keys(
            results["Bollinger Bands"],
            {"upper", "middle", "lower", "price", "bandwidth"},
        )

    def test_bbands_ordering(self, trending_up_bars, bbands_config):
        """Upper > Middle > Lower always."""
        result = indicator_calculator.calculate(trending_up_bars, bbands_config)["Bollinger Bands"]
        assert result["upper"] > result["middle"] > result["lower"]

    def test_bbands_narrow_on_flat(self, flat_bars, bbands_config):
        """Flat prices should produce very narrow bands (low bandwidth)."""
        result = indicator_calculator.calculate(flat_bars, bbands_config)["Bollinger Bands"]
        assert result["bandwidth"] < 1.0, f"Expected narrow bands, got bandwidth={result['bandwidth']}"

    def test_bbands_wide_on_volatile(self, volatile_bars, bbands_config):
        """Volatile prices should produce wider bands."""
        result = indicator_calculator.calculate(volatile_bars, bbands_config)["Bollinger Bands"]
        assert result["bandwidth"] > 0.5, f"Expected wider bands, got bandwidth={result['bandwidth']}"

    def test_bbands_returns_none_insufficient_data(self, few_bars, bbands_config):
        result = indicator_calculator.calculate(few_bars, bbands_config)["Bollinger Bands"]
        assert result is None


# ===========================================================================
# Stochastic Oscillator
# ===========================================================================

class TestStochastic:
    """Tests for Stochastic Oscillator."""

    def test_stochastic_returns_correct_keys(self, trending_up_bars, stochastic_config):
        results = indicator_calculator.calculate(trending_up_bars, stochastic_config)
        assert_keys(results["Stochastic"], {"k", "d", "k_period", "d_period"})

    def test_stochastic_range(self, trending_up_bars, stochastic_config):
        """Both %K and %D should be between 0 and 100."""
        result = indicator_calculator.calculate(trending_up_bars, stochastic_config)["Stochastic"]
        assert 0 <= result["k"] <= 100
        assert 0 <= result["d"] <= 100

    def test_stochastic_high_on_uptrend(self, overbought_bars, stochastic_config):
        """In a strong uptrend, %K should be high."""
        result = indicator_calculator.calculate(overbought_bars, stochastic_config)["Stochastic"]
        assert result["k"] > 50, f"Expected %K > 50 on uptrend, got {result['k']}"

    def test_stochastic_low_on_downtrend(self, oversold_bars, stochastic_config):
        """In a strong downtrend, %K should be low."""
        result = indicator_calculator.calculate(oversold_bars, stochastic_config)["Stochastic"]
        assert result["k"] < 50, f"Expected %K < 50 on downtrend, got {result['k']}"

    def test_stochastic_returns_none_insufficient_data(self, few_bars, stochastic_config):
        result = indicator_calculator.calculate(few_bars, stochastic_config)["Stochastic"]
        assert result is None


# ===========================================================================
# OBV (On-Balance Volume)
# ===========================================================================

class TestOBV:
    """Tests for OBV (On-Balance Volume)."""

    def test_obv_returns_correct_keys(self, trending_up_bars, obv_config):
        results = indicator_calculator.calculate(trending_up_bars, obv_config)
        assert_keys(results["OBV"], {"value", "change"})

    def test_obv_positive_change_on_uptrend(self, trending_up_bars, obv_config):
        """In an uptrend, the OBV change should be positive."""
        result = indicator_calculator.calculate(trending_up_bars, obv_config)["OBV"]
        assert result["change"] > 0, f"Expected positive OBV change, got {result['change']}"

    def test_obv_negative_change_on_downtrend(self, trending_down_bars, obv_config):
        """In a downtrend, the OBV change should be negative."""
        result = indicator_calculator.calculate(trending_down_bars, obv_config)["OBV"]
        assert result["change"] < 0, f"Expected negative OBV change, got {result['change']}"

    def test_obv_returns_none_single_bar(self, obv_config):
        """OBV needs at least 2 bars."""
        bars = [{"timestamp": "2026-02-17", "open": 100, "high": 101, "low": 99, "close": 100, "volume": 10000}]
        result = indicator_calculator.calculate(bars, obv_config)["OBV"]
        assert result is None


# ===========================================================================
# JSON Serializability
# ===========================================================================

class TestJSONSerializable:
    """All results must be JSON-serializable for Trade.indicators_snapshot."""

    def test_all_results_json_serializable(self, trending_up_bars, all_indicators_config):
        import json
        results = indicator_calculator.calculate(trending_up_bars, all_indicators_config)
        # This should NOT raise
        serialized = json.dumps(results)
        assert isinstance(serialized, str)

    def test_results_contain_only_basic_types(self, trending_up_bars, all_indicators_config):
        """All values should be int, float, str, or None — no numpy types."""
        results = indicator_calculator.calculate(trending_up_bars, all_indicators_config)
        for name, values in results.items():
            if values is None:
                continue
            for key, val in values.items():
                assert isinstance(val, (int, float, str, type(None))), (
                    f"{name}.{key} has type {type(val).__name__}, expected basic Python type"
                )


# ===========================================================================
# Singleton
# ===========================================================================

class TestSingleton:
    """Test that the module-level singleton is usable."""

    def test_singleton_is_instance(self):
        assert isinstance(indicator_calculator, IndicatorCalculator)

    def test_singleton_calculates(self, trending_up_bars, rsi_config):
        result = indicator_calculator.calculate(trending_up_bars, rsi_config)
        assert "RSI" in result
        assert result["RSI"] is not None
