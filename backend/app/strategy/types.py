"""Strategy results. A candidate or a veto. Never an order."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Evaluation:
    engine: str | None
    regime: str
    score: float
    components: dict[str, float] = field(default_factory=dict)
    action: str = "veto"  # trade | watch | veto
    veto_code: str | None = None


@dataclass(frozen=True)
class VetoContext:
    stale: bool = False
    spread_bps: float = 0.0
    max_spread_bps: float = 15.0
    expected_cost: float = 0.0
    gross_target: float = 0.0
    halted: bool = False
    locked: bool = False
    account_known: bool = True
    duplicate: bool = False
    risk_capped: bool = False
