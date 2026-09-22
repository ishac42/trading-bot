"""Equity session clock. America/New_York, including DST. No fixed UTC offset."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")

PREMARKET = "PREMARKET"
RTH = "RTH"
POSTMARKET = "POSTMARKET"
OVERNIGHT = "OVERNIGHT"

_PREMARKET_OPEN = 4 * 60
_RTH_OPEN = 9 * 60 + 30
_RTH_CLOSE = 16 * 60
_POSTMARKET_CLOSE = 20 * 60


def to_new_york(moment: datetime) -> datetime:
    if moment.tzinfo is None:
        raise ValueError("session clock requires a timezone-aware datetime")
    return moment.astimezone(NY)


def session_at(moment: datetime) -> str:
    local = to_new_york(moment)
    minutes = local.hour * 60 + local.minute
    if _PREMARKET_OPEN <= minutes < _RTH_OPEN:
        return PREMARKET
    if _RTH_OPEN <= minutes < _RTH_CLOSE:
        return RTH
    if _RTH_CLOSE <= minutes < _POSTMARKET_CLOSE:
        return POSTMARKET
    return OVERNIGHT


def allows_new_equity_risk(moment: datetime, extended_hours: bool = False) -> bool:
    """New equity risk is RTH only. Extended hours is a separate flag and stays off."""
    session = session_at(moment)
    if session == RTH:
        return True
    if session in (PREMARKET, POSTMARKET):
        return bool(extended_hours)
    return False


def rolling_24h_start(moment: datetime) -> datetime:
    return moment.astimezone(timezone.utc) - timedelta(hours=24)


def in_rolling_24h(timestamp: datetime, moment: datetime) -> bool:
    start = rolling_24h_start(moment)
    ts = timestamp.astimezone(timezone.utc)
    now = moment.astimezone(timezone.utc)
    return start <= ts <= now
