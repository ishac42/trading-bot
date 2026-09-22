"""Risk ladder, size caps, and a lock that strategy cannot clear."""

from app.risk.engine import BookSnapshot, OpenRisk, authorize, exit_reason, ladder_action


def _book(**overrides) -> BookSnapshot:
    book = BookSnapshot(equity=5000, marked_pnl_pct=0)
    for key, value in overrides.items():
        setattr(book, key, value)
    return book


def test_loss_ladder_halves_stops_and_flattens():
    book = _book()
    assert ladder_action(-0.5, book) == "normal"
    assert ladder_action(-1.0, book) == "half"
    assert ladder_action(-1.5, book) == "stop_new"
    assert ladder_action(-2.0, book) == "flatten_lock"

    full = authorize("AAPL", 100, 1, _book())
    half = authorize("AAPL", 100, 1, _book(marked_pnl_pct=-1))
    assert full.allowed and half.allowed
    assert half.quantity == full.quantity // 2
    assert authorize("AAPL", 100, 1, _book(marked_pnl_pct=-1.5)).allowed is False

    locked = authorize("AAPL", 100, 1, _book(marked_pnl_pct=-2))
    assert locked.allowed is False
    assert locked.flatten is True
    assert locked.lock is True


def test_fourth_position_cluster_and_average_down_are_refused():
    held = [OpenRisk("MSFT", 0.1, 100), OpenRisk("NVDA", 0.1, 100), OpenRisk("AMZN", 0.1, 100)]
    fourth = authorize("AAPL", 100, 1, _book(positions=held))
    assert fourth.allowed is False
    assert fourth.reason == "NO_TRADE_RISK_CAP"

    duplicate = authorize("AAPL", 100, 1, _book(positions=[OpenRisk("AAPL", 0.1, 100)]))
    assert duplicate.reason == "NO_TRADE_DUPLICATE"

    clustered = _book(
        equity=10_000,
        positions=[OpenRisk("MSFT", 0.20, 100)],
        correlations={("AAPL", "MSFT"): 0.8},
    )
    assert authorize("AAPL", 10, 1, clustered).allowed is False
    loose = _book(
        equity=10_000,
        positions=[OpenRisk("MSFT", 0.20, 100)],
        correlations={("AAPL", "MSFT"): 0.2},
    )
    assert authorize("AAPL", 10, 1, loose).allowed is True

    reducing = authorize("AAPL", 100, 1, _book(locked=True), reducing=True)
    assert reducing.allowed is True


def test_time_stop_and_max_hold():
    assert exit_reason(30, False, False) is None
    assert exit_reason(60, False, False) == "TIME_STOP"
    assert exit_reason(60, True, False) is None
    assert exit_reason(90, True, True) == "TRAIL"
    assert exit_reason(240, True, False) == "MAX_HOLD"
