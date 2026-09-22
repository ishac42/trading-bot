"""A stale quote freezes one symbol. A feed drop emits health and does not order."""

from datetime import datetime, timedelta, timezone

from app.alpaca_client import CapabilityError, require_capability
from app.market_data.stream import TokenBucket, UniverseStream, backoff_seconds


def test_stale_quote_freezes_one_symbol_and_feed_drop_does_not_order():
    stream = UniverseStream()
    stream.resubscribe(["AAPL", "MSFT"])
    now = datetime(2026, 1, 15, 15, 0, tzinfo=timezone.utc)
    stream.on_quote("AAPL", now - timedelta(seconds=30), now)
    stream.on_quote("MSFT", now - timedelta(seconds=1), now)
    assert stream.eligible("AAPL") is False
    assert stream.eligible("MSFT") is True

    stream.drop_feed()
    assert stream.health_events[-1]["reason"] == "feed_drop"
    assert stream.eligible("MSFT") is False
    assert not hasattr(stream, "submit")


def test_gap_backoff_and_capabilities():
    stream = UniverseStream()
    stream.resubscribe(["AAPL"])
    start = datetime(2026, 1, 15, 15, 0, tzinfo=timezone.utc)
    stream.note_bar("AAPL", start)
    stream.note_bar("AAPL", start + timedelta(minutes=5))
    assert stream.eligible("AAPL") is False

    assert backoff_seconds(0, jitter=0) == 1
    assert backoff_seconds(3, jitter=0.25) == 8.25
    assert backoff_seconds(10, jitter=0) == 30

    bucket = TokenBucket(rate_per_second=1, capacity=1)
    assert bucket.allow(start) is True
    assert bucket.allow(start) is False
    assert bucket.allow(start + timedelta(seconds=1)) is True

    require_capability("equity_long")
    try:
        require_capability("equity_short")
        raised = False
    except CapabilityError:
        raised = True
    assert raised
    try:
        require_capability("crypto")
        raised = False
    except CapabilityError:
        raised = True
    assert raised
