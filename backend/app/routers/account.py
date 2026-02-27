"""
Account API — Alpaca account info, capital allocation, and reconciliation.

Endpoints:
  GET /api/account            → account info with capital breakdown
  GET /api/account/reconcile  → compare local trades with Alpaca orders
"""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alpaca_client import get_alpaca_client
from app.auth import get_current_user
from app.database import get_db
from app.models import Bot, Position, Trade, User
from app.reconciler import reconciler

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["account"])


async def get_allocated_capital(
    db: AsyncSession,
    user_id: str,
    exclude_bot_id: str | None = None,
) -> float:
    """
    Sum of capital across the given user's bots. Used to compute available capital.
    Optionally exclude a specific bot (for update validation).
    """
    query = select(func.coalesce(func.sum(Bot.capital), 0.0)).where(
        Bot.user_id == user_id
    )
    if exclude_bot_id:
        query = query.where(Bot.id != exclude_bot_id)
    result = await db.execute(query)
    return float(result.scalar())


async def get_total_realized_gains(db: AsyncSession, user_id: str) -> float:
    """Sum of realized_pnl from this user's closed positions."""
    result = await db.execute(
        select(func.coalesce(func.sum(Position.realized_pnl), 0.0))
        .join(Bot)
        .where(Position.is_open.is_(False), Bot.user_id == user_id)
    )
    return float(result.scalar())


async def get_bot_realized_gains(db: AsyncSession, bot_id: str) -> float:
    """Sum of realized_pnl from closed positions for a specific bot."""
    result = await db.execute(
        select(func.coalesce(func.sum(Position.realized_pnl), 0.0))
        .where(Position.bot_id == bot_id, Position.is_open.is_(False))
    )
    return float(result.scalar())


