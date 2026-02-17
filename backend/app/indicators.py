"""
Indicator Calculator — computes technical indicators from OHLCV bar data.

Implements all 7 indicators configured in the frontend Bot creation form
using only pandas + numpy (no pandas-ta dependency required).

Supported indicators:
  - RSI   (Relative Strength Index)
  - MACD  (Moving Average Convergence Divergence)
  - SMA   (Simple Moving Average)
  - EMA   (Exponential Moving Average)
  - Bollinger Bands
  - Stochastic Oscillator
  - OBV   (On-Balance Volume)

Every calculator returns a plain dict of floats (JSON-serializable) so the
results can be stored directly in Trade.indicators_snapshot.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Minimum number of bars required for *any* calculation
MIN_BARS = 5


class IndicatorCalculator:
    """
    Stateless calculator — call calculate(bars, config) each cycle.

    Parameters
    ----------
    bars : list[dict]
        OHLCV bars from AlpacaClient.get_bars(). Each dict has keys:
        timestamp, open, high, low, close, volume
    config : dict
        Bot's ``indicators`` JSON, e.g.::

            {
                "RSI":  {"period": 14, "oversold": 30, "overbought": 70},
                "MACD": {"fast": 12, "slow": 26, "signal": 9},
                "SMA":  {"period": 50},
                "EMA":  {"period": 20},
                "Bollinger Bands": {"period": 20, "stdDev": 2},
                "Stochastic":     {"kPeriod": 14, "dPeriod": 3},
                "OBV":  {}
            }

    Returns
    -------
    dict[str, dict | None]
        Indicator name → computed values dict, or None if insufficient data.
    """

    # Map config key → internal method name
    _CALCULATORS: dict[str, str] = {
        "RSI": "_calc_rsi",
        "MACD": "_calc_macd",
        "SMA": "_calc_sma",
        "EMA": "_calc_ema",
        "Bollinger Bands": "_calc_bbands",
        "Stochastic": "_calc_stochastic",
        "OBV": "_calc_obv",
    }

    def calculate(
        self,
        bars: list[dict[str, Any]],
        config: dict[str, Any],
    ) -> dict[str, dict[str, Any] | None]:
        """Run every requested indicator and return a snapshot dict."""
        if not bars or len(bars) < MIN_BARS:
            logger.debug("Not enough bars (%d) for indicator calculation", len(bars) if bars else 0)
            return {name: None for name in config}

        df = self._bars_to_dataframe(bars)
        results: dict[str, dict[str, Any] | None] = {}

        for name, params in config.items():
            method_name = self._CALCULATORS.get(name)
            if not method_name:
                logger.warning("Unknown indicator '%s', skipping", name)
                results[name] = None
                continue
            try:
                method = getattr(self, method_name)
                results[name] = method(df, params or {})
            except Exception as e:
                logger.error("Error calculating %s: %s", name, e)
                results[name] = None

        return results

    # ------------------------------------------------------------------
    # DataFrame helper
    # ------------------------------------------------------------------

    @staticmethod
    def _bars_to_dataframe(bars: list[dict[str, Any]]) -> pd.DataFrame:
        """Convert list of bar dicts to a pandas DataFrame indexed by time."""
        df = pd.DataFrame(bars)
        # Ensure float types for OHLCV
        for col in ("open", "high", "low", "close", "volume"):
            if col in df.columns:
                df[col] = df[col].astype(float)
        return df

    # ------------------------------------------------------------------
    # RSI  (Relative Strength Index)
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_rsi(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        RSI = 100 - (100 / (1 + RS))
        RS  = avg_gain / avg_loss   (Wilder's smoothed)

        Returns: { value, period, oversold, overbought }
        """
        period = int(params.get("period", 14))
        if len(df) < period + 1:
            return None

        close = df["close"]
        delta = close.diff()

        gain = delta.clip(lower=0)
        loss = (-delta.clip(upper=0))

        # Wilder's smoothed averages (exponential with alpha = 1/period)
        avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()

        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))

        current = rsi.iloc[-1]
        if pd.isna(current):
            return None

        return {
            "value": round(float(current), 2),
            "period": period,
            "oversold": params.get("oversold", 30),
            "overbought": params.get("overbought", 70),
        }

    # ------------------------------------------------------------------
    # MACD (Moving Average Convergence Divergence)
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_macd(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        MACD line   = EMA(fast) - EMA(slow)
        Signal line = EMA(MACD, signal)
        Histogram   = MACD - Signal

        Returns: { macd, signal, histogram, fast, slow, signal_period }
        """
        fast = int(params.get("fast", 12))
        slow = int(params.get("slow", 26))
        signal_period = int(params.get("signal", 9))

        if len(df) < slow + signal_period:
            return None

        close = df["close"]
        ema_fast = close.ewm(span=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, adjust=False).mean()

        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal_period, adjust=False).mean()
        histogram = macd_line - signal_line

        m = macd_line.iloc[-1]
        s = signal_line.iloc[-1]
        h = histogram.iloc[-1]

        if any(pd.isna(v) for v in (m, s, h)):
            return None

        return {
            "macd": round(float(m), 4),
            "signal": round(float(s), 4),
            "histogram": round(float(h), 4),
            "fast": fast,
            "slow": slow,
            "signal_period": signal_period,
        }

    # ------------------------------------------------------------------
    # SMA  (Simple Moving Average)
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_sma(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        SMA = mean of last N closes.

        Returns: { value, period, price } (price = latest close for comparison)
        """
        period = int(params.get("period", 50))
        if len(df) < period:
            return None

        sma = df["close"].rolling(window=period).mean()
        current = sma.iloc[-1]
        price = df["close"].iloc[-1]

        if pd.isna(current):
            return None

        return {
            "value": round(float(current), 4),
            "period": period,
            "price": round(float(price), 4),
        }

    # ------------------------------------------------------------------
    # EMA  (Exponential Moving Average)
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_ema(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        EMA with configurable span.

        Returns: { value, period, price }
        """
        period = int(params.get("period", 20))
        if len(df) < period:
            return None

        ema = df["close"].ewm(span=period, adjust=False).mean()
        current = ema.iloc[-1]
        price = df["close"].iloc[-1]

        if pd.isna(current):
            return None

        return {
            "value": round(float(current), 4),
            "period": period,
            "price": round(float(price), 4),
        }

    # ------------------------------------------------------------------
    # Bollinger Bands
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_bbands(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        Middle = SMA(period)
        Upper  = Middle + stdDev * std
        Lower  = Middle - stdDev * std

        Returns: { upper, middle, lower, price, bandwidth }
        """
        period = int(params.get("period", 20))
        std_dev = float(params.get("stdDev", 2))

        if len(df) < period:
            return None

        close = df["close"]
        middle = close.rolling(window=period).mean()
        std = close.rolling(window=period).std()

        upper = middle + std_dev * std
        lower = middle - std_dev * std

        m = middle.iloc[-1]
        u = upper.iloc[-1]
        lo = lower.iloc[-1]
        price = close.iloc[-1]

        if any(pd.isna(v) for v in (m, u, lo)):
            return None

        bandwidth = round(float((u - lo) / m * 100), 2) if m != 0 else 0.0

        return {
            "upper": round(float(u), 4),
            "middle": round(float(m), 4),
            "lower": round(float(lo), 4),
            "price": round(float(price), 4),
            "bandwidth": bandwidth,
        }

    # ------------------------------------------------------------------
    # Stochastic Oscillator
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_stochastic(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        %K = (close - lowest_low) / (highest_high - lowest_low) * 100
        %D = SMA(%K, d_period)

        Returns: { k, d, k_period, d_period }
        """
        k_period = int(params.get("kPeriod", 14))
        d_period = int(params.get("dPeriod", 3))

        if len(df) < k_period + d_period:
            return None

        low_min = df["low"].rolling(window=k_period).min()
        high_max = df["high"].rolling(window=k_period).max()

        diff = high_max - low_min
        pct_k = ((df["close"] - low_min) / diff.replace(0, np.nan)) * 100
        pct_d = pct_k.rolling(window=d_period).mean()

        k = pct_k.iloc[-1]
        d = pct_d.iloc[-1]

        if any(pd.isna(v) for v in (k, d)):
            return None

        return {
            "k": round(float(k), 2),
            "d": round(float(d), 2),
            "k_period": k_period,
            "d_period": d_period,
        }

    # ------------------------------------------------------------------
    # OBV  (On-Balance Volume)
    # ------------------------------------------------------------------

    @staticmethod
    def _calc_obv(df: pd.DataFrame, params: dict[str, Any]) -> dict[str, Any] | None:
        """
        OBV: cumulative sum of volume on up-days minus volume on down-days.

        Returns: { value, change } (change = OBV change from previous bar)
        """
        if len(df) < 2:
            return None

        close = df["close"]
        volume = df["volume"]

        direction = np.sign(close.diff())
        obv = (direction * volume).cumsum()

        current = obv.iloc[-1]
        previous = obv.iloc[-2]

        if pd.isna(current):
            return None

        return {
            "value": round(float(current), 0),
            "change": round(float(current - previous), 0),
        }


# ---------------------------------------------------------------------------
# Singleton — import and reuse throughout the app
# ---------------------------------------------------------------------------

indicator_calculator = IndicatorCalculator()
