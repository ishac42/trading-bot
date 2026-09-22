"""
Book commands. Flatten, lock, and unlock. No strategy orders and no bot runner.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.book_control import (
    account_equity,
    book_state,
    close_db_positions,
    default_risk,
    effective_loss_pct,
    flatten_broker,
    marked_daily_pnl,
    read_category,
    record_risk_event,
    write_category,
)
from app.database import get_db
from app.exceptions import ValidationError
from app.models import User
from app.schemas import ConfirmBody, RiskEventSchema
from app.websocket_manager import ws_manager

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/book", tags=["book"])


def _event_response(row) -> RiskEventSchema:
    return RiskEventSchema(
        id=row.id,
        kind=row.kind,
        reason_code=row.reason_code,
        payload=row.payload or {},
        created_at=row.created_at.isoformat() if row.created_at else "",
    )


async def _emit(row) -> None:
    payload = dict(row.payload or {})
    payload["kind"] = row.kind
    payload["reason_code"] = row.reason_code
    await ws_manager.emit_risk_event(payload)


@router.post("/flatten", response_model=RiskEventSchema)
async def flatten_book(
    body: ConfirmBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.confirm is not True:
        raise ValidationError("Flatten requires confirm: true")
    broker = await flatten_broker(user.id)
    closed = await close_db_positions(db, user.id)
    state = await book_state(db, user.id)
    payload = {
        "orders_cancelled": broker["orders_cancelled"],
        "positions_closed": broker["positions_closed"] + closed,
        "locked": state["locked"],
        "halted": state["halted"],
        "throttle_stage": state["throttle_stage"],
    }
    row = await record_risk_event(db, user.id, "flatten", "MANUAL_FLATTEN", payload)
    await _emit(row)
    logger.info("book_flattened", user_id=user.id, positions=closed)
    return _event_response(row)


@router.post("/lock", response_model=RiskEventSchema)
async def lock_book(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await book_state(db, user.id)
    state["locked"] = True
    state["throttle_stage"] = "locked"
    await write_category(db, user.id, "book", state)
    payload = {
        "locked": True,
        "halted": bool(state.get("halted")),
        "throttle_stage": "locked",
        "marked_daily_pnl": state.get("marked_daily_pnl", 0),
        "marked_daily_pnl_pct": state.get("marked_daily_pnl_pct", 0),
    }
    row = await record_risk_event(db, user.id, "lock", "MANUAL_LOCK", payload)
    await _emit(row)
    return _event_response(row)


@router.post("/unlock", response_model=RiskEventSchema)
async def unlock_book(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    state = await book_state(db, user.id)
    risk = await read_category(db, user.id, "risk", default_risk())
    marked = await marked_daily_pnl(db, user.id)
    equity = await account_equity(user.id)
    loss_pct = effective_loss_pct(float(state.get("marked_daily_pnl_pct") or 0), marked, equity)
    lock_pct = float(risk["hard_daily_lock_pct"])
    if loss_pct <= lock_pct:
        raise ValidationError(
            "Unlock is refused while marked daily loss is at or past the daily lock",
            details={"marked_daily_pnl_pct": loss_pct, "hard_daily_lock_pct": lock_pct},
        )
    state["locked"] = False
    if not state.get("halted"):
        state["throttle_stage"] = "normal"
    await write_category(db, user.id, "book", state)
    payload = {
        "locked": False,
        "halted": bool(state.get("halted")),
        "throttle_stage": state["throttle_stage"],
        "marked_daily_pnl_pct": loss_pct,
    }
    row = await record_risk_event(db, user.id, "unlock", "MANUAL_UNLOCK", payload)
    await _emit(row)
    return _event_response(row)
