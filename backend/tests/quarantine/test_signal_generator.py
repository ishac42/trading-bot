"""
Unit tests for app.signal_generator — SignalGenerator.

Tests all 7 per-indicator evaluators, majority voting, single-indicator mode,
per-indicator mode, and edge cases.

Run:
    pytest tests/test_signal_generator.py -v
"""

from __future__ import annotations

import pytest

from app.signal_generator import Signal, SignalGenerator, signal_generator


# ---------------------------------------------------------------------------
# Per-Indicator Evaluator Tests
# ---------------------------------------------------------------------------

class TestEvalRSI:
    """Tests for RSI signal evaluation."""

    def test_buy_when_oversold(self):
        values = {"value": 25, "period": 14, "oversold": 30, "overbought": 70}
        params = {"oversold": 30, "overbought": 70}
        assert signal_generator._eval_rsi(values, params) == Signal.BUY

    def test_sell_when_overbought(self):
        values = {"value": 75, "period": 14, "oversold": 30, "overbought": 70}
        params = {"oversold": 30, "overbought": 70}
        assert signal_generator._eval_rsi(values, params) == Signal.SELL

    def test_hold_when_neutral(self):
        values = {"value": 50, "period": 14, "oversold": 30, "overbought": 70}
        params = {"oversold": 30, "overbought": 70}
        assert signal_generator._eval_rsi(values, params) == Signal.HOLD

    def test_hold_when_value_is_none(self):
        values = {"value": None}
        assert signal_generator._eval_rsi(values, {}) == Signal.HOLD

    def test_buy_at_boundary(self):
        """RSI exactly at oversold threshold — below, so BUY."""
        values = {"value": 29.9}
        params = {"oversold": 30, "overbought": 70}
        assert signal_generator._eval_rsi(values, params) == Signal.BUY

    def test_sell_at_boundary(self):
        """RSI exactly above overbought threshold — SELL."""
        values = {"value": 70.1}
        params = {"oversold": 30, "overbought": 70}
        assert signal_generator._eval_rsi(values, params) == Signal.SELL

    def test_custom_thresholds(self):
        values = {"value": 15}
        params = {"oversold": 20, "overbought": 80}
        assert signal_generator._eval_rsi(values, params) == Signal.BUY


class TestEvalMACD:
    """Tests for MACD crossover signal evaluation."""

    def test_buy_on_bullish_crossover(self):
        values = {"macd": 1.5, "signal": 1.0, "histogram": 0.5, "prev_histogram": -0.1}
        assert signal_generator._eval_macd(values, {}) == Signal.BUY

    def test_hold_when_histogram_stays_positive(self):
        values = {"macd": 1.5, "signal": 1.0, "histogram": 0.5, "prev_histogram": 0.3}
        assert signal_generator._eval_macd(values, {}) == Signal.HOLD

    def test_sell_on_bearish_crossover(self):
        values = {"macd": 1.0, "signal": 1.5, "histogram": -0.5, "prev_histogram": 0.1}
        assert signal_generator._eval_macd(values, {}) == Signal.SELL

    def test_hold_when_histogram_stays_negative(self):
        values = {"macd": 1.0, "signal": 1.5, "histogram": -0.5, "prev_histogram": -0.3}
        assert signal_generator._eval_macd(values, {}) == Signal.HOLD

    def test_hold_on_near_zero_histogram(self):
        values = {"macd": 1.0, "signal": 1.0, "histogram": 0.005, "prev_histogram": -0.1}
        assert signal_generator._eval_macd(values, {}) == Signal.HOLD

    def test_hold_when_histogram_is_none(self):
        values = {"histogram": None, "prev_histogram": -0.1}
        assert signal_generator._eval_macd(values, {}) == Signal.HOLD

    def test_hold_when_prev_histogram_is_none(self):
        values = {"histogram": 0.5, "prev_histogram": None}
        assert signal_generator._eval_macd(values, {}) == Signal.HOLD

    def test_buy_crossover_from_exactly_zero(self):
        values = {"macd": 1.5, "signal": 1.0, "histogram": 0.5, "prev_histogram": 0.0}
        assert signal_generator._eval_macd(values, {}) == Signal.BUY

    def test_sell_crossover_from_exactly_zero(self):
        values = {"macd": 1.0, "signal": 1.5, "histogram": -0.5, "prev_histogram": 0.0}
        assert signal_generator._eval_macd(values, {}) == Signal.SELL


