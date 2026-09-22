"""
Book risk authority. Sizes from stop distance, then applies the book caps.

Strategy vetoes cannot clear a lock. Sells that reduce risk stay allowed.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class OpenRisk:
    symbol: str
    stop_risk_pct: float
    notional: float


@dataclass
class RiskDecision:
    allowed: bool
    quantity: int = 0
    reason: str | None = None
    throttle: str = "normal"
    stop_price: float = 0.0
    target_price: float = 0.0
    flatten: bool = False
    lock: bool = False


@dataclass
class BookSnapshot:
    equity: float
    marked_pnl_pct: float
    positions: list[OpenRisk] = field(default_factory=list)
    halted: bool = False
    locked: bool = False
    risk_per_trade_pct: float = 0.25
    max_open_stop_risk_pct: float = 0.75
    soft_throttle_pct: float = -1.0
    stop_new_risk_pct: float = -1.5
    hard_daily_lock_pct: float = -2.0
    max_positions: int = 3
    single_name_notional_pct: float = 25.0
    gross_exposure_multiple: float = 1.0
    cluster_cap_pct: float = 0.35
    correlations: dict[tuple[str, str], float] = field(default_factory=dict)


def ladder_action(marked_pnl_pct: float, book: BookSnapshot) -> str:
    if marked_pnl_pct <= book.hard_daily_lock_pct:
        return "flatten_lock"
    if marked_pnl_pct <= book.stop_new_risk_pct:
        return "stop_new"
    if marked_pnl_pct <= book.soft_throttle_pct:
        return "half"
    return "normal"


def authorize(
    symbol: str,
    price: float,
    atr: float,
    book: BookSnapshot,
    exit_cost_per_share: float = 0.0,
    reducing: bool = False,
) -> RiskDecision:
    """Permission and size for one candidate. A reducing sell is not a new entry."""
    action = ladder_action(book.marked_pnl_pct, book)
    if reducing:
        return RiskDecision(allowed=True, quantity=0, throttle=action)

    if book.halted or book.locked or action == "flatten_lock":
        return RiskDecision(
            allowed=False,
            reason="NO_TRADE_DAILY_LOCK" if (book.locked or action == "flatten_lock") else "NO_TRADE_HALT",
            throttle="locked",
            flatten=action == "flatten_lock",
            lock=action == "flatten_lock" or book.locked,
        )
    if action == "stop_new":
        return RiskDecision(allowed=False, reason="NO_TRADE_RISK_CAP", throttle="stop_new")
    if book.equity <= 0 or price <= 0 or atr <= 0:
        return RiskDecision(allowed=False, reason="NO_TRADE_UNKNOWN_ACCOUNT")
    if any(position.symbol == symbol for position in book.positions):
        return RiskDecision(allowed=False, reason="NO_TRADE_DUPLICATE", throttle=action)
    if len(book.positions) >= book.max_positions:
        return RiskDecision(allowed=False, reason="NO_TRADE_RISK_CAP", throttle=action)

    multiplier = 0.5 if action == "half" else 1.0
    risk_dollars = book.equity * (book.risk_per_trade_pct / 100.0) * multiplier
    stop_distance = 1.2 * atr
    per_share = stop_distance + max(exit_cost_per_share, 0.0)
    if per_share <= 0:
        return RiskDecision(allowed=False, reason="NO_TRADE_COST", throttle=action)
    quantity = int(risk_dollars // per_share)

    notional_cap = book.equity * (book.single_name_notional_pct / 100.0)
    if price > 0:
        quantity = min(quantity, int(notional_cap // price))
    gross_cap = book.equity * book.gross_exposure_multiple
    open_notional = sum(position.notional for position in book.positions)
    room = gross_cap - open_notional
    if price > 0:
        quantity = min(quantity, int(room // price))

    open_stop = sum(position.stop_risk_pct for position in book.positions)
    new_stop_pct = (quantity * per_share / book.equity) * 100.0 if book.equity else 100.0
    remaining = book.max_open_stop_risk_pct - open_stop
    if new_stop_pct > remaining and per_share > 0:
        quantity = int((remaining / 100.0) * book.equity // per_share)
        new_stop_pct = (quantity * per_share / book.equity) * 100.0 if book.equity else 100.0
    if _cluster_blocked(symbol, new_stop_pct, book):
        return RiskDecision(allowed=False, reason="NO_TRADE_RISK_CAP", throttle=action)
    if quantity < 1:
        return RiskDecision(allowed=False, reason="NO_TRADE_RISK_CAP", throttle=action)

    return RiskDecision(
        allowed=True,
        quantity=quantity,
        throttle=action,
        stop_price=round(price - stop_distance, 4),
        target_price=round(price + 1.5 * stop_distance, 4),
    )


def exit_reason(hold_minutes: float, progressed: bool, trail_hit: bool) -> str | None:
    if hold_minutes >= 240:
        return "MAX_HOLD"
    if hold_minutes >= 60 and not progressed:
        return "TIME_STOP"
    if trail_hit:
        return "TRAIL"
    return None


def _cluster_blocked(symbol: str, new_stop_pct: float, book: BookSnapshot) -> bool:
    clustered = new_stop_pct
    for position in book.positions:
        rho = book.correlations.get(tuple(sorted((symbol, position.symbol))), 0.0)
        if rho > 0.75:
            clustered += position.stop_risk_pct
    return clustered > book.cluster_cap_pct
