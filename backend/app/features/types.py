"""Closed-bar feature snapshot. Frozen means the symbol is not tradable."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Features:
    frozen: bool = False
    freeze_reason: str | None = None
    close: float = 0.0
    ema9: float = 0.0
    ema21: float = 0.0
    ema50: float = 0.0
    sma50: float = 0.0
    rsi: float = 0.0
    atr: float = 0.0
    adx: float = 0.0
    vwap: float = 0.0
    premarket_vwap: float = 0.0
    obv_change: float = 0.0
    volume_ratio: float = 0.0
    spread_bps: float = 0.0
    bb_bandwidth: float = 0.0
    bb_bandwidth_prev: float = 0.0
    close_outside_band: bool = False
    macd_hist: float = 0.0
    reclaiming: bool = False
