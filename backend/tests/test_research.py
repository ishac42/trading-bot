"""Research harness: gate order, acceptance, and stored failures."""

from __future__ import annotations

import ast
from datetime import datetime, timezone
from pathlib import Path

from app.research.clock import research_windows
from app.research.gates import accept_metrics, can_attempt, next_gate
from app.research.harness import run_trial
from app.research.simulate import session_entry, simulate
from app.risk.engine import BookSnapshot
from app.strategy.version import params_hash


def test_gates_cannot_be_skipped():
    assert can_attempt("historical_sim", []) is True
    assert can_attempt("walk_forward_oos", []) is False
    assert can_attempt("locked_holdout", ["historical_sim"]) is False
    assert can_attempt("scale", ["historical_sim", "walk_forward_oos"]) is False
    passed = [
        "historical_sim",
        "walk_forward_oos",
        "locked_holdout",
        "paper",
        "shadow",
        "min_size_live",
    ]
    assert can_attempt("scale", passed) is True
    assert next_gate(["historical_sim"]) == "walk_forward_oos"
    assert next_gate(passed + ["scale"]) is None


def test_acceptance_requires_costs_stress_and_the_daily_lock():
    passed = accept_metrics(1.2, 0.4, 8, True)
    assert passed.passed is True
    assert passed.reason is None

    assert accept_metrics(1.2, -0.1, 8, True).reason == "STRESSED_EXECUTION"
    assert accept_metrics(-0.2, 0.1, 8, True).reason == "EXPECTANCY"
    assert accept_metrics(1.2, 0.4, 2, True).reason == "INSUFFICIENT_SAMPLE"
    assert accept_metrics(1.2, 0.4, 8, False).reason == "LOCK_BYPASS"


def test_holdout_is_outside_the_walk_forward_windows():
    windows = research_windows(100)
    holdout = set(windows["holdout"][0])
    oos = {index for window in windows["oos"] for index in window}
    insample = {index for window in windows["insample"] for index in window}
    assert holdout
    assert oos
    assert holdout.isdisjoint(oos)
    assert holdout.isdisjoint(insample)
    assert min(holdout) > max(oos)


def test_daily_lock_refuses_a_new_entry():
    book = BookSnapshot(equity=5000, marked_pnl_pct=-2.5)
    assert session_entry(-2.5, book, True) is False
    assert session_entry(0.0, book, True) is True

    bars = [{
        "timestamp": datetime(2026, 1, 15, 14, 30, tzinfo=timezone.utc),
        "open": 100.0,
        "high": 101.0,
        "low": 99.0,
        "close": 100.0,
        "volume": 1000,
    }]
    report = simulate(bars, initial_marked_pnl_pct=-2.5)
    assert report.trade_count == 0
    assert report.lock_triggered is True
    assert report.lock_respected is True


def test_old_voter_fills_are_stored_as_a_failed_trial():
    outcome = run_trial([], gate="historical_sim", data_source="voter_fills")
    assert outcome["status"] == "failed"
    assert outcome["failure_reason"] == "OLD_VOTER_FILLS"
    assert outcome["params_hash"] == params_hash(outcome["params"])


def test_a_short_history_fails_and_is_still_a_result():
    bars = [{
        "timestamp": "2026-01-15T14:30:00+00:00",
        "open": 100,
        "high": 101,
        "low": 99,
        "close": 100,
        "volume": 10,
    }]
    outcome = run_trial(bars, gate="historical_sim")
    assert outcome["status"] == "failed"
    assert outcome["failure_reason"] == "INSUFFICIENT_SAMPLE"
    assert outcome["metrics"]["trade_count"] == 0


def test_holdout_refit_and_skipped_gates_fail_before_a_backtest():
    skipped = run_trial([], gate="walk_forward_oos")
    assert skipped["failure_reason"] == "GATE_ORDER"

    refit = run_trial(
        [],
        gate="locked_holdout",
        passed_gates=["historical_sim", "walk_forward_oos"],
        approved_hash="not-the-hash",
    )
    assert refit["failure_reason"] == "HOLDOUT_REFIT"

    paper = run_trial(
        [],
        gate="paper",
        passed_gates=["historical_sim", "walk_forward_oos", "locked_holdout"],
    )
    assert paper["status"] == "failed"
    assert paper["failure_reason"] == "GATE_NOT_A_BACKTEST"


def test_research_package_does_not_touch_the_live_book():
    root = Path(__file__).resolve().parents[1] / "app" / "research"
    banned = ("alpaca", "signal_generator", "trading_engine", "trading_runtime", "promote_live")
    for path in root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                assert not any(name in node.module for name in banned), path
            if isinstance(node, ast.Import):
                for alias in node.names:
                    assert not any(name in alias.name for name in banned), path


async def test_trial_api_stores_failures_and_rejects_a_grid(client):
    failed = await client.post("/api/research/trials", json={
        "gate": "historical_sim",
        "data_source": "bot_fills",
        "bars": [],
    })
    assert failed.status_code == 201
    body = failed.json()
    assert body["status"] == "failed"
    assert body["failure_reason"] == "OLD_VOTER_FILLS"

    listed = await client.get("/api/research/trials")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == body["id"]

    grid = await client.post("/api/research/trials", json={
        "gate": "historical_sim",
        "params": [{"min_score": 70}, {"min_score": 80}],
    })
    assert grid.status_code == 422

    extra = await client.post("/api/research/trials", json={
        "gate": "historical_sim",
        "grid": {"min_score": [70, 80]},
    })
    assert extra.status_code == 422
