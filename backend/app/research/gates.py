"""
Promotion gates. A trial may not skip ahead, and a passing backtest is not a live version.

historical sim → walk-forward OOS → locked holdout → paper → shadow → min-size live → scale
"""

from __future__ import annotations

from dataclasses import dataclass

GATES = (
    "historical_sim",
    "walk_forward_oos",
    "locked_holdout",
    "paper",
    "shadow",
    "min_size_live",
    "scale",
)

HISTORICAL_GATES = frozenset({"historical_sim", "walk_forward_oos", "locked_holdout"})

FORBIDDEN_SOURCES = frozenset({
    "voter_fills",
    "bot_fills",
    "entry_indicator",
})

MIN_TRADES = 5


@dataclass(frozen=True)
class Acceptance:
    passed: bool
    reason: str | None
    expectancy: float | None
    stressed_expectancy: float | None
    trade_count: int
    lock_respected: bool


def can_attempt(gate: str, passed_gates: list[str]) -> bool:
    if gate not in GATES:
        return False
    required = GATES[: GATES.index(gate)]
    passed = set(passed_gates)
    return all(name in passed for name in required)


def next_gate(passed_gates: list[str]) -> str | None:
    passed = set(passed_gates)
    for gate in GATES:
        if gate not in passed:
            return gate
    return None


def accept_metrics(
    expectancy: float | None,
    stressed_expectancy: float | None,
    trade_count: int,
    lock_respected: bool,
    min_trades: int = MIN_TRADES,
) -> Acceptance:
    """Positive out-of-sample expectancy after costs, under stress, inside the daily lock."""
    if not lock_respected:
        return Acceptance(False, "LOCK_BYPASS", expectancy, stressed_expectancy, trade_count, False)
    if trade_count < min_trades or expectancy is None:
        return Acceptance(False, "INSUFFICIENT_SAMPLE", expectancy, stressed_expectancy, trade_count, True)
    if expectancy <= 0:
        return Acceptance(False, "EXPECTANCY", expectancy, stressed_expectancy, trade_count, True)
    if stressed_expectancy is None or stressed_expectancy <= 0:
        return Acceptance(False, "STRESSED_EXECUTION", expectancy, stressed_expectancy, trade_count, True)
    return Acceptance(True, None, expectancy, stressed_expectancy, trade_count, True)
