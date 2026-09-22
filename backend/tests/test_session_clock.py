"""DST-aware session clock. RTH boundaries follow America/New_York."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.session_clock import (
    OVERNIGHT,
    POSTMARKET,
    PREMARKET,
    RTH,
    allows_new_equity_risk,
    in_rolling_24h,
    session_at,
)

NY = ZoneInfo("America/New_York")


def test_rth_boundaries_match_exchange_clock_in_winter_and_summer():
    winter_open = datetime(2026, 1, 15, 9, 30, tzinfo=NY)
    summer_open = datetime(2026, 7, 15, 9, 30, tzinfo=NY)
    assert winter_open.utcoffset() == timedelta(hours=-5)
    assert summer_open.utcoffset() == timedelta(hours=-4)
    assert session_at(winter_open) == RTH
    assert session_at(summer_open) == RTH
    assert winter_open.astimezone(timezone.utc).hour == 14
    assert summer_open.astimezone(timezone.utc).hour == 13
    assert session_at(winter_open.replace(minute=29)) == PREMARKET
    assert session_at(winter_open.replace(hour=16, minute=0)) == POSTMARKET
    assert session_at(winter_open.replace(hour=20, minute=0)) == OVERNIGHT


def test_spring_forward_and_fall_back():
    before_spring = datetime(2026, 3, 8, 1, 30, tzinfo=NY)
    after_spring = datetime(2026, 3, 8, 3, 30, tzinfo=NY)
    assert before_spring.utcoffset() == timedelta(hours=-5)
    assert after_spring.utcoffset() == timedelta(hours=-4)
    spring_open = datetime(2026, 3, 8, 9, 30, tzinfo=NY)
    assert session_at(spring_open) == RTH
    assert spring_open.astimezone(timezone.utc).hour == 13

    before_fall = datetime(2026, 11, 1, 1, 30, tzinfo=NY, fold=0)
    after_fall = datetime(2026, 11, 1, 1, 30, tzinfo=NY, fold=1)
    assert before_fall.utcoffset() == timedelta(hours=-4)
    assert after_fall.utcoffset() == timedelta(hours=-5)
    fall_open = datetime(2026, 11, 1, 9, 30, tzinfo=NY)
    assert session_at(fall_open) == RTH
    assert fall_open.astimezone(timezone.utc).hour == 14


def test_extended_hours_stay_off_and_rolling_window_is_not_utc_midnight():
    premarket = datetime(2026, 1, 15, 8, 0, tzinfo=NY)
    assert allows_new_equity_risk(premarket, extended_hours=False) is False
    assert allows_new_equity_risk(premarket, extended_hours=True) is True
    assert allows_new_equity_risk(datetime(2026, 1, 15, 21, 0, tzinfo=NY), True) is False

    now = datetime(2026, 1, 15, 10, 0, tzinfo=NY)
    inside = datetime(2026, 1, 14, 11, 0, tzinfo=NY)
    outside = datetime(2026, 1, 14, 9, 0, tzinfo=NY)
    assert in_rolling_24h(inside, now) is True
    assert in_rolling_24h(outside, now) is False
