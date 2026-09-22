"""
Book runtime. One state machine.

BOOT → SYNC → WARMUP → READY → VALIDATE_SIGNAL → RISK_CHECK → ENTERING → OPEN
→ EXITING → COOLDOWN, plus HALTED.

HALTED allows exits and flatten. It does not allow new entries. The flatten
path does not import the strategy package.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from enum import Enum

import structlog

from app.execution.ids import book_client_order_id
from app.execution.orders import ExecutionBook, OrderIntent, PaperBroker, ProtectedPosition
from app.features.types import Features
from app.risk.engine import BookSnapshot, authorize, ladder_action
from app.session_clock import allows_new_equity_risk

logger = structlog.get_logger(__name__)


class State(str, Enum):
    BOOT = "BOOT"
    SYNC = "SYNC"
    WARMUP = "WARMUP"
    READY = "READY"
    VALIDATE_SIGNAL = "VALIDATE_SIGNAL"
    RISK_CHECK = "RISK_CHECK"
    ENTERING = "ENTERING"
    OPEN = "OPEN"
    EXITING = "EXITING"
    COOLDOWN = "COOLDOWN"
    HALTED = "HALTED"


def gates_allow_entry(
    mode: str,
    moment: datetime,
    feed: str,
    snapshot_count: int,
    extended_hours: bool = False,
    operator_enabled: bool = False,
) -> bool:
    """Paper may scan. Shadow and min-size need an explicit operator enable."""
    if mode == "paper":
        enabled = True
    elif mode in {"shadow", "min_size_live"} and operator_enabled:
        enabled = True
    else:
        enabled = False
    if not enabled or feed != "sip" or snapshot_count <= 0:
        return False
    return allows_new_equity_risk(moment, extended_hours)


class TradingRuntime:
    def __init__(self, execution: ExecutionBook | None = None, broker: PaperBroker | None = None) -> None:
        self.state = State.BOOT
        self.execution = execution or ExecutionBook()
        self.broker = broker or PaperBroker()
        self.path: list[State] = []
        self.positions: list[ProtectedPosition] = []
        self.signals: list[dict] = []
        self.flatten_count = 0
        self.now = datetime.now(timezone.utc)
        self._stop = asyncio.Event()
        self._task: asyncio.Task | None = None

    def _enter(self, state: State) -> None:
        self.state = state
        self.path.append(state)

    def sync_from_broker(self, positions: list[ProtectedPosition], working_orders: list[OrderIntent]) -> None:
        self._enter(State.SYNC)
        self.positions = list(positions)
        self._working = list(working_orders)
        self._enter(State.WARMUP)

    def mark_warm(self, bars_ready: bool) -> None:
        if self.state == State.HALTED:
            return
        if bars_ready and self.state in {State.BOOT, State.WARMUP, State.SYNC}:
            self._enter(State.READY)

    def on_signal(
        self,
        symbol: str,
        features: Features,
        book: BookSnapshot,
        bid: float,
        ask: float,
        extended_hours: bool = False,
    ) -> None:
        if self.state == State.HALTED:
            return
        if not allows_new_equity_risk(self.now, extended_hours):
            return
        if self.state not in {State.READY, State.COOLDOWN, State.OPEN}:
            self._enter(State.READY)

        self._enter(State.VALIDATE_SIGNAL)
        from app.strategy.evaluate import apply_hard_vetoes, evaluate
        from app.strategy.types import VetoContext

        evaluation = evaluate(features)
        evaluation = apply_hard_vetoes(evaluation, VetoContext(
            stale=features.frozen,
            spread_bps=features.spread_bps,
            halted=book.halted,
            locked=book.locked,
            account_known=book.equity > 0,
            duplicate=any(position.symbol == symbol for position in book.positions),
        ))
        self.signals.append({
            "symbol": symbol,
            "engine": evaluation.engine,
            "regime": evaluation.regime,
            "score": evaluation.score,
            "components": dict(evaluation.components),
            "veto_code": evaluation.veto_code,
            "action": evaluation.action,
        })
        if evaluation.action != "trade" or evaluation.veto_code:
            return

        self._enter(State.RISK_CHECK)
        decision = authorize(symbol, features.close, features.atr, book)
        if decision.lock or decision.flatten:
            self.halt_for_daily_lock()
            return
        if not decision.allowed:
            self.signals[-1]["veto_code"] = decision.reason
            return

        self._enter(State.ENTERING)
        aggressive = evaluation.engine == "breakout"
        from app.execution.orders import entry_limit

        limit_price = entry_limit(bid, ask, max_slippage_bps=8, aggressive=aggressive)
        intent = OrderIntent(
            client_order_id=book_client_order_id(symbol, "entry"),
            symbol=symbol,
            side="buy",
            quantity=decision.quantity,
            limit_price=limit_price,
            intent="entry",
        )
        result = self.execution.submit(intent, self.broker.submit_limit)
        if result.rejected:
            self._enter(State.READY)
            return
        self.positions.append(ProtectedPosition(
            symbol=symbol,
            quantity=result.quantity,
            entry_price=result.price,
            stop_price=decision.stop_price,
        ))
        self._enter(State.OPEN)

    def request_exit(self, symbol: str) -> bool:
        """Exits stay allowed from HALTED. This does not open new risk or clear a lock."""
        held = any(position.symbol == symbol for position in self.positions)
        if not held:
            return False
        self.positions = [position for position in self.positions if position.symbol != symbol]
        if self.state == State.HALTED:
            return True
        self._enter(State.EXITING)
        self._enter(State.COOLDOWN)
        self._enter(State.READY)
        return True

    def halt_for_daily_lock(self) -> None:
        """Flatten and lock. Strategy is not imported here."""
        self.flatten_count += 1
        self.positions.clear()
        self._enter(State.HALTED)

    def apply_marked_pnl(self, book: BookSnapshot) -> None:
        if ladder_action(book.marked_pnl_pct, book) == "flatten_lock":
            self.halt_for_daily_lock()

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self.state = State.BOOT
        self._stop = asyncio.Event()
        self._task = asyncio.create_task(self._run())
        logger.info("trading_runtime_started", state=self.state.value)

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("trading_runtime_stopped")

    async def _run(self) -> None:
        """Idle in BOOT until a caller advances the machine. No orders from this loop."""
        while not self._stop.is_set():
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=30)
            except TimeoutError:
                continue


trading_runtime = TradingRuntime()
