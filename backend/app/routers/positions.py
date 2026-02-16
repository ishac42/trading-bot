"""
Position Management API — open positions listing, filtering, and closing.

Endpoints:
  GET  /api/positions            → list open positions (with filters)
  GET  /api/positions/{id}       → get a single position
  POST /api/positions/{id}/close → close a position
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Position, Trade, utcnow, generate_uuid
from app.schemas import PositionResponseSchema

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
        raise HTTPException(status_code=404, detail="Position not found")
    return _position_to_response(position)


@router.post("/{position_id}/close")
async def close_position(position_id: str, db: AsyncSession = Depends(get_db)):
    """
    Close an open position:
    1. Set is_open=False, closed_at=now()
    2. Move unrealized_pnl → realized_pnl
    3. Create a corresponding sell Trade record
    4. Emit WebSocket event (TODO: Phase 8)
    """
    position = await db.get(Position, position_id)
    if not position:
        raise HTTPException(status_code=404, detail="Position not found")
    if not position.is_open:
        raise HTTPException(status_code=400, detail="Position is already closed")

    # Close the position
    now = utcnow()
    position.is_open = False
    position.closed_at = now
    position.realized_pnl = position.unrealized_pnl
    position.unrealized_pnl = 0.0

    # Create a corresponding sell trade
    sell_trade = Trade(
        id=generate_uuid(),
        bot_id=position.bot_id,
        symbol=position.symbol,
        type="sell",
        quantity=position.quantity,
        price=position.current_price,
        timestamp=now,
        profit_loss=position.realized_pnl,
        status="filled",
    )
    db.add(sell_trade)
    await db.flush()

    # TODO: Phase 8 — emit position_updated WebSocket event
    # TODO: Phase 9 — execute sell order via Alpaca API

    return {"success": True}
