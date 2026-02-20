"""
Settings router for managing per-user application settings.

Endpoints:
  GET    /settings              — All settings for the current user
  PUT    /settings/broker       — Update broker connection settings
  PUT    /settings/notifications — Update notification preferences
  PUT    /settings/display      — Update display preferences
  POST   /settings/broker/test  — Test Alpaca connection
  POST   /settings/export/trades    — Export trades as CSV
  POST   /settings/export/positions — Export positions as CSV
  DELETE /settings/trades       — Clear trade history
  POST   /settings/reset        — Reset all settings to defaults
  GET    /settings/data-stats   — Storage usage stats
"""

from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings as app_settings
from app.database import get_db
from app.exceptions import ExternalServiceError
from app.models import AppSettings, Bot, Position, Trade, User
from app.schemas import (
    AllSettingsResponse,
    BrokerSettingsResponse,
    BrokerSettingsSchema,
    BrokerTestResponse,
    DataStatsResponse,
    DisplaySettingsSchema,
    NotificationSettingsSchema,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/settings", tags=["settings"])

LIVE_BASE_URL = "https://api.alpaca.markets"
PAPER_BASE_URL = "https://paper-api.alpaca.markets"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_settings_row(
    db: AsyncSession, user_id: str, category: str
) -> AppSettings | None:
    result = await db.execute(
        select(AppSettings).where(
            AppSettings.user_id == user_id,
            AppSettings.category == category,
        )
    )
    return result.scalar_one_or_none()


async def _upsert_settings(
    db: AsyncSession, user_id: str, category: str, data: dict
) -> AppSettings:
    row = await _get_settings_row(db, user_id, category)
    if row:
        row.settings = data
        row.updated_at = datetime.now(timezone.utc)
    else:
        row = AppSettings(user_id=user_id, category=category, settings=data)
        db.add(row)
    await db.flush()
    return row


def _mask_key(key: str) -> str:
    if not key or len(key) < 8:
        return "****" if key else ""
    return "*" * (len(key) - 4) + key[-4:]


def _build_broker_response(data: dict) -> BrokerSettingsResponse:
    base_url = data.get("base_url", PAPER_BASE_URL)
    return BrokerSettingsResponse(
        alpaca_api_key_masked=_mask_key(data.get("alpaca_api_key", "")),
        alpaca_secret_key_masked=_mask_key(data.get("alpaca_secret_key", "")),
        base_url=base_url,
        is_paper=LIVE_BASE_URL not in base_url,
        is_connected=data.get("is_connected", False),
        last_verified=data.get("last_verified"),
    )


# ---------------------------------------------------------------------------
# GET /settings — all settings
# ---------------------------------------------------------------------------

@router.get("", response_model=AllSettingsResponse)
async def get_all_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    broker_row = await _get_settings_row(db, user.id, "broker")
    notif_row = await _get_settings_row(db, user.id, "notifications")
    display_row = await _get_settings_row(db, user.id, "display")

    broker_data = broker_row.settings if broker_row else {}
    notif_data = notif_row.settings if notif_row else {}
    display_data = display_row.settings if display_row else {}

    return AllSettingsResponse(
        broker=_build_broker_response(broker_data),
        notifications=NotificationSettingsSchema(**notif_data) if notif_data else NotificationSettingsSchema(),
        display=DisplaySettingsSchema(**display_data) if display_data else DisplaySettingsSchema(),
    )


# ---------------------------------------------------------------------------
# PUT /settings/broker
# ---------------------------------------------------------------------------

@router.put("/broker", response_model=BrokerSettingsResponse)
async def update_broker_settings(
    body: BrokerSettingsSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await _get_settings_row(db, user.id, "broker")
    existing_data = existing.settings if existing else {}

    data = {
        "alpaca_api_key": body.alpaca_api_key if body.alpaca_api_key else existing_data.get("alpaca_api_key", ""),
        "alpaca_secret_key": body.alpaca_secret_key if body.alpaca_secret_key else existing_data.get("alpaca_secret_key", ""),
        "base_url": body.base_url,
        "is_connected": existing_data.get("is_connected", False),
        "last_verified": existing_data.get("last_verified"),
    }
    await _upsert_settings(db, user.id, "broker", data)
    logger.info("broker_settings_updated", user_id=user.id)
    return _build_broker_response(data)


# ---------------------------------------------------------------------------
# PUT /settings/notifications
# ---------------------------------------------------------------------------

@router.put("/notifications", response_model=NotificationSettingsSchema)
async def update_notification_settings(
    body: NotificationSettingsSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _upsert_settings(db, user.id, "notifications", body.model_dump())
    logger.info("notification_settings_updated", user_id=user.id)
    return body


# ---------------------------------------------------------------------------
# PUT /settings/display
# ---------------------------------------------------------------------------

@router.put("/display", response_model=DisplaySettingsSchema)
async def update_display_settings(
    body: DisplaySettingsSchema,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _upsert_settings(db, user.id, "display", body.model_dump())
    logger.info("display_settings_updated", user_id=user.id)
    return body


# ---------------------------------------------------------------------------
# POST /settings/broker/test
# ---------------------------------------------------------------------------

@router.post("/broker/test", response_model=BrokerTestResponse)
async def test_broker_connection(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test the saved Alpaca API credentials by calling get_account."""
    row = await _get_settings_row(db, user.id, "broker")
    data = row.settings if row else {}

    api_key = data.get("alpaca_api_key") or app_settings.ALPACA_API_KEY
    secret_key = data.get("alpaca_secret_key") or app_settings.ALPACA_SECRET_KEY
    base_url = data.get("base_url", app_settings.ALPACA_BASE_URL)

    if not api_key or not secret_key:
        return BrokerTestResponse(
            success=False,
            message="API key and secret are required. Please save your credentials first.",
        )

    try:
        from app.alpaca_client import AlpacaClient

        client = AlpacaClient(
            api_key=api_key,
            secret_key=secret_key,
            base_url=base_url,
        )
        account = await client.get_account()

        data["is_connected"] = True
        data["last_verified"] = datetime.now(timezone.utc).isoformat()
        await _upsert_settings(db, user.id, "broker", data)

        return BrokerTestResponse(
            success=True,
            message="Successfully connected to Alpaca",
            account_id=account.get("account_number"),
            equity=account.get("equity"),
            buying_power=account.get("buying_power"),
        )
    except Exception as e:
        logger.warning("broker_test_failed", user_id=user.id, error=str(e))
        if row:
            data["is_connected"] = False
            await _upsert_settings(db, user.id, "broker", data)
        return BrokerTestResponse(success=False, message=str(e))


# ---------------------------------------------------------------------------
# POST /settings/export/trades
# ---------------------------------------------------------------------------

@router.post("/export/trades")
async def export_trades_csv(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Trade).order_by(Trade.timestamp.desc())
    )
    trades = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "bot_id", "symbol", "type", "quantity", "price",
        "timestamp", "profit_loss", "status", "order_id",
        "commission", "slippage", "reason",
    ])
    for t in trades:
        writer.writerow([
            t.id, t.bot_id, t.symbol, t.type, t.quantity, t.price,
            t.timestamp.isoformat() if t.timestamp else "",
            t.profit_loss, t.status, t.order_id,
            t.commission, t.slippage, t.reason,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trades_export.csv"},
    )


# ---------------------------------------------------------------------------
# POST /settings/export/positions
# ---------------------------------------------------------------------------

@router.post("/export/positions")
async def export_positions_csv(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Position).order_by(Position.opened_at.desc())
    )
    positions = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "bot_id", "symbol", "quantity", "entry_price", "current_price",
        "stop_loss_price", "take_profit_price", "unrealized_pnl", "realized_pnl",
        "opened_at", "closed_at", "is_open", "entry_indicator",
    ])
    for p in positions:
        writer.writerow([
            p.id, p.bot_id, p.symbol, p.quantity, p.entry_price, p.current_price,
            p.stop_loss_price, p.take_profit_price, p.unrealized_pnl, p.realized_pnl,
            p.opened_at.isoformat() if p.opened_at else "",
            p.closed_at.isoformat() if p.closed_at else "",
            p.is_open, p.entry_indicator,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=positions_export.csv"},
    )


# ---------------------------------------------------------------------------
# DELETE /settings/trades — clear trade history
# ---------------------------------------------------------------------------

@router.delete("/trades")
async def clear_trade_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(delete(Trade))
    count = result.rowcount
    logger.info("trade_history_cleared", user_id=user.id, deleted=count)
    return {"message": f"Deleted {count} trades", "deleted": count}


# ---------------------------------------------------------------------------
# POST /settings/reset — reset all settings to defaults
# ---------------------------------------------------------------------------

@router.post("/reset")
async def reset_all_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(AppSettings).where(AppSettings.user_id == user.id)
    )
    logger.info("settings_reset", user_id=user.id)
    return {"message": "All settings reset to defaults"}


# ---------------------------------------------------------------------------
# GET /settings/data-stats
# ---------------------------------------------------------------------------

@router.get("/data-stats", response_model=DataStatsResponse)
async def get_data_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bots_count = (await db.execute(select(func.count(Bot.id)))).scalar() or 0
    trades_count = (await db.execute(select(func.count(Trade.id)))).scalar() or 0
    positions_count = (await db.execute(select(func.count(Position.id)))).scalar() or 0
    open_positions = (
        await db.execute(select(func.count(Position.id)).where(Position.is_open == True))
    ).scalar() or 0

    return DataStatsResponse(
        total_bots=bots_count,
        total_trades=trades_count,
        total_positions=positions_count,
        open_positions=open_positions,
    )
