"""
Replay historical bars through the live feature, score, and risk functions.

The daily lock is the risk engine's lock. A research signal cannot enter after it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.features.compute import build_features
from app.research.clock import bar_time, is_closed_five_minute
from app.risk.engine import BookSnapshot, OpenRisk, authorize, ladder_action
from app.session_clock import to_new_york
from app.strategy.evaluate import apply_hard_vetoes, evaluate
from app.strategy.types import VetoContext


@dataclass
class SimulationReport:
    trade_pnls: list[float] = field(default_factory=list)
    lock_respected: bool = True
    lock_triggered: bool = False
    max_drawdown_day_pct: float = 0.0

    @property
    def trade_count(self) -> int:
        return len(self.trade_pnls)

    @property
    def expectancy(self) -> float | None:
        if not self.trade_pnls:
            return None
        return sum(self.trade_pnls) / len(self.trade_pnls)


def session_entry(marked_pnl_pct: float, book: BookSnapshot, wants_trade: bool) -> bool:
    """Risk decides whether a wanted signal may open. The lock refuses new risk."""
    action = ladder_action(marked_pnl_pct, book)
    if action == "flatten_lock" or book.locked or book.halted:
        return False
    return wants_trade


def simulate(
    bars: list[dict[str, Any]],
    *,
    equity: float = 5000.0,
    stress: float = 1.0,
    initial_marked_pnl_pct: float = 0.0,
    symbol: str = "AAPL",
) -> SimulationReport:
    report = SimulationReport()
    history: list[dict[str, Any]] = []
    day: date | None = None
    day_pnl = equity * (initial_marked_pnl_pct / 100.0)
    open_trade: dict[str, float] | None = None
    book = BookSnapshot(equity=equity, marked_pnl_pct=initial_marked_pnl_pct)

    for bar in bars:
        moment = bar_time(bar)
        local_day = to_new_york(moment).date()
        if day != local_day:
            day = local_day
            if initial_marked_pnl_pct == 0:
                day_pnl = 0.0
            book.locked = False
        history.append(bar)
        price = float(bar["close"])
        high = float(bar["high"])
        low = float(bar["low"])

        if open_trade is not None:
            exit_price = _exit_price(open_trade, high, low, price, stress)
            if exit_price is not None:
                pnl = (exit_price - open_trade["entry"]) * open_trade["qty"] - open_trade["cost"] * stress
                report.trade_pnls.append(pnl)
                day_pnl += pnl
                open_trade = None
                book.positions.clear()

        day_pct = (day_pnl / equity) * 100.0 if equity else 0.0
        book.marked_pnl_pct = day_pct
        report.max_drawdown_day_pct = min(report.max_drawdown_day_pct, day_pct)
        if ladder_action(day_pct, book) == "flatten_lock":
            book.locked = True
            report.lock_triggered = True
            if open_trade is not None:
                pnl = (price - open_trade["entry"]) * open_trade["qty"] - open_trade["cost"] * stress
                report.trade_pnls.append(pnl)
                open_trade = None
                book.positions.clear()
            continue

        if open_trade is not None or not is_closed_five_minute(moment):
            continue

        wants = _wants_trade(history, moment, bar, book)
        if not session_entry(day_pct, book, wants):
            if wants:
                report.lock_triggered = True
            continue
        spread_bps = float(bar.get("spread_bps") or 8)
        per_share_cost = price * (spread_bps / 10_000.0) * stress
        decision = authorize(symbol, price, max(float(bar.get("atr") or 1.0), 0.01), book, per_share_cost)
        if decision.lock or decision.flatten or not decision.allowed:
            if decision.lock or decision.flatten:
                book.locked = True
                report.lock_triggered = True
            continue
        open_trade = {
            "entry": price,
            "stop": decision.stop_price,
            "target": decision.target_price,
            "qty": float(decision.quantity),
            "cost": per_share_cost * decision.quantity * 2,
        }
        book.positions.append(OpenRisk(symbol, book.risk_per_trade_pct, price * decision.quantity))

    return report


def _wants_trade(history: list[dict[str, Any]], moment, bar: dict[str, Any], book: BookSnapshot) -> bool:
    features = build_features(history, moment, spread_bps=float(bar.get("spread_bps") or 8))
    if features.frozen:
        return False
    evaluation = evaluate(features)
    evaluation = apply_hard_vetoes(evaluation, VetoContext(
        stale=features.frozen,
        spread_bps=features.spread_bps,
        halted=book.halted,
        locked=book.locked,
        account_known=book.equity > 0,
        expected_cost=float(bar.get("expected_cost") or 0),
        gross_target=float(bar.get("gross_target") or 0),
    ))
    return evaluation.action == "trade" and evaluation.veto_code is None


def _exit_price(trade: dict[str, float], high: float, low: float, close: float, stress: float) -> float | None:
    slip = 0.01 * stress
    if low <= trade["stop"]:
        return trade["stop"] - slip
    if high >= trade["target"]:
        return trade["target"] - slip
    return None
