"""Resample 1-minute bars into closed higher-timeframe bars. No I/O."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


def _as_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        moment = value
    else:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment


def closed_bars(bars: list[dict[str, Any]], minutes: int, as_of: datetime) -> list[dict[str, Any]]:
    """Aggregate 1m bars. The bucket that contains `as_of` is still forming and is dropped."""
    if as_of.tzinfo is None:
        as_of = as_of.replace(tzinfo=timezone.utc)
    buckets: dict[datetime, list[dict[str, Any]]] = {}
    for bar in bars:
        start = _bucket_start(_as_datetime(bar["timestamp"]), minutes)
        end = start + timedelta(minutes=minutes)
        if end > as_of:
            continue
        buckets.setdefault(start, []).append(bar)
    closed: list[dict[str, Any]] = []
    for start in sorted(buckets):
        group = buckets[start]
        high = max(float(bar["high"]) for bar in group)
        low = min(float(bar["low"]) for bar in group)
        volume = sum(float(bar.get("volume") or 0) for bar in group)
        closed.append({
            "timestamp": start,
            "open": float(group[0]["open"]),
            "high": high,
            "low": low,
            "close": float(group[-1]["close"]),
            "volume": volume,
        })
    return closed


def _bucket_start(moment: datetime, minutes: int) -> datetime:
    minute = (moment.minute // minutes) * minutes
    return moment.replace(minute=minute, second=0, microsecond=0)
