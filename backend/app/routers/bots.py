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

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import NotFoundError, ConflictError, BadRequestError
from app.models import Bot, Position
from app.schemas import BotCreateSchema, BotResponseSchema, BotUpdateSchema
from app.models import utcnow, generate_uuid
from app.websocket_manager import ws_manager
from app.trading_engine import trading_engine
from app.alpaca_client import alpaca_client

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/bots", tags=["bots"])


async def _validate_capital(
    db: AsyncSession, requested_capital: float, exclude_bot_id: str | None = None
) -> None:
    """
    Validate that the requested capital doesn't exceed available buying power.
    Raises BadRequestError if validation fails.
    Silently passes if Alpaca is not configured (allows dev/testing without Alpaca).
    """
    if not alpaca_client:
        return

    try:
        from app.routers.account import get_allocated_capital
        account = await alpaca_client.get_account()
        allocated = await get_allocated_capital(db, exclude_bot_id=exclude_bot_id)
        available = account["buying_power"] - allocated

        if requested_capital > available:
            raise BadRequestError(
                f"Capital ${requested_capital:,.2f} exceeds available buying power "
                f"(${available:,.2f} available of ${account['buying_power']:,.2f} total)",
                error_code="CAPITAL_EXCEEDS_BUYING_POWER",
            )
    except BadRequestError:
        raise
    except Exception as e:
        logger.warning("Could not validate capital against Alpaca: %s", e)


def _bot_to_response(bot: Bot, realized_gains: float = 0.0) -> dict:
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
        "realized_gains": round(realized_gains, 2),
    }


@router.get("", response_model=list[BotResponseSchema])
async def get_bots(db: AsyncSession = Depends(get_db)):
    """List all bots, ordered by created_at descending, with realized gains."""
    result = await db.execute(
        select(Bot).order_by(Bot.created_at.desc())
    )
    bots = result.scalars().all()

    # Batch-fetch realized gains for all bots in one query
    gains_result = await db.execute(
        select(Position.bot_id, func.coalesce(func.sum(Position.realized_pnl), 0.0))
        .where(Position.is_open.is_(False))
        .group_by(Position.bot_id)
    )
    gains_map = {row[0]: float(row[1]) for row in gains_result}

    return [_bot_to_response(bot, gains_map.get(bot.id, 0.0)) for bot in bots]


@router.post("", response_model=BotResponseSchema, status_code=201)
async def create_bot(data: BotCreateSchema, db: AsyncSession = Depends(get_db)):
    """Create a new bot with status='stopped' and is_active=false."""
    await _validate_capital(db, data.capital)

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
    """Get a single bot by ID with realized gains."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise NotFoundError("Bot", bot_id)
    from app.routers.account import get_bot_realized_gains
    gains = await get_bot_realized_gains(db, bot_id)
    return _bot_to_response(bot, gains)


@router.put("/{bot_id}", response_model=BotResponseSchema)
async def update_bot(
    bot_id: str, data: BotUpdateSchema, db: AsyncSession = Depends(get_db)
):
    """Update an existing bot's configuration."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise NotFoundError("Bot", bot_id)

    await _validate_capital(db, data.capital, exclude_bot_id=bot_id)

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
        raise NotFoundError("Bot", bot_id)
    if bot.status == "running":
        raise ConflictError("Cannot delete a running bot. Stop it first.", error_code="BOT_RUNNING")
    await db.delete(bot)
    return {"success": True}


@router.post("/{bot_id}/start")
async def start_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Start a bot — sets status='running', is_active=true, registers with TradingEngine."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise NotFoundError("Bot", bot_id)

    await _validate_capital(db, bot.capital, exclude_bot_id=bot_id)

    bot.status = "running"
    bot.is_active = True
    bot.error_count = 0
    bot.updated_at = utcnow()
    await db.flush()

    # Broadcast status change to all connected WebSocket clients
    await ws_manager.emit_bot_status_changed({
        "id": bot.id,
        "status": bot.status,
        "is_active": bot.is_active,
    })

    # Register bot with the TradingEngine — starts its trading loop
    await trading_engine.register_bot(bot.id)

    return {"success": True}


@router.post("/{bot_id}/stop")
async def stop_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Stop a bot — sets status='stopped', is_active=false, unregisters from TradingEngine."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise NotFoundError("Bot", bot_id)

    # Unregister bot from the TradingEngine first (cancels trading loop)
    await trading_engine.unregister_bot(bot.id)

    bot.status = "stopped"
    bot.is_active = False
    bot.updated_at = utcnow()
    await db.flush()

    # Broadcast status change to all connected WebSocket clients
    await ws_manager.emit_bot_status_changed({
        "id": bot.id,
        "status": bot.status,
        "is_active": bot.is_active,
    })

    return {"success": True}


@router.post("/{bot_id}/pause")
async def pause_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Pause a bot — sets status='paused', pauses the trading loop."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise NotFoundError("Bot", bot_id)

    bot.status = "paused"
    bot.updated_at = utcnow()
    await db.flush()

    # Pause the bot in the TradingEngine (loop continues but skips trading)
    trading_engine.pause_bot(bot.id)

    # Broadcast status change to all connected WebSocket clients
    await ws_manager.emit_bot_status_changed({
        "id": bot.id,
        "status": bot.status,
        "is_active": bot.is_active,
    })

    return {"success": True}


@router.post("/{bot_id}/resume")
async def resume_bot(bot_id: str, db: AsyncSession = Depends(get_db)):
    """Resume a paused bot — sets status='running', resumes the trading loop."""
    bot = await db.get(Bot, bot_id)
    if not bot:
        raise NotFoundError("Bot", bot_id)

    if bot.status != "paused":
        raise BadRequestError("Bot is not paused", error_code="BOT_NOT_PAUSED")

    bot.status = "running"
    bot.updated_at = utcnow()
    await db.flush()

    # Resume the bot in the TradingEngine
    trading_engine.resume_bot(bot.id)

    # Broadcast status change to all connected WebSocket clients
    await ws_manager.emit_bot_status_changed({
        "id": bot.id,
        "status": bot.status,
        "is_active": bot.is_active,
    })

    return {"success": True}
