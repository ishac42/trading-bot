"""
Trading Engine Core — orchestrates bot lifecycle, trading loops, and market monitoring.

Architecture:
  TradingEngine (singleton)
    ├── market_monitor_loop  — polls Alpaca clock every 60s, emits WS events
    └── bots: dict[str, BotRunner]
         └── BotRunner (one per active bot)
              └── _trading_loop  — runs every trading_frequency seconds
                   1. Check trading window (bot's start/end hours in ET)
                   2. For each symbol: fetch bars → calculate indicators →
                      generate signal → validate risk → execute trade
                   3. Update last_run_at in DB
                   4. Handle errors (increment error_count, auto-stop on threshold)

Full pipeline: indicators → signal_generator → risk_manager → Alpaca order.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any

import structlog

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import uuid as _uuid

from app.alpaca_client import get_alpaca_client, AlpacaClient
from app.database import async_session
from app.models import Bot, Trade, Position, generate_uuid, utcnow
from app.websocket_manager import ws_manager
from app.indicators import indicator_calculator
from app.signal_generator import signal_generator, Signal
from app.risk_manager import risk_manager


def generate_client_order_id(bot_id: str) -> str:
    """Generate a client_order_id that encodes the bot for traceability."""
    short_uuid = str(_uuid.uuid4())[:8]
    return f"bot-{bot_id[:8]}-{short_uuid}"

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_ERROR_COUNT = 5  # Auto-stop bot after this many consecutive errors
MARKET_MONITOR_INTERVAL = 60  # Seconds between market clock checks
ET_OFFSET = timedelta(hours=-5)  # EST offset from UTC (simplified; real ET is -5/-4)


# ---------------------------------------------------------------------------
# BotRunner — one per active bot
# ---------------------------------------------------------------------------

class BotRunner:
    """
    Manages the async trading loop for a single bot.
    Created by TradingEngine.register_bot(), destroyed by unregister_bot().
    """

    def __init__(self, bot_id: str, bot_config: dict[str, Any], engine: TradingEngine) -> None:
        self.bot_id = bot_id
        self.config = bot_config
        self.engine = engine
        self.is_running = False
        self.is_paused = False
        self._task: asyncio.Task | None = None
        self._consecutive_errors = 0

    async def start(self) -> None:
        """Launch the trading loop as a background task."""
        if self._task and not self._task.done():
            logger.warning("BotRunner %s already running, skipping start", self.bot_id)
            return
        self.is_running = True
        self.is_paused = False
        self._consecutive_errors = 0
        self._task = asyncio.create_task(self._trading_loop(), name=f"bot-{self.bot_id[:8]}")
        logger.info("BotRunner started: %s (%s)", self.config.get("name", "?"), self.bot_id[:8])

    async def stop(self) -> None:
        """Cancel the trading loop task."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("BotRunner stopped: %s (%s)", self.config.get("name", "?"), self.bot_id[:8])

    def pause(self) -> None:
        """Pause the bot — loop keeps running but skips trading."""
        self.is_paused = True
        logger.info("BotRunner paused: %s (%s)", self.config.get("name", "?"), self.bot_id[:8])

    def resume(self) -> None:
        """Resume a paused bot."""
        self.is_paused = False
        logger.info("BotRunner resumed: %s (%s)", self.config.get("name", "?"), self.bot_id[:8])

    # -------------------------------------------------------------------
    # Trading Loop
    # -------------------------------------------------------------------

    async def _trading_loop(self) -> None:
        """
        Main loop — runs every `trading_frequency` seconds.
        Fetches market data, evaluates signals, executes trades.
        """
        frequency = self.config.get("trading_frequency", 60)
        symbols = self.config.get("symbols", [])
        bot_name = self.config.get("name", "Unknown")

        logger.info(
            "Trading loop started for '%s' — frequency=%ds, symbols=%s",
            bot_name, frequency, symbols,
        )

        while self.is_running:
            try:
                # Sleep first, then trade (gives the bot time to settle after start)
                await asyncio.sleep(frequency)

                if not self.is_running:
                    break

                # Skip if paused
                if self.is_paused:
                    logger.debug("Bot '%s' is paused, skipping cycle", bot_name)
                    continue

                # Skip if outside trading window
                if not self._is_within_trading_window():
                    logger.debug("Bot '%s' outside trading window, skipping cycle", bot_name)
                    continue

                # Skip if market is closed
                if not self.engine.market_is_open:
                    logger.debug("Market closed, bot '%s' skipping cycle", bot_name)
                    continue

                # Check stop-loss / take-profit on existing positions first
                await self._check_stop_loss_take_profit()

                # Process each symbol (indicators → signal → risk → trade)
                for symbol in symbols:
                    await self._process_symbol(symbol)

                # Update last_run_at in DB
                await self._update_last_run()

                # Reset consecutive errors on successful cycle
                self._consecutive_errors = 0

            except asyncio.CancelledError:
                logger.info("Trading loop cancelled for '%s'", bot_name)
                raise
            except Exception as e:
                self._consecutive_errors += 1
                logger.error(
                    "Error in trading loop for '%s' (attempt %d/%d): %s",
                    bot_name, self._consecutive_errors, MAX_ERROR_COUNT, e,
                )
                if self._consecutive_errors >= MAX_ERROR_COUNT:
                    await self._auto_stop_on_error(str(e))
                    break

    async def _process_symbol(self, symbol: str) -> None:
        """
        Full trading pipeline for a single symbol (entry-indicator tracking mode):
          Phase 1 — SELL CHECK: If we have an open position, check only its
                    entry_indicator for a SELL signal.
          Phase 2 — BUY CHECK:  If no open position, check all indicators
                    for a BUY signal. First one wins.
        """
        client = get_alpaca_client()
        if not client:
            return

        try:
            # 1. Fetch recent bars (50 x 1-min bars gives enough history for most indicators)
            bars = await client.get_bars(symbol, timeframe="1Min", limit=50)
            if not bars:
                logger.debug("No bars returned for %s, skipping", symbol)
                return

            # 2. Calculate all indicators
            indicators_config = self.config.get("indicators", {})
            indicators_snapshot = indicator_calculator.calculate(bars, indicators_config)

            # 3. Evaluate each indicator independently
            per_indicator_signals = signal_generator.evaluate_per_indicator(
                indicators_snapshot, indicators_config
            )

            # Build snapshot for DB storage
            full_snapshot: dict[str, Any] = {
                "indicators": indicators_snapshot,
                "per_indicator_signals": {k: v.value for k, v in per_indicator_signals.items()},
            }

            # 4. Check for open position on this symbol
            open_position = await self._get_open_position(symbol)

            if open_position:
                # ---- SELL PHASE ----
                entry_ind = open_position.entry_indicator or ""

                if not entry_ind:
                    signal, signal_details = signal_generator.evaluate(
                        indicators_snapshot, indicators_config
                    )
                    if signal == Signal.SELL:
                        current_price = await client.get_latest_price(symbol)
                        if current_price > 0:
                            full_snapshot["signal_details"] = signal_details
                            await self._execute_sell(
                                symbol, current_price, full_snapshot,
                                reason="Majority vote sell signal",
                            )
                else:
                    entry_signal = per_indicator_signals.get(entry_ind, Signal.HOLD)
                    if entry_signal == Signal.SELL:
                        current_price = await client.get_latest_price(symbol)
                        if current_price > 0:
                            full_snapshot["exit_indicator"] = entry_ind
                            full_snapshot["exit_signal"] = entry_signal.value
                            await self._execute_sell(
                                symbol, current_price, full_snapshot,
                                reason=f"{entry_ind} sell signal",
                            )
                    else:
                        logger.debug(
                            "Position open for %s via %s — signal is %s, holding",
                            symbol, entry_ind, entry_signal.value,
                        )
            else:
                # ---- BUY PHASE ----
                # Find the first indicator that says BUY
                buy_indicator: str | None = None
                for ind_name, ind_signal in per_indicator_signals.items():
                    if ind_signal == Signal.BUY:
                        buy_indicator = ind_name
                        break

                if not buy_indicator:
                    return  # All indicators say HOLD or SELL — no action

                # Get current price
                current_price = await client.get_latest_price(symbol)
                if current_price <= 0:
                    return

                # Risk checks
                today_pnl = await self.engine.get_bot_today_pnl(self.bot_id)
                open_count = await self._count_open_positions()

                allowed, block_reason = await risk_manager.validate(
                    signal=Signal.BUY,
                    bot_config=self.config,
                    symbol=symbol,
                    current_price=current_price,
                    today_pnl=today_pnl,
                    open_position_count=open_count,
                )
                if not allowed:
                    logger.info("Risk blocked BUY for %s: %s", symbol, block_reason)
                    return

                # Execute buy and tag position with entry_indicator
                full_snapshot["entry_indicator"] = buy_indicator
                full_snapshot["entry_signal"] = "buy"
                await self._execute_buy(
                    symbol, current_price, full_snapshot, entry_indicator=buy_indicator
                )

        except Exception as e:
            logger.error("Error processing %s for bot %s: %s", symbol, self.bot_id[:8], e)

    async def _execute_buy(
        self,
        symbol: str,
        current_price: float,
        indicators_snapshot: dict[str, Any] | None,
        entry_indicator: str = "",
    ) -> None:
        """
        Execute a BUY: calculate size -> submit order -> record in DB -> emit WS events.
        Tags the new position with the entry_indicator that triggered the buy.
        """
        client = get_alpaca_client()
        if not client:
            return

        risk_config = self.config.get("risk_management", {})
        bot_capital = self.config.get("capital", 0)

        qty = risk_manager.calculate_position_size(bot_capital, current_price, risk_config)
        if qty <= 0:
            logger.info("Position size 0 for %s, skipping buy", symbol)
            return

        try:
            coid = generate_client_order_id(self.bot_id)

            order_result = await client.submit_market_order(
                symbol=symbol, qty=qty, side="buy", time_in_force="day",
                client_order_id=coid,
            )

            # Wait for fill with retries
            order_status = await self._wait_for_fill(order_result["id"])
            status = order_status.get("status", "pending")

            if status in ("canceled", "cancelled", "expired", "rejected"):
                logger.warning(
                    "BUY order for %s was %s, skipping position creation",
                    symbol, status,
                )
                return

            filled_price = order_status.get("filled_avg_price")
            filled_qty = int(order_status.get("filled_qty", 0)) or qty

            if not filled_price:
                logger.error(
                    "BUY order %s has no filled_avg_price (status=%s). "
                    "Skipping position creation to avoid corrupted entry price.",
                    order_result["id"][:8], status,
                )
                return

            # Calculate stop-loss and take-profit
            stop_loss = risk_manager.calculate_stop_loss(filled_price, risk_config)
            take_profit = risk_manager.calculate_take_profit(filled_price, risk_config)

            reason = f"{entry_indicator} buy signal" if entry_indicator else "Buy signal"

            async with async_session() as session:
                trade = Trade(
                    id=generate_uuid(),
                    bot_id=self.bot_id,
                    symbol=symbol,
                    type="buy",
                    quantity=filled_qty,
                    price=filled_price,
                    timestamp=utcnow(),
                    indicators_snapshot=indicators_snapshot,
                    order_id=order_result["id"],
                    status="filled" if status == "filled" else status,
                    client_order_id=coid,
                    reason=reason,
                )
                session.add(trade)

                # Create position record — tagged with entry_indicator
                position = Position(
                    id=generate_uuid(),
                    bot_id=self.bot_id,
                    symbol=symbol,
                    quantity=filled_qty,
                    entry_price=filled_price,
                    current_price=filled_price,
                    stop_loss_price=stop_loss,
                    take_profit_price=take_profit,
                    unrealized_pnl=0.0,
                    realized_pnl=0.0,
                    is_open=True,
                    entry_indicator=entry_indicator,
                )
                session.add(position)
                await session.commit()

                # Emit WebSocket events
                await ws_manager.emit_trade_executed({
                    "id": trade.id,
                    "bot_id": trade.bot_id,
                    "symbol": trade.symbol,
                    "type": trade.type,
                    "quantity": trade.quantity,
                    "price": trade.price,
                    "timestamp": trade.timestamp.isoformat(),
                    "profit_loss": trade.profit_loss,
                    "status": trade.status,
                    "order_id": trade.order_id,
                })
                await ws_manager.emit_position_updated({
                    "id": position.id,
                    "bot_id": position.bot_id,
                    "symbol": position.symbol,
                    "quantity": position.quantity,
                    "entry_price": position.entry_price,
                    "current_price": position.current_price,
                    "stop_loss_price": position.stop_loss_price,
                    "take_profit_price": position.take_profit_price,
                    "unrealized_pnl": position.unrealized_pnl,
                    "realized_pnl": position.realized_pnl,
                    "opened_at": position.opened_at.isoformat(),
                    "is_open": position.is_open,
                    "entry_indicator": position.entry_indicator,
                })

            logger.info(
                "BUY executed: %s x%d @ %.2f via %s (order=%s, bot=%s)",
                symbol, filled_qty, filled_price, entry_indicator,
                order_result["id"][:8], self.bot_id[:8],
            )

        except Exception as e:
            logger.error("Failed to execute BUY for %s: %s", symbol, e)

    async def _execute_sell(
        self,
        symbol: str,
        current_price: float,
        indicators_snapshot: dict[str, Any] | None,
        reason: str = "Sell signal",
    ) -> None:
        """Close the open position for this symbol if one exists."""
        client = get_alpaca_client()
        if not client:
            return

        async with async_session() as session:
            result = await session.execute(
                select(Position).where(
                    Position.bot_id == self.bot_id,
                    Position.symbol == symbol,
                    Position.is_open.is_(True),
                )
            )
            position = result.scalar_one_or_none()
            if not position:
                logger.debug("No open position for %s to sell, skipping", symbol)
                return

            try:
                coid = generate_client_order_id(self.bot_id)

                order_result = await client.submit_market_order(
                    symbol=symbol,
                    qty=position.quantity,
                    side="sell",
                    time_in_force="day",
                    client_order_id=coid,
                )

                order_status = await self._wait_for_fill(order_result["id"])
                sell_status = order_status.get("status", "pending")

                if sell_status in ("canceled", "cancelled", "expired", "rejected"):
                    logger.warning(
                        "SELL order for %s was %s, position remains open",
                        symbol, sell_status,
                    )
                    return

                filled_price = order_status.get("filled_avg_price")
                if not filled_price:
                    logger.error(
                        "SELL order %s has no filled_avg_price (status=%s). "
                        "Using current_price=%s as fallback for P&L calc.",
                        order_result["id"][:8], sell_status, current_price,
                    )
                    filled_price = current_price

                profit_loss = round((filled_price - position.entry_price) * position.quantity, 2)

                # Update position
                now = utcnow()
                position.is_open = False
                position.closed_at = now
                position.current_price = filled_price
                position.realized_pnl = profit_loss
                position.unrealized_pnl = 0.0

                trade = Trade(
                    id=generate_uuid(),
                    bot_id=self.bot_id,
                    symbol=symbol,
                    type="sell",
                    quantity=position.quantity,
                    price=filled_price,
                    timestamp=now,
                    indicators_snapshot=indicators_snapshot,
                    profit_loss=profit_loss,
                    order_id=order_result["id"],
                    status="filled" if order_status.get("status") == "filled" else order_status.get("status", "pending"),
                    client_order_id=coid,
                    reason=reason,
                )
                session.add(trade)
                await session.commit()

                # Refresh to get updated values
                await session.refresh(position)

                # Emit WebSocket events
                await ws_manager.emit_trade_executed({
                    "id": trade.id,
                    "bot_id": trade.bot_id,
                    "symbol": trade.symbol,
                    "type": trade.type,
                    "quantity": trade.quantity,
                    "price": trade.price,
                    "timestamp": trade.timestamp.isoformat(),
                    "profit_loss": trade.profit_loss,
                    "status": trade.status,
                    "order_id": trade.order_id,
                })
                await ws_manager.emit_position_updated({
                    "id": position.id,
                    "bot_id": position.bot_id,
                    "symbol": position.symbol,
                    "quantity": position.quantity,
                    "entry_price": position.entry_price,
                    "current_price": position.current_price,
                    "stop_loss_price": position.stop_loss_price,
                    "take_profit_price": position.take_profit_price,
                    "unrealized_pnl": position.unrealized_pnl,
                    "realized_pnl": position.realized_pnl,
                    "opened_at": position.opened_at.isoformat(),
                    "closed_at": position.closed_at.isoformat() if position.closed_at else None,
                    "is_open": position.is_open,
                    "entry_indicator": position.entry_indicator,
                })

                logger.info(
                    "SELL executed: %s x%d @ %.2f P&L=%.2f (order=%s, bot=%s)",
                    symbol, position.quantity, filled_price, profit_loss,
                    order_result["id"][:8], self.bot_id[:8],
                )

            except Exception as e:
                logger.error("Failed to execute SELL for %s: %s", symbol, e)

    async def _get_open_position(self, symbol: str) -> Position | None:
        """Fetch the open position for this bot+symbol, if any."""
        async with async_session() as session:
            result = await session.execute(
                select(Position).where(
                    Position.bot_id == self.bot_id,
                    Position.symbol == symbol,
                    Position.is_open.is_(True),
                )
            )
            return result.scalar_one_or_none()

    # -------------------------------------------------------------------
    # Stop-Loss / Take-Profit monitoring
    # -------------------------------------------------------------------

    async def _check_stop_loss_take_profit(self) -> None:
        """
        Check all open positions for this bot against their SL/TP levels.
        Auto-sell any position where current price has breached the threshold.
        """
        client = get_alpaca_client()
        if not client:
            return

        try:
            async with async_session() as session:
                result = await session.execute(
                    select(Position).where(
                        Position.bot_id == self.bot_id,
                        Position.is_open.is_(True),
                    )
                )
                positions = result.scalars().all()

            for pos in positions:
                try:
                    current_price = await client.get_latest_price(pos.symbol)
                    if current_price <= 0:
                        continue

                    trigger_sell = False
                    sell_reason = ""

                    if pos.stop_loss_price and current_price <= pos.stop_loss_price:
                        trigger_sell = True
                        sell_reason = f"Stop-loss triggered (price ≤ ${pos.stop_loss_price:.2f})"

                    if pos.take_profit_price and current_price >= pos.take_profit_price:
                        trigger_sell = True
                        sell_reason = f"Take-profit triggered (price ≥ ${pos.take_profit_price:.2f})"

                    if trigger_sell:
                        logger.info(
                            "SL/TP triggered for %s: %s (bot=%s)",
                            pos.symbol, sell_reason, self.bot_id[:8],
                        )
                        await self._execute_sell(
                            pos.symbol, current_price,
                            {
                                "trigger": sell_reason,
                                "stop_loss_price": pos.stop_loss_price,
                                "take_profit_price": pos.take_profit_price,
                            },
                            reason=sell_reason,
                        )
                    else:
                        # Update unrealized P&L
                        unrealized = round(
                            (current_price - pos.entry_price) * pos.quantity, 2
                        )
                        async with async_session() as session:
                            db_pos = await session.get(Position, pos.id)
                            if db_pos and db_pos.is_open:
                                db_pos.current_price = current_price
                                db_pos.unrealized_pnl = unrealized
                                await session.commit()

                except Exception as e:
                    logger.error(
                        "Error checking SL/TP for %s (pos=%s): %s",
                        pos.symbol, pos.id[:8], e,
                    )

        except Exception as e:
            logger.error("Error in SL/TP check for bot %s: %s", self.bot_id[:8], e)

    # -------------------------------------------------------------------
    # Helpers
    # -------------------------------------------------------------------

    def _is_within_trading_window(self) -> bool:
        """Check if current time (ET) is within the bot's configured trading window."""
        now_utc = datetime.now(timezone.utc)
        # Simplified ET conversion (EST = UTC-5; ignoring DST for now)
        now_et = now_utc + ET_OFFSET
        current_minutes = now_et.hour * 60 + now_et.minute

        start_minutes = self.config.get("start_hour", 9) * 60 + self.config.get("start_minute", 30)
        end_minutes = self.config.get("end_hour", 16) * 60 + self.config.get("end_minute", 0)

        return start_minutes <= current_minutes <= end_minutes

    async def _wait_for_fill(self, order_id: str, max_attempts: int = 10) -> dict[str, Any]:
        """
        Wait for an order to fill, retrying up to max_attempts times.
        Returns the order status dict.
        """
        client = get_alpaca_client()
        order_status: dict[str, Any] = {}
        for attempt in range(max_attempts):
            await asyncio.sleep(1)
            order_status = await client.get_order(order_id)
            if order_status.get("status") == "filled":
                return order_status
            if order_status.get("status") in ("canceled", "cancelled", "expired", "rejected"):
                logger.warning(
                    "Order %s terminal status: %s",
                    order_id[:8], order_status.get("status"),
                )
                return order_status
            logger.debug(
                "Order %s not yet filled (attempt %d/%d, status=%s)",
                order_id[:8], attempt + 1, max_attempts,
                order_status.get("status"),
            )
        logger.warning(
            "Order %s not filled after %d attempts (status=%s)",
            order_id[:8], max_attempts, order_status.get("status"),
        )
        return order_status

    async def _update_last_run(self) -> None:
        """Update the bot's last_run_at timestamp in the DB."""
        try:
            async with async_session() as session:
                bot = await session.get(Bot, self.bot_id)
                if bot:
                    bot.last_run_at = utcnow()
                    await session.commit()
        except Exception as e:
            logger.error("Failed to update last_run_at for bot %s: %s", self.bot_id[:8], e)

    async def _count_open_positions(self) -> int:
        """Count open positions for this bot."""
        try:
            async with async_session() as session:
                result = await session.execute(
                    select(Position).where(
                        Position.bot_id == self.bot_id,
                        Position.is_open.is_(True),
                    )
                )
                return len(result.scalars().all())
        except Exception:
            return 0

    async def _auto_stop_on_error(self, error_msg: str) -> None:
        """Auto-stop the bot after too many consecutive errors."""
        logger.error(
            "Bot %s exceeded max errors (%d), auto-stopping. Last error: %s",
            self.bot_id[:8], MAX_ERROR_COUNT, error_msg,
        )
        self.is_running = False
        try:
            async with async_session() as session:
                bot = await session.get(Bot, self.bot_id)
                if bot:
                    bot.status = "error"
                    bot.is_active = False
                    bot.error_count = self._consecutive_errors
                    await session.commit()

                    await ws_manager.emit_bot_status_changed({
                        "id": bot.id,
                        "status": bot.status,
                        "is_active": bot.is_active,
                        "error_count": bot.error_count,
                    })
        except Exception as e:
            logger.error("Failed to update bot status on auto-stop: %s", e)


