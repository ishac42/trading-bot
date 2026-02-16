"""
Bot Management API — CRUD + lifecycle control (start/stop/pause).

Endpoints:
  GET    /api/bots           → list all bots
  POST   /api/bots           → create a new bot
  GET    /api/bots/{id}      → get a single bot
  PUT    /api/bots/{id}      → update a bot
  DELETE /api/bots/{id}      → delete a bot
  POST   /api/bots/{id}/start → start a bot
  POST   /api/bots/{id}/stop  → stop a bot
  POST   /api/bots/{id}/pause → pause a bot
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Bot
from app.schemas import BotCreateSchema, BotResponseSchema, BotUpdateSchema
from app.models import utcnow, generate_uuid

router = APIRouter(prefix="/bots", tags=["bots"])


def _bot_to_response(bot: Bot) -> dict:
    """Convert a Bot ORM model to the response dict with ISO timestamps."""
    return {
        "id": bot.id,
        "name": bot.name,
        "status": bot.status,
        "capital": bot.capital,
        "trading_frequency": bot.trading_frequency,
        "indicators": bot.indicators,
        "risk_management": bot.risk_management,
        "symbols": bot.symbols,
        "start_hour": bot.start_hour,
        "start_minute": bot.start_minute,
        "end_hour": bot.end_hour,
        "end_minute": bot.end_minute,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else None,
        "last_run_at": bot.last_run_at.isoformat() if bot.last_run_at else None,
        "is_active": bot.is_active,
        "error_count": bot.error_count,
    }


@router.get("", response_model=list[BotResponseSchema])
async def get_bots(db: AsyncSession = Depends(get_db)):
    """List all bots, ordered by created_at descending."""
    result = await db.execute(
        select(Bot).order_by(Bot.created_at.desc())
    )
    bots = result.scalars().all()
    return [_bot_to_response(bot) for bot in bots]


@router.post("", response_model=BotResponseSchema, status_code=201)
async def create_bot(data: BotCreateSchema, db: AsyncSession = Depends(get_db)):
    """Create a new bot with status='stopped' and is_active=false."""
    bot = Bot(
        id=generate_uuid(),
        name=data.name,
        status="stopped",
        capital=data.capital,
        trading_frequency=data.trading_frequency,
        indicators=data.indicators,
        risk_management=data.risk_management.model_dump(),
        symbols=data.symbols,
        start_hour=data.start_hour,
        start_minute=data.start_minute,
        end_hour=data.end_hour,
        end_minute=data.end_minute,
        is_active=False,
        error_count=0,
    )
    db.add(bot)
    await db.flush()
    await db.refresh(bot)
    return _bot_to_response(bot)


@router.get("/{bot_id}", response_model=BotResponseSchema)
async def get_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single bot by ID."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    return _bot_to_response(bot)


@router.put("/{bot_id}", response_model=BotResponseSchema)
async def update_bot(
    bot_id: str, data: BotUpdateSchema, db: AsyncSession = Depends(get_db)
):
    """Update an existing bot's configuration."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot.name = data.name
    bot.capital = data.capital
    bot.trading_frequency = data.trading_frequency
    bot.indicators = data.indicators
    bot.risk_management = data.risk_management.model_dump()
    bot.symbols = data.symbols
    bot.start_hour = data.start_hour
    bot.start_minute = data.start_minute
    bot.end_hour = data.end_hour
    bot.end_minute = data.end_minute
    bot.updated_at = utcnow()

    await db.flush()
    await db.refresh(bot)
    return _bot_to_response(bot)


@router.delete("/{bot_id}")
async def delete_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a bot (only if stopped). Cascades to trades and positions."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")
    if bot.status == "running":
        raise HTTPException(
            status_code=400, detail="Cannot delete a running bot. Stop it first."
        )
    await db.delete(bot)
    return {"success": True}


@router.post("/{bot_id}/start")
async def start_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Start a bot — sets status='running', is_active=true."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot.status = "running"
    bot.is_active = True
    bot.updated_at = utcnow()
    await db.flush()

    # TODO: Phase 8 — emit bot_status_changed WebSocket event
    # TODO: Phase 10 — register bot with TradingEngine

    return {"success": True}


@router.post("/{bot_id}/stop")
async def stop_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Stop a bot — sets status='stopped', is_active=false."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot.status = "stopped"
    bot.is_active = False
    bot.updated_at = utcnow()
    await db.flush()

    # TODO: Phase 8 — emit bot_status_changed WebSocket event
    # TODO: Phase 10 — unregister bot from TradingEngine

    return {"success": True}


@router.post("/{bot_id}/pause")
async def pause_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Pause a bot — sets status='paused'."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot.status = "paused"
    bot.updated_at = utcnow()
    await db.flush()

    # TODO: Phase 8 — emit bot_status_changed WebSocket event
    # TODO: Phase 10 — pause bot in TradingEngine

    return {"success": True}