@router.get("/account")
async def get_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get Alpaca account info enriched with capital allocation data.

    Returns account-level financials from Alpaca plus:
    - allocated_capital: sum of user's bots' capital
    - available_capital: buying_power - allocated_capital
    - total_realized_gains: sum of realized P&L from user's closed positions
    """
    allocated = await get_allocated_capital(db, user_id=user.id)
    realized = round(await get_total_realized_gains(db, user_id=user.id), 2)

    client = get_alpaca_client(user_id=user.id)
    if not client:
        logger.warning("Alpaca client not configured — returning DB-only account info")
        return {
            "account_number": None,
            "equity": 0.0,
            "cash": 0.0,
            "buying_power": 0.0,
            "portfolio_value": 0.0,
            "allocated_capital": round(allocated, 2),
            "available_capital": 0.0,
            "total_realized_gains": realized,
        }

    try:
        account = await client.get_account()
        buying_power = account["buying_power"]
        available = buying_power - allocated

        return {
            "account_number": account["account_number"],
            "equity": round(account["equity"], 2),
            "cash": round(account["cash"], 2),
            "buying_power": round(buying_power, 2),
            "portfolio_value": round(account["portfolio_value"], 2),
            "allocated_capital": round(allocated, 2),
            "available_capital": round(available, 2),
            "total_realized_gains": realized,
        }
    except Exception as e:
        logger.error("Failed to fetch Alpaca account: %s", e)
        return {
            "account_number": None,
            "equity": 0.0,
            "cash": 0.0,
            "buying_power": 0.0,
            "portfolio_value": 0.0,
            "allocated_capital": round(allocated, 2),
            "available_capital": 0.0,
            "total_realized_gains": realized,
        }


@router.get("/account/reconcile")
async def reconcile(
    limit: int = Query(100, ge=1, le=500),
    auto_fix: bool = Query(False),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compare local Trade records against Alpaca's closed orders.

    When auto_fix=true, also runs the full position reconciler which
    resolves pending trades and auto-closes stale DB positions.

    Returns:
      - synced_count: orders that match between DB and Alpaca
      - discrepancies: list of issues found
      - last_checked: ISO timestamp of this check
      - reconciliation: (only when auto_fix=true) actions taken by reconciler
    """
    client = get_alpaca_client(user_id=user.id)
    if not client:
        return {
            "synced_count": 0,
            "discrepancies": [],
            "last_checked": datetime.now(timezone.utc).isoformat(),
            "error": "Alpaca client not configured",
        }

    try:
        alpaca_orders = await client.get_orders(status="closed", limit=limit)
    except Exception as e:
        logger.error("Reconcile: failed to fetch Alpaca orders: %s", e)
        return {
            "synced_count": 0,
            "discrepancies": [{"type": "fetch_error", "detail": str(e)}],
            "last_checked": datetime.now(timezone.utc).isoformat(),
        }

    # Build lookup maps from Alpaca orders
    alpaca_by_order_id: dict[str, dict] = {}
    alpaca_by_client_id: dict[str, dict] = {}
    for order in alpaca_orders:
        oid = order.get("id")
        coid = order.get("client_order_id")
        if oid:
            alpaca_by_order_id[oid] = order
        if coid:
            alpaca_by_client_id[coid] = order

    # Fetch our DB trades that might match these orders
    all_order_ids = [o["id"] for o in alpaca_orders if o.get("id")]
    all_client_ids = [o["client_order_id"] for o in alpaca_orders if o.get("client_order_id")]

    conditions = []
    if all_order_ids:
        conditions.append(Trade.order_id.in_(all_order_ids))
    if all_client_ids:
        conditions.append(Trade.client_order_id.in_(all_client_ids))

    if conditions:
        result = await db.execute(
            select(Trade).join(Bot).where(Bot.user_id == user.id, or_(*conditions))
        )
        db_trades = result.scalars().all()
    else:
        db_trades = []

    matched_alpaca_ids: set[str] = set()
    synced_count = 0
    discrepancies: list[dict] = []

    for trade in db_trades:
        # Try to match by order_id first, then by client_order_id
        alpaca_order = None
        if trade.order_id and trade.order_id in alpaca_by_order_id:
            alpaca_order = alpaca_by_order_id[trade.order_id]
        elif trade.client_order_id and trade.client_order_id in alpaca_by_client_id:
            alpaca_order = alpaca_by_client_id[trade.client_order_id]

        if not alpaca_order:
            discrepancies.append({
                "type": "missing_in_alpaca",
                "trade_id": trade.id,
                "order_id": trade.order_id,
                "client_order_id": trade.client_order_id,
                "symbol": trade.symbol,
                "detail": "Trade exists in DB but no matching Alpaca order found",
            })
            continue

        matched_alpaca_ids.add(alpaca_order["id"])

        # Status mismatch
        alpaca_status = alpaca_order.get("status", "")
        if trade.status != alpaca_status:
            discrepancies.append({
                "type": "status_mismatch",
                "trade_id": trade.id,
                "order_id": trade.order_id,
                "symbol": trade.symbol,
                "db_status": trade.status,
                "alpaca_status": alpaca_status,
                "detail": f"DB says '{trade.status}', Alpaca says '{alpaca_status}'",
            })
            continue

        # Price mismatch (only for filled orders)
        alpaca_fill_price = alpaca_order.get("filled_avg_price")
        if (
            alpaca_status == "filled"
            and alpaca_fill_price is not None
            and abs(trade.price - alpaca_fill_price) > 0.01
        ):
            discrepancies.append({
                "type": "price_mismatch",
                "trade_id": trade.id,
                "order_id": trade.order_id,
                "symbol": trade.symbol,
                "db_price": trade.price,
                "alpaca_price": alpaca_fill_price,
                "detail": f"DB price ${trade.price:.2f} vs Alpaca fill ${alpaca_fill_price:.2f}",
            })
            continue

        synced_count += 1

    # Check for Alpaca orders missing from our DB (only filled ones with client_order_id)
    for order in alpaca_orders:
        if order["id"] in matched_alpaca_ids:
            continue
        if order.get("status") != "filled":
            continue
        coid = order.get("client_order_id", "")
        if coid and coid.startswith("bot-"):
            discrepancies.append({
                "type": "missing_in_db",
                "order_id": order["id"],
                "client_order_id": coid,
                "symbol": order.get("symbol"),
                "detail": "Filled Alpaca order with bot client_order_id not found in DB",
            })

    result = {
        "synced_count": synced_count,
        "discrepancies": discrepancies,
        "last_checked": datetime.now(timezone.utc).isoformat(),
    }

    if auto_fix:
        client = get_alpaca_client(user_id=user.id)
        if client:
            try:
                recon = await reconciler.full_reconciliation()
                result["reconciliation"] = recon
            except Exception as e:
                logger.error("Auto-fix reconciliation failed: %s", e)
                result["reconciliation"] = {"error": str(e)}

    return result
