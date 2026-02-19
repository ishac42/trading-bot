"""
Trade Management API — history, filtering, pagination, and statistics.

Endpoints:
  GET /api/trades         → list trades (filtered, sorted, paginated)
  GET /api/trades/stats   → computed trade statistics
  GET /api/trades/{id}    → get a single trade
"""

from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.exceptions import NotFoundError
from app.models import Bot, Trade
from app.schemas import (
    PaginationSchema,
    PnLByBotSchema,
    PnLByDateSchema,
    PnLBySymbolSchema,
    TradeListResponseSchema,
    TradeResponseSchema,
    TradeStatsSchema,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/trades", tags=["trades"])


def _trade_to_response(trade: Trade) -> dict:
    """Convert a Trade ORM model to the response dict with ISO timestamps."""
    return {
        "id": trade.id,
        "bot_id": trade.bot_id,
        "symbol": trade.symbol,
        "type": trade.type,
        "quantity": trade.quantity,
        "price": trade.price,
        "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
        "indicators_snapshot": trade.indicators_snapshot,
        "profit_loss": trade.profit_loss,
        "order_id": trade.order_id,
        "status": trade.status,
        "commission": trade.commission,
        "slippage": trade.slippage,
        "client_order_id": trade.client_order_id,
        "reason": trade.reason,
    }


def _apply_date_filter(query, date_range: str, custom_start: str | None, custom_end: str | None):
    """Apply date range filtering to a query."""
    now = datetime.now(timezone.utc)

    if date_range == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(Trade.timestamp >= start)
    elif date_range == "week":
        start = now - timedelta(days=7)
        query = query.where(Trade.timestamp >= start)
    elif date_range == "month":
        start = now - timedelta(days=30)
        query = query.where(Trade.timestamp >= start)
    elif date_range == "custom":
        if custom_start:
            query = query.where(Trade.timestamp >= datetime.fromisoformat(custom_start))
        if custom_end:
            end = datetime.fromisoformat(custom_end).replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            query = query.where(Trade.timestamp <= end)
    # 'all' — no date filter

    return query


def _apply_common_filters(query, bot_id: str, symbol: str, trade_type: str):
    """Apply bot, symbol, and type filters."""
    if bot_id:
        query = query.where(Trade.bot_id == bot_id)
    if symbol:
        query = query.where(Trade.symbol == symbol)
    if trade_type and trade_type != "all":
        query = query.where(Trade.type == trade_type)
    return query


# Map frontend sort field names to ORM columns
SORT_FIELD_MAP = {
    "timestamp": Trade.timestamp,
    "symbol": Trade.symbol,
    "type": Trade.type,
    "quantity": Trade.quantity,
    "price": Trade.price,
    "profit_loss": Trade.profit_loss,
}


@router.get("/stats", response_model=TradeStatsSchema)
async def get_trade_stats(
    dateRange: str = Query("all"),
    customStartDate: str | None = Query(None),
    customEndDate: str | None = Query(None),
    botId: str = Query(""),
    symbol: str = Query(""),
    type: str = Query("all"),
    db: AsyncSession = Depends(get_db),
):
    """Compute trade statistics matching frontend TradeStats interface."""
    # Build base query
    query = select(Trade)
    query = _apply_date_filter(query, dateRange, customStartDate, customEndDate)
    query = _apply_common_filters(query, botId, symbol, type)

    result = await db.execute(query)
    all_trades = list(result.scalars().all())

    # Closed trades (have profit_loss)
    closed = [t for t in all_trades if t.profit_loss is not None]
    winning = [t for t in closed if t.profit_loss > 0]
    losing = [t for t in closed if t.profit_loss < 0]

    total_pnl = sum(t.profit_loss for t in closed)
    avg_pnl = total_pnl / len(closed) if closed else 0
    win_rate = (len(winning) / len(closed) * 100) if closed else 0

    pnl_values = [t.profit_loss for t in closed]
    best_trade = max(pnl_values) if pnl_values else 0
    worst_trade = min(pnl_values) if pnl_values else 0

    avg_win = (sum(t.profit_loss for t in winning) / len(winning)) if winning else 0
    avg_loss = abs(sum(t.profit_loss for t in losing) / len(losing)) if losing else 0

    total_wins = sum(t.profit_loss for t in winning)
    total_losses = abs(sum(t.profit_loss for t in losing))
    profit_factor = (total_wins / total_losses) if total_losses > 0 else (999.99 if total_wins > 0 else 0)

    # P&L by date (cumulative)
    date_map: dict[str, float] = {}
    sorted_closed = sorted(closed, key=lambda t: t.timestamp)
    for trade in sorted_closed:
        date_str = trade.timestamp.strftime("%Y-%m-%d")
        date_map[date_str] = date_map.get(date_str, 0) + trade.profit_loss

    cumulative = 0.0
    pnl_by_date = []
    for date_str, pnl in date_map.items():
        cumulative += pnl
        pnl_by_date.append(PnLByDateSchema(
            date=date_str,
            pnl=round(pnl, 2),
            cumulativePnl=round(cumulative, 2),
        ))

    # P&L by symbol
    symbol_map: dict[str, dict] = {}
    for trade in closed:
        entry = symbol_map.setdefault(trade.symbol, {"pnl": 0, "trades": 0, "wins": 0})
        entry["pnl"] += trade.profit_loss
        entry["trades"] += 1
        if trade.profit_loss > 0:
            entry["wins"] += 1

    pnl_by_symbol = [
        PnLBySymbolSchema(
            symbol=sym,
            pnl=round(data["pnl"], 2),
            trades=data["trades"],
            winRate=round(data["wins"] / data["trades"] * 100) if data["trades"] > 0 else 0,
        )
        for sym, data in symbol_map.items()
    ]

    # P&L by bot (need bot names)
    bot_map: dict[str, dict] = {}
    for trade in closed:
        entry = bot_map.setdefault(trade.bot_id, {"pnl": 0, "trades": 0, "wins": 0})
        entry["pnl"] += trade.profit_loss
        entry["trades"] += 1
        if trade.profit_loss > 0:
            entry["wins"] += 1

    # Fetch bot names
    bot_ids = list(bot_map.keys())
    bot_names: dict[str, str] = {}
    if bot_ids:
        bot_result = await db.execute(select(Bot.id, Bot.name).where(Bot.id.in_(bot_ids)))
        for row in bot_result:
            bot_names[row[0]] = row[1]

    pnl_by_bot = [
        PnLByBotSchema(
            botId=bid,
            botName=bot_names.get(bid, "Unknown Bot"),
            pnl=round(data["pnl"], 2),
            trades=data["trades"],
            winRate=round(data["wins"] / data["trades"] * 100) if data["trades"] > 0 else 0,
        )
        for bid, data in bot_map.items()
    ]

    return TradeStatsSchema(
        totalTrades=len(all_trades),
        winningTrades=len(winning),
        losingTrades=len(losing),
        winRate=round(win_rate, 1),
        totalPnL=round(total_pnl, 2),
        avgPnL=round(avg_pnl, 2),
        bestTrade=round(best_trade, 2),
        worstTrade=round(worst_trade, 2),
        avgWin=round(avg_win, 2),
        avgLoss=round(avg_loss, 2),
        profitFactor=round(profit_factor, 2),
        pnlByDate=pnl_by_date,
        pnlBySymbol=pnl_by_symbol,
        pnlByBot=pnl_by_bot,
    )


@router.get("", response_model=TradeListResponseSchema)
async def get_trades(
    dateRange: str = Query("all"),
    customStartDate: str | None = Query(None),
    customEndDate: str | None = Query(None),
    botId: str = Query(""),
    symbol: str = Query(""),
    type: str = Query("all"),
    sortField: str = Query("timestamp"),
    sortDirection: str = Query("desc"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100000),
    db: AsyncSession = Depends(get_db),
):
    """List trades with filtering, sorting, and pagination."""
    # Base query
    query = select(Trade)
    query = _apply_date_filter(query, dateRange, customStartDate, customEndDate)
    query = _apply_common_filters(query, botId, symbol, type)

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_items = (await db.execute(count_query)).scalar() or 0

    # Sorting
    sort_col = SORT_FIELD_MAP.get(sortField, Trade.timestamp)
    if sortDirection == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    # Pagination
    offset = (page - 1) * pageSize
    query = query.offset(offset).limit(pageSize)

    result = await db.execute(query)
    trades = result.scalars().all()

    total_pages = max(1, -(-total_items // pageSize))  # Ceiling division

    return TradeListResponseSchema(
        trades=[_trade_to_response(t) for t in trades],
        pagination=PaginationSchema(
            page=page,
            pageSize=pageSize,
            totalItems=total_items,
            totalPages=total_pages,
        ),
    )


@router.get("/{trade_id}", response_model=TradeResponseSchema)
async def get_trade(trade_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single trade by ID."""
    trade = await db.get(Trade, trade_id)
    if not trade:
        raise NotFoundError("Trade", trade_id)
    return _trade_to_response(trade)
