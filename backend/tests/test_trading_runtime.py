"""State machine: a paper entry, a veto, and a lock that does not import strategy."""

import ast
import sys
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.execution.orders import PaperBroker, ProtectedPosition
from app.features.types import Features
from app.risk.engine import BookSnapshot
from app.trading_runtime import State, TradingRuntime, gates_allow_entry

NY = ZoneInfo("America/New_York")


def _features(**overrides) -> Features:
    base = Features(
        close=100,
        ema9=99,
        ema21=98,
        ema50=97,
        rsi=60,
        atr=1,
        adx=30,
        vwap=99,
        volume_ratio=1.4,
        spread_bps=8,
        macd_hist=0.4,
        bb_bandwidth=6,
        bb_bandwidth_prev=6,
    )
    return replace(base, **overrides) if overrides else base


def _ready_runtime() -> TradingRuntime:
    runtime = TradingRuntime(broker=PaperBroker())
    runtime.now = datetime(2026, 1, 15, 10, 0, tzinfo=NY)
    runtime.sync_from_broker([], [])
    runtime.mark_warm(True)
    runtime.path.clear()
    return runtime


def test_paper_fixture_walks_to_open_and_veto_stops():
    runtime = _ready_runtime()
    assert runtime.state == State.READY
    book = BookSnapshot(equity=5000, marked_pnl_pct=0)
    runtime.on_signal("AAPL", _features(), book, bid=99.9, ask=100.05)
    assert runtime.path == [
        State.VALIDATE_SIGNAL,
        State.RISK_CHECK,
        State.ENTERING,
        State.OPEN,
    ]
    assert runtime.broker.submits[0].order_type == "limit"
    assert len(runtime.positions) == 1
    assert runtime.signals[0]["veto_code"] is None

    vetoed = _ready_runtime()
    vetoed.on_signal("AAPL", _features(adx=20), book, bid=99.9, ask=100.05)
    assert vetoed.state == State.VALIDATE_SIGNAL
    assert vetoed.broker.submits == []


def test_lock_halts_without_importing_strategy_and_exit_stays_allowed():
    sys.modules.pop("app.strategy.evaluate", None)
    runtime = _ready_runtime()
    runtime.apply_marked_pnl(BookSnapshot(equity=5000, marked_pnl_pct=-2))
    assert runtime.state == State.HALTED
    assert "app.strategy.evaluate" not in sys.modules

    runtime.on_signal("AAPL", _features(), BookSnapshot(equity=5000, marked_pnl_pct=-2), 99.9, 100.05)
    assert runtime.state == State.HALTED
    assert runtime.broker.submits == []

    runtime.positions.append(ProtectedPosition("AAPL", 1, 100))
    assert runtime.request_exit("AAPL") is True
    assert runtime.state == State.HALTED


def test_gates_and_live_modules_do_not_import_botrunner():
    moment = datetime(2026, 1, 15, 10, 0, tzinfo=NY)
    assert gates_allow_entry("paper", moment, "sip", 3) is True
    assert gates_allow_entry("paper", moment, "sip", 0) is False
    assert gates_allow_entry("shadow", moment, "sip", 3, operator_enabled=False) is False
    assert gates_allow_entry("min_size_live", moment, "sip", 3, operator_enabled=True) is True
    premarket = datetime(2026, 1, 15, 8, 0, tzinfo=NY)
    assert gates_allow_entry("paper", premarket, "sip", 3) is False

    root = Path(__file__).resolve().parents[1] / "app"
    retired = {"trading_engine.py", "signal_generator.py", "risk_manager.py"}
    for path in root.rglob("*.py"):
        if path.name in retired:
            continue
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and "trading_engine" in node.module:
                raise AssertionError(f"{path} imports {node.module}")
