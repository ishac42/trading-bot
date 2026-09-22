"""
Book control plane: settings defaults, cap checks, universe snapshots, and
flatten / lock / unlock. Nothing here submits a strategy order.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alpaca_client import get_alpaca_client
from app.exceptions import ExternalServiceError, ValidationError
from app.models import AppSettings, Bot, Position, RiskEvent, UniverseSnapshot, utcnow

logger = structlog.get_logger(__name__)

# Liquid names screened by REST until the SIP stream replaces this source.
LIQUID_NAMES = (
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "AVGO", "JPM",
)

BOOK_CATEGORY = "book"


def default_universe() -> dict[str, Any]:
    return {"top_n": 75, "min_price": 5.0, "max_spread_bps": 12.0}


def default_session() -> dict[str, Any]:
    return {"rth_enabled": True, "extended_hours": False}


def default_feed() -> dict[str, Any]:
    return {"primary": "sip", "iex_diagnostic": False}


def default_risk() -> dict[str, Any]:
    return {
        "risk_per_trade_pct": 0.25,
        "max_open_stop_risk_pct": 0.75,
        "soft_throttle_pct": -1.0,
        "stop_new_risk_pct": -1.5,
        "hard_daily_lock_pct": -2.0,
        "max_positions": 3,
        "single_name_notional_pct": 25.0,
        "min_score": 70,
        "min_target_r": 1.5,
        "cost_multiple": 3.0,
    }


def default_mode() -> dict[str, Any]:
    return {"mode": "paper"}


def default_fee() -> dict[str, Any]:
    return {"version": "", "refreshed_at": "", "source": "", "account_id": None}


def default_book_state() -> dict[str, Any]:
    return {
        "halted": False,
        "locked": False,
        "throttle_stage": "normal",
        "marked_daily_pnl": 0.0,
        "marked_daily_pnl_pct": 0.0,
        "regime": None,
        "data_stale": True,
        "data_age_seconds": None,
    }


def default_bot_stats() -> dict[str, Any]:
    return {
        "marked_pnl": 0.0,
        "marked_pnl_pct": 0.0,
        "trade_count": 0,
        "win_rate": 0.0,
        "expectancy": 0.0,
        "veto_count": 0,
    }


def empty_snapshot(filters: dict[str, Any]) -> dict[str, Any]:
    return {"as_of": None, "filters": dict(filters), "members": []}


async def read_category(
    db: AsyncSession, user_id: str, category: str, default: dict[str, Any]
) -> dict[str, Any]:
    result = await db.execute(
        select(AppSettings).where(
            AppSettings.user_id == user_id,
            AppSettings.category == category,
        )
    )
    row = result.scalar_one_or_none()
    if row is None or not row.settings:
        return dict(default)
    merged = dict(default)
    merged.update(row.settings)
    return merged


async def write_category(
    db: AsyncSession, user_id: str, category: str, data: dict[str, Any]
) -> None:
    result = await db.execute(
        select(AppSettings).where(
            AppSettings.user_id == user_id,
            AppSettings.category == category,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.settings = data
        row.updated_at = datetime.now(timezone.utc)
    else:
        db.add(AppSettings(user_id=user_id, category=category, settings=data))
    await db.flush()


async def book_state(db: AsyncSession, user_id: str) -> dict[str, Any]:
    return await read_category(db, user_id, BOOK_CATEGORY, default_book_state())


def filter_members(members: list[dict[str, Any]], filters: dict[str, Any]) -> list[dict[str, Any]]:
    kept = [
        member for member in members
        if float(member.get("price") or 0) >= float(filters["min_price"])
        and float(member.get("spread_bps") or 0) <= float(filters["max_spread_bps"])
    ]
    kept.sort(key=lambda member: float(member.get("dollar_volume") or 0), reverse=True)
    return kept[: int(filters["top_n"])]


def _spread_bps(bid: float, ask: float, price: float) -> float:
    if price <= 0 or ask <= 0 or bid <= 0 or ask < bid:
        return 10_000.0
    return (ask - bid) / price * 10_000.0


async def build_universe_snapshot(
    user_id: str, filters: dict[str, Any]
) -> list[dict[str, Any]]:
    """
    REST screen of liquid names. The stream path replaces this function,
    not the universe_snapshots table.
    """
    client = get_alpaca_client(user_id)
    if client is None:
        return []

    members: list[dict[str, Any]] = []
    for symbol in LIQUID_NAMES:
        try:
            quote = await client.get_latest_quote(symbol)
            price = float(await client.get_latest_price(symbol) or 0)
            bid = float(quote.get("bid_price") or 0)
            ask = float(quote.get("ask_price") or 0)
            if price <= 0:
                price = (bid + ask) / 2 if bid and ask else 0
            dollar_volume = 0.0
            try:
                bars = await client.get_bars(symbol, timeframe="1Day", limit=1)
                if bars:
                    dollar_volume = float(bars[-1].get("close") or price) * float(bars[-1].get("volume") or 0)
            except Exception:
                dollar_volume = 0.0
            member = {
                "symbol": symbol,
                "price": round(price, 4),
                "dollar_volume": round(dollar_volume, 2),
                "spread_bps": round(_spread_bps(bid, ask, price), 4),
            }
            members.append(member)
        except Exception as exc:
            logger.warning("universe_quote_skipped", symbol=symbol, error=str(exc))
    return filter_members(members, filters)


async def store_snapshot(
    db: AsyncSession,
    user_id: str,
    filters: dict[str, Any],
    members: list[dict[str, Any]],
) -> UniverseSnapshot:
    row = UniverseSnapshot(
        user_id=user_id,
        as_of=utcnow(),
        filters=dict(filters),
        members=members,
    )
    db.add(row)
    await db.flush()
    return row


def snapshot_payload(row: UniverseSnapshot | None, filters: dict[str, Any]) -> dict[str, Any]:
    if row is None:
        return empty_snapshot(filters)
    return {
        "as_of": row.as_of.isoformat() if row.as_of else None,
        "filters": row.filters or dict(filters),
        "members": row.members or [],
    }


async def latest_snapshot(db: AsyncSession, user_id: str) -> UniverseSnapshot | None:
    result = await db.execute(
        select(UniverseSnapshot)
        .where(UniverseSnapshot.user_id == user_id)
        .order_by(UniverseSnapshot.as_of.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def refresh_bot_snapshots(
    db: AsyncSession, user_id: str, snapshot: dict[str, Any]
) -> None:
    result = await db.execute(select(Bot).where(Bot.user_id == user_id))
    for bot in result.scalars():
        profile = dict(bot.profile or {})
        if not profile:
            continue
        filters = profile.get("universe") or default_universe()
        profile["snapshot"] = {
            "as_of": snapshot.get("as_of"),
            "filters": dict(filters),
            "members": filter_members(list(snapshot.get("members") or []), filters),
        }
        bot.profile = profile
    await db.flush()


def clamp_bot_risk(risk: dict[str, Any], book_risk: dict[str, Any]) -> dict[str, Any]:
    """Pull a sleeve back inside the book ceiling. Used when the book is tightened."""
    lock = float(book_risk["hard_daily_lock_pct"])
    sleeve = float(risk["sleeve_loss_limit_pct"])
    if sleeve < lock:
        sleeve = lock
    if sleeve > -0.1:
        sleeve = -0.1
    return {
        "risk_per_trade_pct": min(float(risk["risk_per_trade_pct"]), float(book_risk["risk_per_trade_pct"])),
        "max_open_stop_risk_pct": min(
            float(risk["max_open_stop_risk_pct"]), float(book_risk["max_open_stop_risk_pct"])
        ),
        "max_positions": min(int(risk["max_positions"]), int(book_risk["max_positions"])),
        "single_name_notional_pct": min(
            float(risk["single_name_notional_pct"]), float(book_risk["single_name_notional_pct"])
        ),
        "min_score": max(int(risk["min_score"]), int(book_risk["min_score"])),
        "min_target_r": max(float(risk["min_target_r"]), float(book_risk["min_target_r"])),
        "cost_multiple": max(float(risk["cost_multiple"]), float(book_risk["cost_multiple"])),
        "sleeve_loss_limit_pct": sleeve,
    }


def assert_bot_risk_within_book(risk: dict[str, Any], book_risk: dict[str, Any]) -> None:
    """Reject a sleeve that asks for more than the book currently allows."""
    checks = (
        ("risk_per_trade_pct", float(risk["risk_per_trade_pct"]) > float(book_risk["risk_per_trade_pct"])),
        ("max_open_stop_risk_pct", float(risk["max_open_stop_risk_pct"]) > float(book_risk["max_open_stop_risk_pct"])),
        ("max_positions", int(risk["max_positions"]) > int(book_risk["max_positions"])),
        (
            "single_name_notional_pct",
            float(risk["single_name_notional_pct"]) > float(book_risk["single_name_notional_pct"]),
        ),
        ("min_score", int(risk["min_score"]) < int(book_risk["min_score"])),
        ("min_target_r", float(risk["min_target_r"]) < float(book_risk["min_target_r"])),
        ("cost_multiple", float(risk["cost_multiple"]) < float(book_risk["cost_multiple"])),
    )
    loose = [name for name, failed in checks if failed]
    sleeve = float(risk["sleeve_loss_limit_pct"])
    lock = float(book_risk["hard_daily_lock_pct"])
    if sleeve < lock or sleeve > -0.1:
        loose.append("sleeve_loss_limit_pct")
    if loose:
        raise ValidationError(
            "Bot risk is looser than the book caps",
            details={"fields": loose},
        )


async def clamp_stored_bot_risk(db: AsyncSession, user_id: str, book_risk: dict[str, Any]) -> None:
    result = await db.execute(select(Bot).where(Bot.user_id == user_id))
    for bot in result.scalars():
        profile = dict(bot.profile or {})
        if not profile or "risk" not in profile:
            continue
        profile["risk"] = clamp_bot_risk(profile["risk"], book_risk)
        bot.profile = profile
    await db.flush()


async def record_risk_event(
    db: AsyncSession,
    user_id: str,
    kind: str,
    reason_code: str,
    payload: dict[str, Any],
) -> RiskEvent:
    row = RiskEvent(
        user_id=user_id,
        kind=kind,
        reason_code=reason_code,
        payload=payload,
    )
    db.add(row)
    await db.flush()
    return row


async def marked_daily_pnl(db: AsyncSession, user_id: str) -> float:
    """Realized today plus open unrealized. Liquidation cost stays 0 until the runtime prices it."""
    from sqlalchemy import func

    from app.models import Trade

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    realized_result = await db.execute(
        select(func.coalesce(func.sum(Trade.profit_loss), 0.0))
        .join(Bot, Trade.bot_id == Bot.id)
        .where(
            Bot.user_id == user_id,
            Trade.profit_loss.isnot(None),
            Trade.timestamp >= today,
        )
    )
    unrealized_result = await db.execute(
        select(func.coalesce(func.sum(Position.unrealized_pnl), 0.0))
        .join(Bot, Position.bot_id == Bot.id)
        .where(Bot.user_id == user_id, Position.is_open.is_(True))
    )
    realized = float(realized_result.scalar() or 0)
    unrealized = float(unrealized_result.scalar() or 0)
    return realized + unrealized


async def open_stop_risk(db: AsyncSession, user_id: str) -> tuple[float, int]:
    from sqlalchemy import func

    result = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(Position.open_stop_risk), 0.0),
        )
        .join(Bot, Position.bot_id == Bot.id)
        .where(Bot.user_id == user_id, Position.is_open.is_(True))
    )
    count, risk = result.one()
    return float(risk or 0), int(count or 0)


async def account_equity(user_id: str) -> float:
    client = get_alpaca_client(user_id)
    if client is None:
        return 0.0
    try:
        account = await client.get_account()
        return float(account.get("equity") or 0)
    except Exception as exc:
        logger.warning("book_equity_unavailable", error=str(exc))
        return 0.0


def effective_loss_pct(stored_pct: float, marked_pnl: float, equity: float) -> float:
    computed = (marked_pnl / equity * 100.0) if equity else 0.0
    return min(float(stored_pct), computed)


async def flatten_broker(user_id: str) -> dict[str, int]:
    """Cancel open entry orders and close broker positions. No-op when the user has no client."""
    client = get_alpaca_client(user_id)
    if client is None:
        return {"orders_cancelled": 0, "positions_closed": 0}
    try:
        orders = await client.get_orders(status="open")
        cancelled = 0
        for order in orders:
            side = str(order.get("side") or "").lower()
            if "buy" in side:
                await client.cancel_order(order["id"])
                cancelled += 1
        positions = await client.get_positions()
        for position in positions:
            symbol = position.get("symbol")
            if symbol:
                await client.close_position(symbol)
        return {"orders_cancelled": cancelled, "positions_closed": len(positions)}
    except Exception as exc:
        raise ExternalServiceError("Alpaca", f"Flatten failed: {exc}") from exc


async def close_db_positions(db: AsyncSession, user_id: str) -> int:
    result = await db.execute(
        select(Position)
        .join(Bot, Position.bot_id == Bot.id)
        .where(Bot.user_id == user_id, Position.is_open.is_(True))
    )
    rows = list(result.scalars())
    now = utcnow()
    for position in rows:
        position.is_open = False
        position.closed_at = now
        position.realized_pnl = float(position.realized_pnl or 0) + float(position.unrealized_pnl or 0)
        position.unrealized_pnl = 0
        position.open_stop_risk = 0
    await db.flush()
    return len(rows)


async def fee_snapshot_from_broker(user_id: str) -> dict[str, Any]:
    """Store a broker timestamp. Do not invent a commission the broker did not return."""
    client = get_alpaca_client(user_id)
    if client is None:
        raise ExternalServiceError("Alpaca", "No broker client is configured for this user")
    try:
        account = await client.get_account()
    except Exception as exc:
        raise ExternalServiceError("Alpaca", f"Fee refresh failed: {exc}") from exc
    refreshed = datetime.now(timezone.utc).isoformat()
    return {
        "version": refreshed,
        "refreshed_at": refreshed,
        "source": "alpaca",
        "account_id": account.get("id"),
    }
