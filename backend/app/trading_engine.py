"""
Trading Engine Core — orchestrates bot lifecycle, trading loops, and market monitoring.

Architecture:
  TradingEngine (singleton)
    ├── market_monitor_loop  — polls Alpaca clock every 60s, emits WS events
    └── bots: dict[str, BotRunner]
         └── BotRunner (one per active bot)
              └── _trading_loop  — runs every trading_frequency seconds
                   1. Check trading window (bot's start/end hours in ET)
                   2. For each symbol: fetch bars → evaluate signal → execute trade
                   3. Update last_run_at in DB
                   4. Handle errors (increment error_count, auto-stop on threshold)

Signal evaluation is stubbed until Sprint C (indicators/signals/risk).
The stub always returns HOLD so no trades fire, but the full pipeline runs.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alpaca_client import alpaca_client, AlpacaClient
from app.database import async_session
from app.models import Bot, Trade, Position, generate_uuid, utcnow
from app.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_ERROR_COUNT = 5  # Auto-stop bot after this many consecutive errors
MARKET_MONITOR_INTERVAL = 60  # Seconds between market clock checks
ET_OFFSET = timedelta(hours=-5)  # EST offset from UTC (simplified; real ET is -5/-4)


# ---------------------------------------------------------------------------
# Signal stub — replaced by Sprint C (signal_generator.py)
# ---------------------------------------------------------------------------

class Signal(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


def evaluate_signal_stub(
    bars: list[dict[str, Any]],
    indicators_config: dict[str, Any],
) -> tuple[Signal, dict[str, Any] | None]:
    """
    Stub signal evaluator — always returns HOLD.
    Sprint C will replace this with real indicator calculations + signal generation.

    Returns:
        (signal, indicators_snapshot) — HOLD + None until Sprint C.
    """
    return Signal.HOLD, None


def calculate_position_size_stub(
    bot_capital: float,
    current_price: float,
    risk_config: dict[str, Any],
) -> int:
    """
    Stub position sizer — calculates shares based on max_position_size % of capital.
    Sprint C will replace this with the full RiskManager.

    Returns:
        Number of shares to buy.
    """
    max_pct = risk_config.get("max_position_size", 0.1)  # default 10%
    allocation = bot_capital * max_pct
    if current_price <= 0:
        return 0
    qty = int(allocation / current_price)
    return max(qty, 0)


def calculate_stop_loss_stub(entry_price: float, risk_config: dict[str, Any]) -> float | None:
    """Calculate stop-loss price from config."""
    sl_pct = risk_config.get("stop_loss", 0)
    if sl_pct > 0:
        return round(entry_price * (1 - sl_pct / 100), 2)
    return None


def calculate_take_profit_stub(entry_price: float, risk_config: dict[str, Any]) -> float | None:
    """Calculate take-profit price from config."""
    tp_pct = risk_config.get("take_profit", 0)
    if tp_pct > 0:
        return round(entry_price * (1 + tp_pct / 100), 2)
    return None


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

                # Process each symbol
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
        Process a single symbol: fetch bars → evaluate signal → execute if BUY/SELL.
        """
        if not alpaca_client:
            return

        try:
            # 1. Fetch recent bars
            bars = await alpaca_client.get_bars(symbol, timeframe="1Min", limit=50)
            if not bars:
                logger.debug("No bars returned for %s, skipping", symbol)
                return

            # 2. Evaluate signal (stub until Sprint C)
            signal, indicators_snapshot = evaluate_signal_stub(
                bars, self.config.get("indicators", {})
            )

            # 3. Skip if HOLD
            if signal == Signal.HOLD:
                logger.debug("Signal HOLD for %s, no action", symbol)
                return

            # 4. Get current price
            current_price = await alpaca_client.get_latest_price(symbol)
            if current_price <= 0:
                logger.warning("Invalid price for %s: %.2f, skipping", symbol, current_price)
                return

            # 5. Execute trade
            await self._execute_trade(symbol, signal, current_price, indicators_snapshot)

        except Exception as e:
            logger.error("Error processing %s for bot %s: %s", symbol, self.bot_id[:8], e)

    async def _execute_trade(
        self,
        symbol: str,
        signal: Signal,
        current_price: float,
        indicators_snapshot: dict[str, Any] | None,
    ) -> None:
        """
        Execute a trade: calculate size → submit order → record in DB → emit WS events.
        """
        if not alpaca_client:
            return

        risk_config = self.config.get("risk_management", {})
        bot_capital = self.config.get("capital", 0)
        side = "buy" if signal == Signal.BUY else "sell"

        # --- For SELL: check if we have an open position to sell ---
        if signal == Signal.SELL:
            await self._execute_sell(symbol, current_price, indicators_snapshot)
            return

        # --- For BUY: calculate position size and submit order ---
        qty = calculate_position_size_stub(bot_capital, current_price, risk_config)
        if qty <= 0:
            logger.info("Position size 0 for %s, skipping buy", symbol)
            return

        # Check max concurrent positions
        max_positions = risk_config.get("max_concurrent_positions")
        if max_positions:
            open_count = await self._count_open_positions()
            if open_count >= max_positions:
                logger.info(
                    "Bot %s at max positions (%d/%d), skipping buy for %s",
                    self.bot_id[:8], open_count, max_positions, symbol,
                )
                return

        try:
            # Submit market order via Alpaca
            order_result = await alpaca_client.submit_market_order(
                symbol=symbol, qty=qty, side="buy", time_in_force="day"
            )

            # Wait briefly for fill (market orders usually fill instantly)
            await asyncio.sleep(1)
            order_status = await alpaca_client.get_order(order_result["id"])

            filled_price = order_status.get("filled_avg_price") or current_price
            filled_qty = int(order_status.get("filled_qty", 0)) or qty
            status = order_status.get("status", "pending")

            # Calculate stop-loss and take-profit
            stop_loss = calculate_stop_loss_stub(filled_price, risk_config)
            take_profit = calculate_take_profit_stub(filled_price, risk_config)

            # Record trade in DB
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
                )
                session.add(trade)

                # Create position record
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
                })

            logger.info(
                "BUY executed: %s x%d @ %.2f (order=%s, bot=%s)",
                symbol, filled_qty, filled_price, order_result["id"][:8], self.bot_id[:8],
            )

        except Exception as e:
            logger.error("Failed to execute BUY for %s: %s", symbol, e)

    async def _execute_sell(
        self,
        symbol: str,
        current_price: float,
        indicators_snapshot: dict[str, Any] | None,
    ) -> None:
        """Close the open position for this symbol if one exists."""
        if not alpaca_client:
            return

        async with async_session() as session:
            # Find open position for this bot + symbol
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
                # Submit sell order via Alpaca
                order_result = await alpaca_client.submit_market_order(
                    symbol=symbol,
                    qty=position.quantity,
                    side="sell",
                    time_in_force="day",
                )

                await asyncio.sleep(1)
                order_status = await alpaca_client.get_order(order_result["id"])

                filled_price = order_status.get("filled_avg_price") or current_price
                profit_loss = round((filled_price - position.entry_price) * position.quantity, 2)

                # Update position
                now = utcnow()
                position.is_open = False
                position.closed_at = now
                position.current_price = filled_price
                position.realized_pnl = profit_loss
                position.unrealized_pnl = 0.0

                # Create sell trade record
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
                })

                logger.info(
                    "SELL executed: %s x%d @ %.2f P&L=%.2f (order=%s, bot=%s)",
                    symbol, position.quantity, filled_price, profit_loss,
                    order_result["id"][:8], self.bot_id[:8],
                )

            except Exception as e:
                logger.error("Failed to execute SELL for %s: %s", symbol, e)

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
        if not alpaca_client:
            self.market_is_open = False
            return
        try:
            clock = await alpaca_client.get_clock()
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
