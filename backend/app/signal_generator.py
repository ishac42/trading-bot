"""
Signal Generator — evaluates indicator snapshots and produces BUY / SELL / HOLD signals.

Architecture:
  1. Each indicator has its own evaluator that returns a per-indicator signal.
  2. Signals are combined via **majority voting** — a final signal is produced
     only if the majority of active indicators agree.
  3. If there is no clear majority, the result is HOLD (no trade).

The generator is stateless and operates on a single snapshot at a time.
"""

from __future__ import annotations

import logging
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class Signal(str, Enum):
    """Trading signal produced by the signal generator."""
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class SignalGenerator:
    """
    Evaluates an indicator snapshot and produces a trading signal.

    Usage::

        sg = SignalGenerator()
        signal, details = sg.evaluate(indicator_snapshot, indicator_config)
        # signal is Signal.BUY | Signal.SELL | Signal.HOLD
        # details is a dict with per-indicator signals and vote counts
    """

    # Map indicator name → evaluator method
    _EVALUATORS: dict[str, str] = {
        "RSI": "_eval_rsi",
        "MACD": "_eval_macd",
        "SMA": "_eval_sma",
        "EMA": "_eval_ema",
        "Bollinger Bands": "_eval_bbands",
        "Stochastic": "_eval_stochastic",
        "OBV": "_eval_obv",
    }

    def evaluate(
        self,
        indicators: dict[str, dict[str, Any] | None],
        config: dict[str, Any],
    ) -> tuple[Signal, dict[str, Any]]:
        """
        Evaluate all available indicator values and produce a final signal.

        Parameters
        ----------
        indicators : dict
            Output of IndicatorCalculator.calculate() — indicator name → values dict.
        config : dict
            Bot's indicator config (same structure passed to the calculator).

        Returns
        -------
        tuple[Signal, dict]
            Final signal and details dict containing per-indicator votes.
        """
        if not indicators:
            return Signal.HOLD, {"reason": "no_indicators", "votes": {}}

        per_indicator: dict[str, str] = {}
        buy_votes = 0
        sell_votes = 0
        hold_votes = 0
        total_evaluated = 0

        for name, values in indicators.items():
            if values is None:
                # Indicator couldn't be calculated (insufficient data)
                per_indicator[name] = "insufficient_data"
                continue

            evaluator_name = self._EVALUATORS.get(name)
            if not evaluator_name:
                per_indicator[name] = "unknown_indicator"
                continue

            try:
                params = config.get(name, {}) or {}
                evaluator = getattr(self, evaluator_name)
                signal = evaluator(values, params)
                per_indicator[name] = signal.value
                total_evaluated += 1

                if signal == Signal.BUY:
                    buy_votes += 1
                elif signal == Signal.SELL:
                    sell_votes += 1
                else:
                    hold_votes += 1

            except Exception as e:
                logger.error("Error evaluating %s signal: %s", name, e)
                per_indicator[name] = "error"

        # Majority voting
        final_signal = self._majority_vote(buy_votes, sell_votes, hold_votes, total_evaluated)

        details = {
            "per_indicator": per_indicator,
            "buy_votes": buy_votes,
            "sell_votes": sell_votes,
            "hold_votes": hold_votes,
            "total_evaluated": total_evaluated,
            "final_signal": final_signal.value,
        }

        if final_signal != Signal.HOLD:
            logger.info(
                "Signal %s — buy=%d sell=%d hold=%d (of %d indicators)",
                final_signal.value, buy_votes, sell_votes, hold_votes, total_evaluated,
            )

        return final_signal, details

    def evaluate_per_indicator(
        self,
        indicators: dict[str, dict[str, Any] | None],
        config: dict[str, Any],
    ) -> dict[str, Signal]:
        """
        Evaluate each indicator independently and return a mapping of
        indicator_name -> Signal.

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
            Mapping of indicator_name -> Signal (BUY/SELL/HOLD).
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

    def evaluate_single(
        self,
        primary_indicator: str,
        indicators: dict[str, dict[str, Any] | None],
        config: dict[str, Any],
    ) -> tuple[Signal, dict[str, Any]]:
        """
        Single-indicator evaluation: only the primary indicator drives the signal.
        All other indicators are recorded in details for monitoring only.

        Parameters
        ----------
        primary_indicator : str
            Key of the primary indicator (e.g. "RSI").
        indicators : dict
            Output of IndicatorCalculator.calculate() — indicator name → values dict.
        config : dict
            Bot's indicator config (same structure passed to the calculator).

        Returns
        -------
        tuple[Signal, dict]
            Final signal and details dict containing per-indicator values and primary info.
        """
        if not indicators:
            return Signal.HOLD, {
                "reason": "no_indicators",
                "primary_indicator": primary_indicator,
            }

        # Evaluate ALL indicators for monitoring/snapshot
        per_indicator: dict[str, str] = {}
        for name, values in indicators.items():
            if values is None:
                per_indicator[name] = "insufficient_data"
                continue

            evaluator_name = self._EVALUATORS.get(name)
            if not evaluator_name:
                per_indicator[name] = "unknown_indicator"
                continue

            try:
                params = config.get(name, {}) or {}
                evaluator = getattr(self, evaluator_name)
                signal = evaluator(values, params)
                per_indicator[name] = signal.value
            except Exception as e:
                logger.error("Error evaluating %s signal: %s", name, e)
                per_indicator[name] = "error"

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
            return Signal.HOLD, {
                "per_indicator": per_indicator,
                "primary_indicator": primary_indicator,
                "primary_signal": "unknown_indicator",
                "final_signal": "hold",
            }

        try:
            params = config.get(primary_indicator, {}) or {}
            evaluator = getattr(self, evaluator_name)
            final_signal = evaluator(primary_values, params)
        except Exception as e:
            logger.error("Error evaluating primary indicator %s: %s", primary_indicator, e)
            return Signal.HOLD, {
                "per_indicator": per_indicator,
                "primary_indicator": primary_indicator,
                "primary_signal": "error",
                "final_signal": "hold",
            }

        details = {
            "per_indicator": per_indicator,
            "primary_indicator": primary_indicator,
            "primary_signal": final_signal.value,
            "final_signal": final_signal.value,
        }

        if final_signal != Signal.HOLD:
            logger.info(
                "Signal %s from primary indicator %s",
                final_signal.value, primary_indicator,
            )

        return final_signal, details

    # ------------------------------------------------------------------
    # Majority voting
    # ------------------------------------------------------------------

    @staticmethod
    def _majority_vote(
        buy: int, sell: int, hold: int, total: int
    ) -> Signal:
        """
        Simple majority voting with tie-breaking rules:
        - Need strict majority (> 50% of evaluated indicators) to produce a signal.
        - If buy == sell or no majority, result is HOLD.
        - Minimum 2 indicators must agree for a non-HOLD signal.
        """
        if total < 2:
            # Not enough indicators evaluated — default to HOLD
            return Signal.HOLD

        threshold = total / 2  # > 50%

        if buy > threshold and buy >= 2:
            return Signal.BUY
        if sell > threshold and sell >= 2:
            return Signal.SELL

        return Signal.HOLD

    # ------------------------------------------------------------------
    # Per-Indicator Evaluators
    # ------------------------------------------------------------------

    @staticmethod
    def _eval_rsi(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        RSI signal:
        - BUY  when RSI < oversold (default 30)
        - SELL when RSI > overbought (default 70)
        - HOLD otherwise
        """
        rsi = values.get("value")
        if rsi is None:
            return Signal.HOLD

        oversold = params.get("oversold", 30)
        overbought = params.get("overbought", 70)

        if rsi < oversold:
            return Signal.BUY
        if rsi > overbought:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _eval_macd(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        MACD signal:
        - BUY  when MACD line crosses above signal line (histogram > 0 and increasing)
        - SELL when MACD line crosses below signal line (histogram < 0 and decreasing)
        - HOLD otherwise

        Simplified: we only have the current snapshot, so:
        - histogram > 0 → bullish (BUY)
        - histogram < 0 → bearish (SELL)
        - ~0 → HOLD
        """
        histogram = values.get("histogram")
        if histogram is None:
            return Signal.HOLD

        # Use a small threshold to avoid noise
        threshold = 0.01

        if histogram > threshold:
            return Signal.BUY
        if histogram < -threshold:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _eval_sma(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        SMA signal:
        - BUY  when price > SMA (uptrend)
        - SELL when price < SMA (downtrend)
        """
        sma_value = values.get("value")
        price = values.get("price")
        if sma_value is None or price is None:
            return Signal.HOLD

        # Use a small buffer (0.1%) to avoid whipsawing at the crossover
        buffer = sma_value * 0.001

        if price > sma_value + buffer:
            return Signal.BUY
        if price < sma_value - buffer:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _eval_ema(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        EMA signal:
        - BUY  when price > EMA
        - SELL when price < EMA
        """
        ema_value = values.get("value")
        price = values.get("price")
        if ema_value is None or price is None:
            return Signal.HOLD

        buffer = ema_value * 0.001

        if price > ema_value + buffer:
            return Signal.BUY
        if price < ema_value - buffer:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _eval_bbands(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        Bollinger Bands signal (mean-reversion):
        - BUY  when price <= lower band (oversold / bounce expected)
        - SELL when price >= upper band (overbought / pullback expected)
        - HOLD when price is between bands
        """
        price = values.get("price")
        upper = values.get("upper")
        lower = values.get("lower")
        if any(v is None for v in (price, upper, lower)):
            return Signal.HOLD

        if price <= lower:
            return Signal.BUY
        if price >= upper:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _eval_stochastic(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        Stochastic signal:
        - BUY  when %K < 20 (%D confirms)
        - SELL when %K > 80 (%D confirms)
        - HOLD otherwise
        """
        k = values.get("k")
        d = values.get("d")
        if k is None or d is None:
            return Signal.HOLD

        # Both %K and %D must agree on the extreme zone
        if k < 20 and d < 20:
            return Signal.BUY
        if k > 80 and d > 80:
            return Signal.SELL
        return Signal.HOLD

    @staticmethod
    def _eval_obv(values: dict[str, Any], params: dict[str, Any]) -> Signal:
        """
        OBV signal:
        - BUY  when OBV is increasing (positive change)
        - SELL when OBV is decreasing (negative change)
        - HOLD when flat
        """
        change = values.get("change")
        if change is None:
            return Signal.HOLD

        if change > 0:
            return Signal.BUY
        if change < 0:
            return Signal.SELL
        return Signal.HOLD


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

signal_generator = SignalGenerator()
