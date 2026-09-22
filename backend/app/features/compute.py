"""
Feature values from closed bars only.

RSI, EMA, MACD, Bollinger, OBV, and SMA reuse IndicatorCalculator.
ATR and ADX are Wilder smoothers. A NaN or impossible value freezes the symbol.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

from app.features.bars import closed_bars
from app.features.types import Features
from app.indicators import IndicatorCalculator
from app.session_clock import RTH, session_at

_calc = IndicatorCalculator()


def build_features(
    bars_1m: list[dict[str, Any]],
    as_of: datetime,
    spread_bps: float = 0.0,
) -> Features:
    signal_bars = closed_bars(bars_1m, 5, as_of)
    regime_bars = closed_bars(bars_1m, 15, as_of)
    if len(signal_bars) < 50 or len(regime_bars) < 20:
        return Features(frozen=True, freeze_reason="INSUFFICIENT_BARS")
    frame = _calc._bars_to_dataframe(signal_bars)
    if frame[["open", "high", "low", "close", "volume"]].isna().any().any():
        return Features(frozen=True, freeze_reason="NAN_FEATURE")
    if (frame["high"] < frame["low"]).any() or (frame["close"] <= 0).any():
        return Features(frozen=True, freeze_reason="IMPOSSIBLE_BAR")

    rsi = _calc._calc_rsi(frame, {"period": 14})
    ema9 = _calc._calc_ema(frame, {"period": 9})
    ema21 = _calc._calc_ema(frame, {"period": 21})
    ema50 = _calc._calc_ema(frame, {"period": 50})
    sma = _calc._calc_sma(frame, {"period": 50})
    macd = _calc._calc_macd(frame, {"fast": 12, "slow": 26, "signal": 9})
    bands = _calc._calc_bbands(frame, {"period": 20, "stdDev": 2})
    obv = _calc._calc_obv(frame, {})
    atr = _wilder_atr(frame, 14)
    adx = _wilder_adx(frame, 14)
    required = (rsi, ema9, ema21, ema50, sma, macd, bands, obv, atr, adx)
    if any(value is None or (isinstance(value, float) and not np.isfinite(value)) for value in required):
        return Features(frozen=True, freeze_reason="NAN_FEATURE")

    prev_bands = _previous_bandwidth(frame)
    close = float(frame["close"].iloc[-1])
    upper = float(bands["upper"])
    lower = float(bands["lower"])
    volume = frame["volume"]
    recent = float(volume.iloc[-1])
    baseline = float(volume.iloc[-21:-1].mean()) if len(volume) > 21 else float(volume.mean())
    volume_ratio = recent / baseline if baseline > 0 else 0.0
    prev_close = float(frame["close"].iloc[-2])
    prev_rsi_frame = frame.iloc[:-1]
    prev_rsi = _calc._calc_rsi(prev_rsi_frame, {"period": 14})
    reclaiming = bool(prev_rsi and close > prev_close and float(rsi["value"]) > float(prev_rsi["value"]))
    rth_vwap = _session_vwap(signal_bars, rth_only=True)
    pre_vwap = _session_vwap(signal_bars, rth_only=False)
    if atr <= 0 or not np.isfinite(atr) or not np.isfinite(adx):
        return Features(frozen=True, freeze_reason="NAN_FEATURE")

    return Features(
        close=close,
        ema9=float(ema9["value"]),
        ema21=float(ema21["value"]),
        ema50=float(ema50["value"]),
        sma50=float(sma["value"]),
        rsi=float(rsi["value"]),
        atr=float(atr),
        adx=float(adx),
        vwap=rth_vwap if rth_vwap is not None else close,
        premarket_vwap=pre_vwap if pre_vwap is not None else 0.0,
        obv_change=float(obv["change"]),
        volume_ratio=volume_ratio,
        spread_bps=float(spread_bps),
        bb_bandwidth=float(bands["bandwidth"]),
        bb_bandwidth_prev=float(prev_bands if prev_bands is not None else bands["bandwidth"]),
        close_outside_band=close > upper or close < lower,
        macd_hist=float(macd["histogram"]),
        reclaiming=reclaiming,
    )


def _wilder_atr(frame: pd.DataFrame, period: int) -> float | None:
    high = frame["high"]
    low = frame["low"]
    close = frame["close"]
    prev_close = close.shift(1)
    true_range = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    atr = true_range.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    value = atr.iloc[-1]
    if pd.isna(value):
        return None
    return float(value)


def _wilder_adx(frame: pd.DataFrame, period: int) -> float | None:
    high = frame["high"]
    low = frame["low"]
    up = high.diff()
    down = -low.diff()
    plus_dm = up.where((up > down) & (up > 0), 0.0)
    minus_dm = down.where((down > up) & (down > 0), 0.0)
    prev_close = frame["close"].shift(1)
    true_range = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    atr = true_range.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    plus_di = 100 * plus_dm.ewm(alpha=1 / period, min_periods=period, adjust=False).mean() / atr.replace(0, np.nan)
    minus_di = 100 * minus_dm.ewm(alpha=1 / period, min_periods=period, adjust=False).mean() / atr.replace(0, np.nan)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    adx = dx.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    value = adx.iloc[-1]
    if pd.isna(value):
        return None
    return float(value)


def _previous_bandwidth(frame: pd.DataFrame) -> float | None:
    if len(frame) < 21:
        return None
    bands = _calc._calc_bbands(frame.iloc[:-1], {"period": 20, "stdDev": 2})
    if not bands:
        return None
    return float(bands["bandwidth"])


def _session_vwap(bars: list[dict[str, Any]], rth_only: bool) -> float | None:
    chosen = []
    for bar in bars:
        moment = bar["timestamp"]
        in_rth = session_at(moment) == RTH
        if rth_only and not in_rth:
            continue
        if not rth_only and in_rth:
            continue
        chosen.append(bar)
    if not chosen:
        return None
    total_pv = 0.0
    total_v = 0.0
    for bar in chosen:
        typical = (float(bar["high"]) + float(bar["low"]) + float(bar["close"])) / 3
        volume = float(bar.get("volume") or 0)
        total_pv += typical * volume
        total_v += volume
    if total_v <= 0:
        return None
    return total_pv / total_v