class TestEvalSMA:
    """Tests for SMA signal evaluation."""

    def test_buy_when_price_above_sma(self):
        values = {"value": 100.0, "price": 102.0}
        assert signal_generator._eval_sma(values, {}) == Signal.BUY

    def test_sell_when_price_below_sma(self):
        values = {"value": 100.0, "price": 98.0}
        assert signal_generator._eval_sma(values, {}) == Signal.SELL

    def test_hold_when_price_near_sma(self):
        """When price is within 0.1% buffer of SMA."""
        values = {"value": 100.0, "price": 100.05}
        assert signal_generator._eval_sma(values, {}) == Signal.HOLD

    def test_hold_when_value_none(self):
        values = {"value": None, "price": 100.0}
        assert signal_generator._eval_sma(values, {}) == Signal.HOLD


class TestEvalEMA:
    """Tests for EMA signal evaluation."""

    def test_buy_when_price_above_ema(self):
        values = {"value": 100.0, "price": 102.0}
        assert signal_generator._eval_ema(values, {}) == Signal.BUY

    def test_sell_when_price_below_ema(self):
        values = {"value": 100.0, "price": 98.0}
        assert signal_generator._eval_ema(values, {}) == Signal.SELL

    def test_hold_when_price_near_ema(self):
        values = {"value": 100.0, "price": 100.05}
        assert signal_generator._eval_ema(values, {}) == Signal.HOLD


class TestEvalBBands:
    """Tests for Bollinger Bands signal evaluation."""

    def test_buy_at_lower_band(self):
        values = {"upper": 110.0, "middle": 100.0, "lower": 90.0, "price": 89.0}
        assert signal_generator._eval_bbands(values, {}) == Signal.BUY

    def test_sell_at_upper_band(self):
        values = {"upper": 110.0, "middle": 100.0, "lower": 90.0, "price": 111.0}
        assert signal_generator._eval_bbands(values, {}) == Signal.SELL

    def test_hold_between_bands(self):
        values = {"upper": 110.0, "middle": 100.0, "lower": 90.0, "price": 100.0}
        assert signal_generator._eval_bbands(values, {}) == Signal.HOLD

    def test_buy_exactly_at_lower(self):
        values = {"upper": 110.0, "middle": 100.0, "lower": 90.0, "price": 90.0}
        assert signal_generator._eval_bbands(values, {}) == Signal.BUY

    def test_sell_exactly_at_upper(self):
        values = {"upper": 110.0, "middle": 100.0, "lower": 90.0, "price": 110.0}
        assert signal_generator._eval_bbands(values, {}) == Signal.SELL

    def test_hold_when_values_none(self):
        values = {"upper": None, "middle": 100.0, "lower": 90.0, "price": 89.0}
        assert signal_generator._eval_bbands(values, {}) == Signal.HOLD


class TestEvalStochastic:
    """Tests for Stochastic Oscillator signal evaluation."""

    def test_buy_when_both_low(self):
        values = {"k": 15, "d": 18}
        assert signal_generator._eval_stochastic(values, {}) == Signal.BUY

    def test_sell_when_both_high(self):
        values = {"k": 85, "d": 82}
        assert signal_generator._eval_stochastic(values, {}) == Signal.SELL

    def test_hold_when_k_low_but_d_not(self):
        """Only BUY when both %K and %D agree on the extreme zone."""
        values = {"k": 15, "d": 25}
        assert signal_generator._eval_stochastic(values, {}) == Signal.HOLD

    def test_hold_when_neutral(self):
        values = {"k": 50, "d": 50}
        assert signal_generator._eval_stochastic(values, {}) == Signal.HOLD

    def test_hold_when_k_none(self):
        values = {"k": None, "d": 50}
        assert signal_generator._eval_stochastic(values, {}) == Signal.HOLD


class TestEvalOBV:
    """Tests for OBV signal evaluation."""

    def test_buy_on_positive_change(self):
        values = {"value": 50000, "change": 1000}
        assert signal_generator._eval_obv(values, {}) == Signal.BUY

    def test_sell_on_negative_change(self):
        values = {"value": 50000, "change": -1000}
        assert signal_generator._eval_obv(values, {}) == Signal.SELL

    def test_hold_on_zero_change(self):
        values = {"value": 50000, "change": 0}
        assert signal_generator._eval_obv(values, {}) == Signal.HOLD

    def test_hold_when_change_none(self):
        values = {"value": 50000, "change": None}
        assert signal_generator._eval_obv(values, {}) == Signal.HOLD


# ---------------------------------------------------------------------------
# Majority Voting Tests
# ---------------------------------------------------------------------------

