"""
Position Management API — open positions listing, filtering, and closing.

Endpoints:
  GET  /api/positions            → list open positions (with filters)
  GET  /api/positions/{id}       → get a single position
  POST /api/positions/{id}/close → close a position (executes sell via Alpaca)
"""

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import NotFoundError, BadRequestError, ExternalServiceError
from app.models import Position, Trade, utcnow, generate_uuid
from app.schemas import PositionResponseSchema
from app.websocket_manager import ws_manager
from app.alpaca_client import alpaca_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/positions", tags=["positions"])


def _position_to_response(pos: Position) -> dict:
    """Convert a Position ORM model to the response dict with ISO timestamps."""
    return {
        "id": pos.id,
        "bot_id": pos.bot_id,
        "symbol": pos.symbol,
        "quantity": pos.quantity,
        "entry_price": pos.entry_price,
        "current_price": pos.current_price,
        "stop_loss_price": pos.stop_loss_price,
        "take_profit_price": pos.take_profit_price,
        "unrealized_pnl": pos.unrealized_pnl,
        "realized_pnl": pos.realized_pnl,
        "opened_at": pos.opened_at.isoformat() if pos.opened_at else None,
        "closed_at": pos.closed_at.isoformat() if pos.closed_at else None,
        "is_open": pos.is_open,
        "entry_indicator": pos.entry_indicator,
    }


# Map frontend sort field names to ORM columns
SORT_FIELD_MAP = {
    "symbol": Position.symbol,
    "unrealized_pnl": Position.unrealized_pnl,
    "entry_price": Position.entry_price,
    "current_price": Position.current_price,
    "opened_at": Position.opened_at,
}


@router.get("", response_model=list[PositionResponseSchema])
async def get_positions(
    botId: str = Query(""),
    symbol: str = Query(""),
    sortBy: str = Query("opened_at"),
    sortOrder: str = Query("desc"),
    db: AsyncSession = Depends(get_db),
):
    """List open positions with optional filters and sorting."""
    query = select(Position).where(Position.is_open.is_(True))

    # Filters
    if botId:
        query = query.where(Position.bot_id == botId)
    if symbol:
        query = query.where(Position.symbol == symbol)

    # Sorting
    sort_col = SORT_FIELD_MAP.get(sortBy, Position.opened_at)
    if sortOrder == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    result = await db.execute(query)
    positions = result.scalars().all()
    return [_position_to_response(pos) for pos in positions]


@router.get("/{position_id}", response_model=PositionResponseSchema)
async def get_position(position_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single position by ID."""
    position = await db.get(Position, position_id)
    if not position:
        raise NotFoundError("Position", position_id)
    return _position_to_response(position)


@router.post("/{position_id}/close")
async def close_position(position_id: str, db: AsyncSession = Depends(get_db)):
    """
    Close an open position:
    1. Submit sell order via Alpaca (if available)
    2. Set is_open=False, closed_at=now()
    3. Calculate realized P&L from actual fill price
    4. Create a corresponding sell Trade record
    5. Emit WebSocket events
    """
    position = await db.get(Position, position_id)
    if not position:
        raise NotFoundError("Position", position_id)
    if not position.is_open:
        raise BadRequestError("Position is already closed", error_code="POSITION_ALREADY_CLOSED")

    now = utcnow()
    order_id = None
    sell_price = position.current_price  # fallback if Alpaca unavailable

    # --- Execute sell order via Alpaca ---
    if alpaca_client:
        try:
            order_result = await alpaca_client.submit_market_order(
                symbol=position.symbol,
                qty=position.quantity,
                side="sell",
                time_in_force="day",
            )
            order_id = order_result["id"]
            logger.info(
                "Submitted close-position sell order for %s x%d → order_id=%s",
                position.symbol, position.quantity, order_id[:8],
            )

            # Wait briefly for fill then fetch actual price
            import asyncio
            await asyncio.sleep(1)
            order_status = await alpaca_client.get_order(order_id)
            if order_status.get("filled_avg_price"):
                sell_price = order_status["filled_avg_price"]
        except Exception as e:
            logger.error(
                "alpaca_sell_failed",
                position_id=position_id,
                symbol=position.symbol,
                error=str(e),
            )
            raise ExternalServiceError("Alpaca", f"Failed to execute sell order: {e}")

    # --- Update position ---
    profit_loss = round((sell_price - position.entry_price) * position.quantity, 2)
    position.is_open = False
    position.closed_at = now
    position.current_price = sell_price
    position.realized_pnl = profit_loss
    position.unrealized_pnl = 0.0

    # --- Create sell trade record ---
    sell_trade = Trade(
        id=generate_uuid(),
        bot_id=position.bot_id,
        symbol=position.symbol,
        type="sell",
        quantity=position.quantity,
        price=sell_price,
        timestamp=now,
        profit_loss=profit_loss,
        order_id=order_id,
        status="filled",
    )
    db.add(sell_trade)
    await db.flush()

    # --- Broadcast WebSocket events ---
    await ws_manager.emit_position_updated(_position_to_response(position))

    await ws_manager.emit_trade_executed({
        "id": sell_trade.id,
        "bot_id": sell_trade.bot_id,
        "symbol": sell_trade.symbol,
        "type": sell_trade.type,
        "quantity": sell_trade.quantity,
        "price": sell_trade.price,
        "timestamp": sell_trade.timestamp.isoformat() if sell_trade.timestamp else None,
        "profit_loss": sell_trade.profit_loss,
        "status": sell_trade.status,
        "order_id": sell_trade.order_id,
    })

    return {"success": True}