# ---------------------------------------------------------------------------
# TradingEngine — singleton orchestrator
# ---------------------------------------------------------------------------

class TradingEngine:
    """
    Manages all active BotRunners and the market monitoring loop.

    Usage:
        engine = TradingEngine()
        await engine.start()      # starts market monitor, loads running bots
        await engine.stop()       # stops everything gracefully

        await engine.register_bot(bot_id)   # start a bot
        await engine.unregister_bot(bot_id) # stop a bot
        engine.pause_bot(bot_id)            # pause a bot
    """

    def __init__(self) -> None:
        self.bots: dict[str, BotRunner] = {}
        self.market_is_open: bool = False
        self._market_monitor_task: asyncio.Task | None = None
        self._running = False
        logger.info("TradingEngine created")

    async def start(self) -> None:
        """
        Start the engine:
        1. Launch market monitor loop
        2. Load all bots with status='running' from DB and register them
        """
        if self._running:
            logger.warning("TradingEngine already running")
            return

        self._running = True

        # Check initial market status
        await self._update_market_status()

        # Start market monitor
        self._market_monitor_task = asyncio.create_task(
            self._market_monitor_loop(), name="market-monitor"
        )

        # Load and register running bots
        await self._load_running_bots()

        logger.info(
            "TradingEngine started (market_open=%s, bots=%d)",
            self.market_is_open, len(self.bots),
        )

    async def stop(self) -> None:
        """Stop the engine: cancel market monitor and all bot runners."""
        self._running = False

        # Stop all bots
        for bot_id in list(self.bots.keys()):
            await self.unregister_bot(bot_id)

        # Cancel market monitor
        if self._market_monitor_task and not self._market_monitor_task.done():
            self._market_monitor_task.cancel()
            try:
                await self._market_monitor_task
            except asyncio.CancelledError:
                pass
        self._market_monitor_task = None

        logger.info("TradingEngine stopped")

    # -------------------------------------------------------------------
    # Bot Management
    # -------------------------------------------------------------------

    async def register_bot(self, bot_id: str) -> None:
        """
        Load a bot's config from DB and start its BotRunner.
        Called when user clicks "Start Bot" in the UI.
        """
        if bot_id in self.bots:
            logger.warning("Bot %s already registered, skipping", bot_id[:8])
            return

        try:
            async with async_session() as session:
                bot = await session.get(Bot, bot_id)
                if not bot:
                    logger.error("Bot %s not found in DB", bot_id[:8])
                    return

                config = {
                    "name": bot.name,
                    "capital": bot.capital,
                    "trading_frequency": bot.trading_frequency,
                    "symbols": bot.symbols or [],
                    "indicators": bot.indicators or {},
                    "risk_management": bot.risk_management or {},
                    "start_hour": bot.start_hour,
                    "start_minute": bot.start_minute,
                    "end_hour": bot.end_hour,
                    "end_minute": bot.end_minute,
                }

            runner = BotRunner(bot_id, config, self)
            self.bots[bot_id] = runner
            await runner.start()

            logger.info(
                "Registered bot '%s' (%s) with %d symbols",
                config["name"], bot_id[:8], len(config["symbols"]),
            )

        except Exception as e:
            logger.error("Failed to register bot %s: %s", bot_id[:8], e)

    async def unregister_bot(self, bot_id: str) -> None:
        """Stop and remove a BotRunner."""
        runner = self.bots.pop(bot_id, None)
        if runner:
            await runner.stop()
            logger.info("Unregistered bot %s", bot_id[:8])
        else:
            logger.debug("Bot %s not in active bots, nothing to unregister", bot_id[:8])

    def pause_bot(self, bot_id: str) -> None:
        """Pause a running bot (loop continues but skips trading)."""
        runner = self.bots.get(bot_id)
        if runner:
            runner.pause()
        else:
            logger.warning("Bot %s not found in active bots for pause", bot_id[:8])

    def resume_bot(self, bot_id: str) -> None:
        """Resume a paused bot."""
        runner = self.bots.get(bot_id)
        if runner:
            runner.resume()
        else:
            logger.warning("Bot %s not found in active bots for resume", bot_id[:8])

    # -------------------------------------------------------------------
    # Market Monitor
    # -------------------------------------------------------------------

    async def _market_monitor_loop(self) -> None:
        """
        Poll Alpaca clock every 60s.
        Emit WS events on market open/close transitions.
        """
        logger.info("Market monitor loop started")
        previous_is_open = self.market_is_open

        while self._running:
            try:
                await asyncio.sleep(MARKET_MONITOR_INTERVAL)

                if not self._running:
                    break

                await self._update_market_status()

                # Detect transition
                if self.market_is_open != previous_is_open:
                    if self.market_is_open:
                        logger.info("🔔 Market OPENED")
                    else:
                        logger.info("🔔 Market CLOSED")

                    await ws_manager.emit_market_status_changed({
                        "is_open": self.market_is_open,
                    })
                    previous_is_open = self.market_is_open

            except asyncio.CancelledError:
                logger.info("Market monitor loop cancelled")
                raise
            except Exception as e:
                logger.error("Error in market monitor loop: %s", e)
                await asyncio.sleep(10)  # Brief back-off on error

    async def _update_market_status(self) -> None:
        """Fetch current market status from Alpaca."""
        client = get_alpaca_client()
        if not client:
            self.market_is_open = False
            return
        try:
            clock = await client.get_clock()
            self.market_is_open = clock["is_open"]
        except Exception as e:
            logger.error("Failed to fetch market clock: %s", e)

    # -------------------------------------------------------------------
    # Startup helpers
    # -------------------------------------------------------------------

    async def _load_running_bots(self) -> None:
        """Load all bots with status='running' from DB and register them."""
        try:
            async with async_session() as session:
                result = await session.execute(
                    select(Bot).where(Bot.status == "running")
                )
                running_bots = result.scalars().all()

            for bot in running_bots:
                await self.register_bot(bot.id)

            if running_bots:
                logger.info("Loaded %d running bots from DB", len(running_bots))
            else:
                logger.info("No running bots to load")

        except Exception as e:
            logger.error("Failed to load running bots: %s", e)

    # -------------------------------------------------------------------
    # Query helpers (used by risk management)
    # -------------------------------------------------------------------

    async def get_bot_today_pnl(self, bot_id: str) -> float:
        """Get today's realized P&L for a specific bot."""
        try:
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            async with async_session() as session:
                from sqlalchemy import func
                result = await session.execute(
                    select(func.coalesce(func.sum(Trade.profit_loss), 0.0))
                    .where(
                        Trade.bot_id == bot_id,
                        Trade.profit_loss.isnot(None),
                        Trade.timestamp >= today_start,
                    )
                )
                return float(result.scalar())
        except Exception:
            return 0.0

    async def get_bot_open_position_count(self, bot_id: str) -> int:
        """Get count of open positions for a specific bot."""
        try:
            async with async_session() as session:
                from sqlalchemy import func
                result = await session.execute(
                    select(func.count())
                    .select_from(Position)
                    .where(
                        Position.bot_id == bot_id,
                        Position.is_open.is_(True),
                    )
                )
                return result.scalar() or 0
        except Exception:
            return 0


# ---------------------------------------------------------------------------
# Singleton — created in main.py lifespan, accessed via app.state
# ---------------------------------------------------------------------------

trading_engine = TradingEngine()