class TestMajorityVote:
    """Tests for the majority voting logic."""

    def test_buy_majority(self):
        """More than 50% buy votes → BUY."""
        assert SignalGenerator._majority_vote(3, 1, 0, 4) == Signal.BUY

    def test_sell_majority(self):
        """More than 50% sell votes → SELL."""
        assert SignalGenerator._majority_vote(1, 3, 0, 4) == Signal.SELL

    def test_hold_on_tie(self):
        """Equal buy and sell → HOLD."""
        assert SignalGenerator._majority_vote(2, 2, 0, 4) == Signal.HOLD

    def test_hold_when_not_enough_indicators(self):
        """Less than 2 indicators evaluated → HOLD."""
        assert SignalGenerator._majority_vote(1, 0, 0, 1) == Signal.HOLD

    def test_hold_when_no_majority(self):
        """No side has > 50% → HOLD."""
        assert SignalGenerator._majority_vote(1, 1, 1, 3) == Signal.HOLD

    def test_buy_needs_at_least_two_votes(self):
        """Even with 1 BUY out of 1 total (100%), need ≥2 agreeing."""
        assert SignalGenerator._majority_vote(1, 0, 0, 1) == Signal.HOLD

    def test_buy_with_exactly_two(self):
        """2 out of 3 → majority and ≥2 agree → BUY."""
        assert SignalGenerator._majority_vote(2, 1, 0, 3) == Signal.BUY

    def test_sell_with_exactly_two(self):
        """2 out of 3 → majority and ≥2 agree → SELL."""
        assert SignalGenerator._majority_vote(0, 2, 1, 3) == Signal.SELL

    def test_zero_total(self):
        """Zero total evaluated → HOLD."""
        assert SignalGenerator._majority_vote(0, 0, 0, 0) == Signal.HOLD


# ---------------------------------------------------------------------------
# evaluate() — Full Majority Voting Pipeline
# ---------------------------------------------------------------------------

class TestEvaluate:
    """Tests for the full evaluate() method (majority voting)."""

    def test_returns_hold_with_no_indicators(self):
        signal, details = signal_generator.evaluate({}, {})
        assert signal == Signal.HOLD
        assert details["reason"] == "no_indicators"

    def test_returns_hold_with_all_none_values(self):
        indicators = {"RSI": None, "MACD": None}
        config = {"RSI": {}, "MACD": {}}
        signal, details = signal_generator.evaluate(indicators, config)
        assert signal == Signal.HOLD

    def test_buy_signal_with_majority(self):
        """Three indicators say BUY, one says SELL → overall BUY."""
        indicators = {
            "RSI": {"value": 25},
            "SMA": {"value": 100.0, "price": 105.0},
            "EMA": {"value": 100.0, "price": 105.0},
            "Bollinger Bands": {"upper": 110, "middle": 100, "lower": 90, "price": 100},
        }
        config = {
            "RSI": {"oversold": 30, "overbought": 70},
            "SMA": {"period": 20},
            "EMA": {"period": 20},
            "Bollinger Bands": {"period": 20, "stdDev": 2},
        }
        signal, details = signal_generator.evaluate(indicators, config)
        assert signal == Signal.BUY
        assert details["buy_votes"] >= 3

    def test_sell_signal_with_majority(self):
        """Three indicators say SELL → overall SELL."""
        indicators = {
            "RSI": {"value": 80},
            "SMA": {"value": 100.0, "price": 95.0},
            "EMA": {"value": 100.0, "price": 95.0},
        }
        config = {
            "RSI": {"oversold": 30, "overbought": 70},
            "SMA": {"period": 20},
            "EMA": {"period": 20},
        }
        signal, details = signal_generator.evaluate(indicators, config)
        assert signal == Signal.SELL
        assert details["sell_votes"] >= 2

    def test_details_contains_all_fields(self):
        indicators = {"RSI": {"value": 25}}
        config = {"RSI": {"oversold": 30, "overbought": 70}}
        signal, details = signal_generator.evaluate(indicators, config)
        assert "per_indicator" in details
        assert "buy_votes" in details
        assert "sell_votes" in details
        assert "hold_votes" in details
        assert "total_evaluated" in details
        assert "final_signal" in details


# ---------------------------------------------------------------------------
# evaluate_single() — Single Indicator Mode
# ---------------------------------------------------------------------------

