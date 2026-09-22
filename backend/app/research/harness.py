"""
One research attempt. Failures are results, not discarded runs.

This is not a parameter grid and it does not promote a live strategy version.
"""

from __future__ import annotations

from typing import Any

from app.research.clock import research_windows
from app.research.gates import (
    FORBIDDEN_SOURCES,
    HISTORICAL_GATES,
    accept_metrics,
    can_attempt,
)
from app.research.simulate import simulate
from app.strategy.version import params_hash

DEFAULT_PARAMS = {
    "ema": [9, 21, 50],
    "rsi_period": 14,
    "adx_trend": 23,
    "adx_range": 18,
    "min_score": 70,
    "cost_multiple": 3,
    "hard_daily_lock_pct": -2,
}


def run_trial(
    bars: list[dict[str, Any]],
    *,
    gate: str,
    params: dict[str, Any] | None = None,
    data_source: str = "historical_bars",
    passed_gates: list[str] | None = None,
    approved_hash: str | None = None,
    stress: float = 2.0,
) -> dict[str, Any]:
    params = dict(DEFAULT_PARAMS if params is None else params)
    digest = params_hash(params)
    passed = list(passed_gates or [])
    base = {
        "params": params,
        "params_hash": digest,
        "gate": gate,
        "data_source": data_source,
        "status": "failed",
        "failure_reason": None,
        "metrics": {},
    }
    if data_source in FORBIDDEN_SOURCES:
        base["failure_reason"] = "OLD_VOTER_FILLS"
        return base
    if not can_attempt(gate, passed):
        base["failure_reason"] = "GATE_ORDER"
        return base
    if gate not in HISTORICAL_GATES:
        base["failure_reason"] = "GATE_NOT_A_BACKTEST"
        return base
    if gate == "locked_holdout" and approved_hash and approved_hash != digest:
        base["failure_reason"] = "HOLDOUT_REFIT"
        return base

    sample = _bars_for_gate(bars, gate)
    plain = simulate(sample, stress=1.0)
    stressed = simulate(sample, stress=stress)
    decision = accept_metrics(
        plain.expectancy,
        stressed.expectancy,
        plain.trade_count,
        plain.lock_respected and stressed.lock_respected,
    )
    base["metrics"] = {
        "expectancy": plain.expectancy,
        "stressed_expectancy": stressed.expectancy,
        "trade_count": plain.trade_count,
        "lock_respected": plain.lock_respected,
        "lock_triggered": plain.lock_triggered,
        "max_drawdown_day_pct": plain.max_drawdown_day_pct,
    }
    base["status"] = "passed" if decision.passed else "failed"
    base["failure_reason"] = decision.reason
    return base


def _bars_for_gate(bars: list[dict[str, Any]], gate: str) -> list[dict[str, Any]]:
    if gate == "historical_sim" or len(bars) < 5:
        return bars
    windows = research_windows(len(bars))
    if gate == "locked_holdout":
        indexes = windows["holdout"][0]
    else:
        indexes = [index for window in windows["oos"] for index in window]
    return [bars[index] for index in indexes]
