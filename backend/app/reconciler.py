"""
Position Reconciler — keeps DB positions/trades in sync with Alpaca broker state.

Handles three types of drift:
  1. Pending trades (status='new'/'partially_filled') that Alpaca has resolved
  2. DB positions that no longer exist in Alpaca (stale — auto-closed)
  3. Alpaca positions not tracked in DB (excess — logged as warning)

Runs at startup and every RECONCILIATION_INTERVAL seconds in the background.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any

import structlog
from sqlalchemy import func, select

from app.activity_logger import activity_logger
from app.alpaca_client import (
    AlpacaClient,
    get_alpaca_client,
    get_registered_user_ids,
)
from app.database import async_session
from app.models import Bot, Position, Trade, utcnow
from app.websocket_manager import ws_manager

logger = structlog.get_logger(__name__)

STALE_ORDER_THRESHOLD = timedelta(minutes=5)


class PositionReconciler:
    """Detects and corrects drift between Alpaca broker state and the local DB."""

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def full_reconciliation(self) -> dict[str, Any]:
        """
        Run resolve_pending_trades + reconcile_positions for every user
        that has a registered Alpaca client.

        Returns a summary dict of everything found/fixed.
        """
        user_ids = get_registered_user_ids()
        if not user_ids:
            logger.debug("reconciliation_skipped: no registered user clients")
            return {"users_checked": 0, "pending_resolved": 0, "discrepancies": []}

        total_pending = 0
        all_discrepancies: list[dict[str, Any]] = []

        for user_id in user_ids:
            client = get_alpaca_client(user_id=user_id)
            if client is None:
                continue

            try:
                pending = await self.resolve_pending_trades(user_id, client)
                total_pending += pending

                discreps = await self.reconcile_positions(user_id, client)
                all_discrepancies.extend(discreps)
            except Exception as e:
                logger.error(
                    "reconciliation_user_error",
                    user_id=user_id,
                    error=str(e),
                )

        summary = {
            "users_checked": len(user_ids),
            "pending_resolved": total_pending,
            "discrepancies": all_discrepancies,
        }

        if total_pending or all_discrepancies:
            logger.info("reconciliation_complete", **summary)
        else:
            logger.debug("reconciliation_complete: no drift detected")

        return summary

    # ------------------------------------------------------------------
    # Pending trades
    # ------------------------------------------------------------------

    async def resolve_pending_trades(
        self, user_id: str, client: AlpacaClient
    ) -> int:
        """
        Find Trade records stuck in 'new' or 'partially_filled' and resolve
        them against Alpaca's actual order status.

        Returns the number of trades resolved.
        """
        resolved = 0
        async with async_session() as session:
            result = await session.execute(
                select(Trade)
                .join(Bot)
                .where(
                    Bot.user_id == user_id,
                    Trade.status.in_(["new", "partially_filled"]),
                )
            )
            pending_trades = result.scalars().all()

            for trade in pending_trades:
                if not trade.order_id:
                    continue
                try:
                    order = await client.get_order(trade.order_id)
                except Exception as e:
                    logger.warning(
                        "resolve_pending_order_fetch_failed",
                        order_id=trade.order_id,
                        error=str(e),
                    )
                    continue

                alpaca_status = order.get("status", "")

                if alpaca_status == "filled":
                    await self._handle_filled_order(session, trade, order)
                    resolved += 1

                elif alpaca_status in ("canceled", "cancelled", "rejected", "expired"):
                    await self._handle_terminal_order(session, trade, alpaca_status)
                    resolved += 1

                elif alpaca_status in ("new", "partially_filled", "accepted", "pending_new"):
                    age = utcnow() - trade.timestamp
                    if age > STALE_ORDER_THRESHOLD:
                        await self._cancel_stale_order(session, trade, client)
                        resolved += 1

            await session.commit()

        return resolved

    async def _handle_filled_order(
        self, session: Any, trade: Trade, order: dict
    ) -> None:
        """Update trade and position with actual fill data from Alpaca."""
        fill_price = order.get("filled_avg_price") or trade.price
        filled_qty = order.get("filled_qty") or trade.quantity

        trade.status = "filled"
        trade.price = float(fill_price)
        trade.quantity = int(filled_qty)

        pos_result = await session.execute(
            select(Position).where(
                Position.bot_id == trade.bot_id,
                Position.symbol == trade.symbol,
                Position.is_open.is_(True),
            )
        )
        position = pos_result.scalars().first()

        if position:
            position.entry_price = float(fill_price)
            position.quantity = int(filled_qty)

        logger.info(
            "pending_trade_filled",
            trade_id=trade.id,
            symbol=trade.symbol,
            price=fill_price,
        )
        await activity_logger.log(
            level="info",
            category="reconciliation",
            message=f"Pending trade resolved as FILLED: {trade.symbol} x{filled_qty} @ ${fill_price}",
            bot_id=trade.bot_id,
        )

    async def _handle_terminal_order(
        self, session: Any, trade: Trade, alpaca_status: str
    ) -> None:
        """Handle canceled/rejected/expired orders: update trade + close position."""
        trade.status = alpaca_status

        pos_result = await session.execute(
            select(Position).where(
                Position.bot_id == trade.bot_id,
                Position.symbol == trade.symbol,
                Position.is_open.is_(True),
            )
        )
        position = pos_result.scalars().first()

        if position:
            position.is_open = False
            position.closed_at = utcnow()

        logger.info(
            "pending_trade_terminal",
            trade_id=trade.id,
            symbol=trade.symbol,
            status=alpaca_status,
        )
        await activity_logger.log(
            level="warning",
            category="reconciliation",
            message=f"Pending trade resolved as {alpaca_status.upper()}: {trade.symbol}",
            bot_id=trade.bot_id,
        )

    async def _cancel_stale_order(
        self, session: Any, trade: Trade, client: AlpacaClient
    ) -> None:
        """Cancel an Alpaca order that has been pending too long."""
        try:
            await client.cancel_order(trade.order_id)
        except Exception as e:
            logger.warning(
                "stale_order_cancel_failed",
                order_id=trade.order_id,
                error=str(e),
            )

        trade.status = "canceled"

        pos_result = await session.execute(
            select(Position).where(
                Position.bot_id == trade.bot_id,
                Position.symbol == trade.symbol,
                Position.is_open.is_(True),
            )
        )
        position = pos_result.scalars().first()
        if position:
            position.is_open = False
            position.closed_at = utcnow()

        logger.info(
            "stale_order_cancelled",
            trade_id=trade.id,
            symbol=trade.symbol,
        )
        await activity_logger.log(
            level="warning",
            category="reconciliation",
            message=f"Stale pending order auto-cancelled: {trade.symbol} (order {trade.order_id})",
            bot_id=trade.bot_id,
        )

    # ------------------------------------------------------------------
    # Position reconciliation
    # ------------------------------------------------------------------

    async def reconcile_positions(
        self, user_id: str, client: AlpacaClient
    ) -> list[dict[str, Any]]:
        """
        Compare Alpaca positions with DB positions for a single user.

        Auto-corrects:
          - Stale DB positions (DB open, Alpaca doesn't have them)
          - current_price drift on all open positions

        Logs but does NOT auto-sell:
          - Excess Alpaca positions (Alpaca has shares not tracked in DB)

        Returns a list of discrepancy dicts.
        """
        try:
            alpaca_positions = await client.get_positions()
        except Exception as e:
            logger.error("reconcile_positions_fetch_failed", user_id=user_id, error=str(e))
            return []

        alpaca_qty_map: dict[str, int] = {}
        alpaca_price_map: dict[str, float] = {}
        for ap in alpaca_positions:
            sym = ap["symbol"]
            alpaca_qty_map[sym] = int(ap["qty"])
            alpaca_price_map[sym] = float(ap["current_price"])

        discrepancies: list[dict[str, Any]] = []

        async with async_session() as session:
            # Sum DB open positions per symbol for this user
            db_result = await session.execute(
                select(Position.symbol, func.sum(Position.quantity))
                .join(Bot)
                .where(Position.is_open.is_(True), Bot.user_id == user_id)
                .group_by(Position.symbol)
            )
            db_qty_map: dict[str, int] = {row[0]: int(row[1]) for row in db_result}

            all_symbols = set(alpaca_qty_map.keys()) | set(db_qty_map.keys())

            for symbol in all_symbols:
                alpaca_qty = alpaca_qty_map.get(symbol, 0)
                db_qty = db_qty_map.get(symbol, 0)

                if alpaca_qty > db_qty:
                    diff = alpaca_qty - db_qty
                    d = {
                        "type": "excess_in_alpaca",
                        "user_id": user_id,
                        "symbol": symbol,
                        "alpaca_qty": alpaca_qty,
                        "db_qty": db_qty,
                        "diff": diff,
                        "detail": f"Alpaca has {diff} untracked share(s) of {symbol}",
                    }
                    discrepancies.append(d)
                    logger.warning("position_drift_excess_alpaca", **d)

                elif db_qty > alpaca_qty:
                    diff = db_qty - alpaca_qty
                    d = {
                        "type": "excess_in_db",
                        "user_id": user_id,
                        "symbol": symbol,
                        "alpaca_qty": alpaca_qty,
                        "db_qty": db_qty,
                        "diff": diff,
                        "detail": f"DB has {diff} stale share(s) of {symbol} — auto-closing",
                    }
                    discrepancies.append(d)
                    logger.warning("position_drift_excess_db", **d)
                    await self._auto_close_stale_positions(session, user_id, symbol, diff)

            # Update current_price on all open positions from Alpaca live data
            await self._update_live_prices(session, user_id, alpaca_price_map)

            await session.commit()

        # Emit WS alerts for any discrepancies
        if discrepancies:
            await self._emit_reconciliation_alert(user_id, discrepancies)

        return discrepancies

    async def _auto_close_stale_positions(
        self, session: Any, user_id: str, symbol: str, excess: int
    ) -> None:
        """
        Close the oldest open DB positions for *symbol* until we've removed
        *excess* shares.  Only targets positions owned by *user_id*.
        """
        result = await session.execute(
            select(Position)
            .join(Bot)
            .where(
                Position.is_open.is_(True),
                Position.symbol == symbol,
                Bot.user_id == user_id,
            )
            .order_by(Position.opened_at.asc())
        )
        positions = result.scalars().all()

        remaining = excess
        for pos in positions:
            if remaining <= 0:
                break
            pos.is_open = False
            pos.closed_at = utcnow()
            remaining -= pos.quantity
            logger.info(
                "stale_position_closed",
                position_id=pos.id,
                symbol=symbol,
                qty=pos.quantity,
            )

        await activity_logger.log(
            level="warning",
            category="reconciliation",
            message=(
                f"Auto-closed stale DB position(s): {symbol} "
                f"({excess} share(s) not found in Alpaca)"
            ),
        )

    async def _update_live_prices(
        self, session: Any, user_id: str, price_map: dict[str, float]
    ) -> None:
        """Refresh current_price and unrealized_pnl on all open positions."""
        if not price_map:
            return

        result = await session.execute(
            select(Position)
            .join(Bot)
            .where(Position.is_open.is_(True), Bot.user_id == user_id)
        )
        positions = result.scalars().all()

        for pos in positions:
            live_price = price_map.get(pos.symbol)
            if live_price is not None:
                pos.current_price = live_price
                pos.unrealized_pnl = round(
                    (live_price - pos.entry_price) * pos.quantity, 2
                )

    # ------------------------------------------------------------------
    # WebSocket + activity alerts
    # ------------------------------------------------------------------

    async def _emit_reconciliation_alert(
        self, user_id: str, discrepancies: list[dict[str, Any]]
    ) -> None:
        """Push a reconciliation_alert event over WebSocket."""
        payload = {
            "type": "reconciliation_alert",
            "user_id": user_id,
            "discrepancies": discrepancies,
            "timestamp": utcnow().isoformat(),
        }
        try:
            await ws_manager.emit_reconciliation_alert(payload)
        except Exception as e:
            logger.warning("ws_reconciliation_alert_failed", error=str(e))

        await activity_logger.system_event(
            f"Position reconciliation found {len(discrepancies)} discrepancy(ies)",
            level="warning",
            user_id=user_id,
            discrepancy_count=len(discrepancies),
        )


# Singleton
reconciler = PositionReconciler()