class TestEvaluateSingle:
    """Tests for evaluate_single() (Option A: single primary indicator)."""

    def test_uses_only_primary_indicator(self):
        """Primary says BUY, others say SELL → final should be BUY."""
        indicators = {
            "RSI": {"value": 25},  # BUY
            "SMA": {"value": 100.0, "price": 95.0},  # SELL
            "EMA": {"value": 100.0, "price": 95.0},  # SELL
        }
        config = {
            "RSI": {"oversold": 30, "overbought": 70},
            "SMA": {"period": 20},
            "EMA": {"period": 20},
        }
        signal, details = signal_generator.evaluate_single("RSI", indicators, config)
        assert signal == Signal.BUY
        assert details["primary_indicator"] == "RSI"
        assert details["primary_signal"] == "buy"

    def test_hold_when_primary_has_no_data(self):
        indicators = {"RSI": None, "SMA": {"value": 100.0, "price": 95.0}}
        config = {"RSI": {"oversold": 30}, "SMA": {"period": 20}}
        signal, details = signal_generator.evaluate_single("RSI", indicators, config)
        assert signal == Signal.HOLD
        assert details["primary_signal"] == "insufficient_data"

    def test_hold_when_no_indicators(self):
        signal, details = signal_generator.evaluate_single("RSI", {}, {})
        assert signal == Signal.HOLD

    def test_hold_when_primary_not_in_indicators(self):
        indicators = {"SMA": {"value": 100.0, "price": 95.0}}
        config = {"SMA": {"period": 20}}
        signal, details = signal_generator.evaluate_single("RSI", indicators, config)
        assert signal == Signal.HOLD

    def test_all_indicators_in_per_indicator(self):
        """All indicators should still be evaluated for monitoring."""
        indicators = {
            "RSI": {"value": 25},
            "SMA": {"value": 100.0, "price": 105.0},
        }
        config = {"RSI": {"oversold": 30, "overbought": 70}, "SMA": {"period": 20}}
        _, details = signal_generator.evaluate_single("RSI", indicators, config)
        assert "RSI" in details["per_indicator"]
        assert "SMA" in details["per_indicator"]


# ---------------------------------------------------------------------------
# evaluate_per_indicator() — Per-Indicator Mode
# ---------------------------------------------------------------------------

class TestEvaluatePerIndicator:
    """Tests for evaluate_per_indicator() (entry-indicator tracking)."""

    def test_returns_signal_for_each_indicator(self):
        indicators = {
            "RSI": {"value": 25},
            "MACD": {"macd": 1.5, "signal": 1.0, "histogram": 0.5, "prev_histogram": -0.1},
        }
        config = {
            "RSI": {"oversold": 30, "overbought": 70},
            "MACD": {"fast": 12, "slow": 26, "signal": 9},
        }
        results = signal_generator.evaluate_per_indicator(indicators, config)
        assert results["RSI"] == Signal.BUY
        assert results["MACD"] == Signal.BUY

    def test_skips_none_indicators(self):
        indicators = {"RSI": None, "MACD": {"histogram": 0.5, "prev_histogram": -0.1}}
        config = {"RSI": {}, "MACD": {}}
        results = signal_generator.evaluate_per_indicator(indicators, config)
        assert "RSI" not in results
        assert results["MACD"] == Signal.BUY

    def test_empty_indicators_returns_empty(self):
        results = signal_generator.evaluate_per_indicator({}, {})
        assert results == {}

    def test_mixed_signals(self):
        indicators = {
            "RSI": {"value": 25},  # BUY
            "SMA": {"value": 100.0, "price": 95.0},  # SELL
            "OBV": {"value": 50000, "change": 0},  # HOLD
        }
        config = {"RSI": {"oversold": 30, "overbought": 70}, "SMA": {}, "OBV": {}}
        results = signal_generator.evaluate_per_indicator(indicators, config)
        assert results["RSI"] == Signal.BUY
        assert results["SMA"] == Signal.SELL
        assert results["OBV"] == Signal.HOLD


# ---------------------------------------------------------------------------
# Signal Enum
# ---------------------------------------------------------------------------

class TestSignalEnum:
    """Tests for the Signal enum."""

    def test_signal_values(self):
        assert Signal.BUY.value == "buy"
        assert Signal.SELL.value == "sell"
        assert Signal.HOLD.value == "hold"

    def test_signal_is_string(self):
        """Signal extends str, so it should be usable as a string."""
        assert Signal.BUY == "buy"
        assert Signal.SELL == "sell"


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

class TestSingleton:

    def test_singleton_is_instance(self):
        assert isinstance(signal_generator, SignalGenerator)
