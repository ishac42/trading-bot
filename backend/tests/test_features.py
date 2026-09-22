"""Closed 5m/15m bars, stable values, and a freeze when ATR cannot be computed."""

import math
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.features.bars import closed_bars
from app.features.compute import build_features

NY = ZoneInfo("America/New_York")


def _minute_bars(count: int) -> tuple[list[dict], datetime]:
    start = datetime(2026, 1, 15, 9, 30, tzinfo=NY)
    bars = []
    for i in range(count):
        price = 100 + i * 0.02 + math.sin(i / 3) * 1.5
        bars.append({
            "timestamp": start + timedelta(minutes=i),
            "open": price,
            "high": price + 0.2,
            "low": price - 0.2,
            "close": price + 0.05,
            "volume": 1000 + i,
        })
    return bars, start + timedelta(minutes=count)


def test_closed_bars_drop_the_incomplete_bucket_and_stay_stable():
    bars, as_of = _minute_bars(300)
    five = closed_bars(bars, 5, as_of)
    fifteen = closed_bars(bars, 15, as_of)
    assert len(five) == 60
    assert len(fifteen) == 20
    assert five[0]["close"] == bars[4]["close"]

    partial = bars + [
        {
            "timestamp": as_of,
            "open": 120,
            "high": 121,
            "low": 119,
            "close": 120.5,
            "volume": 500,
        },
        {
            "timestamp": as_of + timedelta(minutes=1),
            "open": 120.5,
            "high": 121,
            "low": 120,
            "close": 120.8,
            "volume": 500,
        },
    ]
    assert len(closed_bars(partial, 5, as_of + timedelta(minutes=2))) == 60

    first = build_features(bars, as_of, spread_bps=8)
    second = build_features(bars, as_of, spread_bps=8)
    assert first.frozen is False
    assert first.atr == second.atr
    assert first.rsi == second.rsi
    assert first.adx == second.adx
    assert first.vwap > 0


def test_nan_close_freezes_the_symbol():
    bars, as_of = _minute_bars(300)
    bars[4]["close"] = float("nan")
    features = build_features(bars, as_of, spread_bps=8)
    assert features.frozen is True
    assert features.freeze_reason == "NAN_FEATURE"
