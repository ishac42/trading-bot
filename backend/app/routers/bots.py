"""
Bot profiles: a universe, a risk sleeve, start/stop, and statistics.

The indicator factory (capital, typed symbols, pause) is not this contract.
Pause and resume return 410. Start does not boot a bot runner.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.book_control import (
    assert_bot_risk_within_book,
    book_state,
    default_bot_stats,
    default_risk,
    default_sleeve,
    default_universe,
    build_universe_snapshot,
    empty_snapshot,
    read_category,
    snapshot_payload,
    store_snapshot,
)
from app.database import get_db
from app.exceptions import ConflictError, GoneError, NotFoundError
from app.models import Bot, User, utcnow
from app.schemas import BotProfileResponseSchema, BotProfileWriteSchema, UniverseFiltersSchema

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/bots", tags=["bots"])


def _profile_response(bot: Bot) -> dict:
    profile = bot.profile or {}
    universe = profile.get("universe") or default_universe()
    snapshot = profile.get("snapshot") or empty_snapshot(universe)
    raw_risk = profile.get("risk") if isinstance(profile.get("risk"), dict) else {}
    risk = default_sleeve()
    risk.update({key: value for key, value in raw_risk.items() if value is not None})
    stats = profile.get("stats") or default_bot_stats()
    status = "running" if bot.status == "running" else "stopped"
    return {
        "id": bot.id,
        "name": bot.name,
        "status": status,
        "universe": universe,
        "snapshot": snapshot,
        "risk": risk,
        "stats": stats,
    }


async def _owned_profile(db: AsyncSession, user_id: str, bot_id: str) -> Bot:
    result = await db.execute(
        select(Bot).where(Bot.id == bot_id, Bot.user_id == user_id)
    )
    bot = result.scalar_one_or_none()
    if bot is None or not bot.profile:
        raise NotFoundError("Bot", bot_id)
    return bot


async def _write_profile(db: AsyncSession, user: User, body: BotProfileWriteSchema, bot: Bot | None) -> Bot:
    book_risk = await read_category(db, user.id, "risk", default_risk())
    risk = body.risk.model_dump()
    assert_bot_risk_within_book(risk, book_risk)
    universe = body.universe.model_dump()
    if bot is None:
        profile = {
            "universe": universe,
            "risk": risk,
            "stats": default_bot_stats(),
            "snapshot": empty_snapshot(universe),
        }
        bot = Bot(
            user_id=user.id,
            name=body.name.strip(),
            status="stopped",
            capital=0,
            trading_frequency=0,
            indicators={},
            risk_management={},
            symbols=[],
            is_active=False,
            profile=profile,
        )
        db.add(bot)
    else:
        profile = dict(bot.profile or {})
        profile["universe"] = universe
        profile["risk"] = risk
        profile.setdefault("stats", default_bot_stats())
        snapshot = dict(profile.get("snapshot") or empty_snapshot(universe))
        snapshot["filters"] = universe
        profile["snapshot"] = snapshot
        bot.name = body.name.strip()
        bot.profile = profile
        bot.updated_at = utcnow()
    await db.flush()
    await _scan_into_profile(db, user.id, bot)
    return bot


async def _scan_into_profile(db: AsyncSession, user_id: str, bot: Bot, filters: dict | None = None) -> Bot:
    """Quote the liquid list and store the names that pass this bot's filters."""
    profile = dict(bot.profile or {})
    chosen = filters if filters is not None else (profile.get("universe") or {})
    members = await build_universe_snapshot(user_id, chosen)
    row = await store_snapshot(db, user_id, chosen, members)
    profile["universe"] = dict(chosen)
    profile["snapshot"] = snapshot_payload(row, chosen)
    bot.profile = profile
    bot.updated_at = utcnow()
    await db.flush()
    return bot


@router.get("", response_model=list[BotProfileResponseSchema])
async def list_bots(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bot).where(Bot.user_id == user.id, Bot.profile.isnot(None)).order_by(Bot.created_at.desc())
    )
    return [_profile_response(bot) for bot in result.scalars()]


@router.post("", response_model=BotProfileResponseSchema, status_code=201)
async def create_bot(
    body: BotProfileWriteSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _write_profile(db, user, body, None)
    logger.info("bot_profile_created", bot_id=bot.id, user_id=user.id)
    return _profile_response(bot)


@router.get("/{bot_id}", response_model=BotProfileResponseSchema)
async def get_bot(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _owned_profile(db, user.id, bot_id)
    return _profile_response(bot)


@router.put("/{bot_id}", response_model=BotProfileResponseSchema)
async def update_bot(
    bot_id: str,
    body: BotProfileWriteSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _owned_profile(db, user.id, bot_id)
    bot = await _write_profile(db, user, body, bot)
    return _profile_response(bot)


@router.delete("/{bot_id}")
async def delete_bot(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _owned_profile(db, user.id, bot_id)
    if bot.status == "running":
        raise ConflictError("Stop the bot before deleting it")
    await db.delete(bot)
    await db.flush()
    return {"success": True}


@router.post("/{bot_id}/scan", response_model=BotProfileResponseSchema)
async def scan_bot(
    bot_id: str,
    body: UniverseFiltersSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Force a membership scan for the filters on the bot editor."""
    bot = await _owned_profile(db, user.id, bot_id)
    bot = await _scan_into_profile(db, user.id, bot, body.model_dump())
    return _profile_response(bot)


@router.post("/{bot_id}/start", response_model=BotProfileResponseSchema)
async def start_bot(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _owned_profile(db, user.id, bot_id)
    state = await book_state(db, user.id)
    if state.get("locked") or state.get("halted"):
        raise ConflictError("The book is locked. Start is refused until it is unlocked.")
    bot.status = "running"
    bot.is_active = True
    bot.updated_at = utcnow()
    await db.flush()
    return _profile_response(bot)


@router.post("/{bot_id}/stop", response_model=BotProfileResponseSchema)
async def stop_bot(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bot = await _owned_profile(db, user.id, bot_id)
    bot.status = "stopped"
    bot.is_active = False
    bot.updated_at = utcnow()
    await db.flush()
    return _profile_response(bot)


@router.post("/{bot_id}/pause")
async def pause_bot(bot_id: str):
    raise GoneError("Pause is retired. Start and stop the bot profile.")


@router.post("/{bot_id}/resume")
async def resume_bot(bot_id: str):
    raise GoneError("Resume is retired. Start and stop the bot profile.")
