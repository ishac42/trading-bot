"""
Limit-first execution. A repeated client id returns the first result.

Rejected orders do not create a position. An unfilled protective sell leaves
the position open.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class OrderIntent:
    client_order_id: str
    symbol: str
    side: str
    quantity: int
    limit_price: float
    intent: str
    order_type: str = "limit"


@dataclass
class FillResult:
    client_order_id: str
    status: str
    quantity: int = 0
    price: float = 0.0
    fee: float = 0.0
    slippage: float = 0.0
    shortfall: float = 0.0
    rejected: bool = False


@dataclass
class ProtectedPosition:
    symbol: str
    quantity: int
    entry_price: float
    is_open: bool = True
    stop_price: float | None = None
    protective_order_id: str | None = None
    protective_filled: bool = False
    software_stop: bool = False


class ExecutionBook:
    def __init__(self) -> None:
        self._results: dict[str, FillResult] = {}
        self.broker_calls = 0

    def submit(self, intent: OrderIntent, broker_submit) -> FillResult:
        existing = self._results.get(intent.client_order_id)
        if existing is not None:
            return existing
        self.broker_calls += 1
        result = broker_submit(intent)
        self._results[intent.client_order_id] = result
        return result


def entry_limit(bid: float, ask: float, max_slippage_bps: float, aggressive: bool) -> float:
    """Passive or marketable limit. One price, never chased past max slippage."""
    if bid <= 0 or ask <= 0:
        raise ValueError("entry limit requires a two-sided quote")
    mid = (bid + ask) / 2
    ceiling = mid * (1 + max_slippage_bps / 10_000)
    price = ask if aggressive else min(ask, bid)
    return round(min(price, ceiling), 4)


def shortfall(intended: float, fill: float, side: str) -> float:
    if side == "buy":
        return fill - intended
    return intended - fill


def protect_position(position: ProtectedPosition, atr: float) -> ProtectedPosition:
    """Software stop when the broker has no bracket. An unfilled sell stays open."""
    if position.protective_order_id and not position.protective_filled:
        position.is_open = True
        return position
    position.stop_price = round(position.entry_price - 1.2 * atr, 4)
    position.software_stop = True
    position.is_open = True
    return position


class PaperBroker:
    """Records limit submits. A reject flag leaves no position behind."""

    def __init__(self, reject: bool = False) -> None:
        self.reject = reject
        self.submits: list[OrderIntent] = []
        self.positions: list[ProtectedPosition] = field_positions()

    def submit_limit(self, intent: OrderIntent) -> FillResult:
        self.submits.append(intent)
        if intent.order_type != "limit":
            return FillResult(intent.client_order_id, "rejected", rejected=True)
        if self.reject:
            return FillResult(intent.client_order_id, "rejected", rejected=True)
        slip = 0.01
        price = intent.limit_price + (slip if intent.side == "buy" else -slip)
        self.positions.append(ProtectedPosition(
            symbol=intent.symbol,
            quantity=intent.quantity,
            entry_price=price,
        ))
        return FillResult(
            client_order_id=intent.client_order_id,
            status="filled",
            quantity=intent.quantity,
            price=price,
            fee=0.0,
            slippage=slip,
            shortfall=shortfall(intent.limit_price, price, intent.side),
        )


def field_positions() -> list[ProtectedPosition]:
    return []
