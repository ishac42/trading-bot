"""
Market Data API — market status, per-symbol data, and dashboard summary.

Endpoints:
  GET /api/market-status       → current market open/close status
  GET /api/market-data/{sym}   → market data for a symbol
  GET /api/summary             → dashboard summary statistics
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Bot, Position, Trade
from app.schemas import MarketStatusSchema, SummaryStatsSchema

router = APIRouter(tags=["market-data"])


@router.get("/market-status", response_model=MarketStatusSchema)
async def get_market_status():
    """
    Get current market status.
    TODO: Phase 9 — integrate with Alpaca clock API.
    For now returns a placeholder.
    """
    # Placeholder until Alpaca client is integrated
    return MarketStatusSchema(
        is_open=False,
        next_open=None,
        next_close=None,
        time_until_close=None,
    )


@router.get("/market-data/{symbol}")
async def get_market_data(symbol: str):
    """
    Get market data for a specific symbol.
    TODO: Phase 9 — integrate with Alpaca market data API.
    """
    # Placeholder
    return {
        "symbol": symbol,
        "price": 0.0,
        "change": 0.0,
        "change_percent": 0.0,
        "volume": 0,
    }


@router.get("/summary", response_model=SummaryStatsSchema)
async def get_summary(db: AsyncSession = Depends(get_db)):
    """
    Compute dashboard summary statistics from the database.
    Matches frontend SummaryStats interface / mockSummaryStats shape.
    """
    # Total P&L from all trades with profit_loss
    pnl_result = await db.execute(
        select(func.coalesce(func.sum(Trade.profit_loss), 0.0))
        .where(Trade.profit_loss.isnot(None))
    )
    total_pnl = float(pnl_result.scalar())

    # Bot counts by status
    bot_counts = await db.execute(
        select(Bot.status, func.count()).group_by(Bot.status)
    )
    status_counts = {row[0]: row[1] for row in bot_counts}
    active_bots = status_counts.get("running", 0) + status_counts.get("paused", 0)
    paused_bots = status_counts.get("paused", 0)
    stopped_bots = status_counts.get("stopped", 0)

    # Total capital (for percentage calc)
    capital_result = await db.execute(
        select(func.coalesce(func.sum(Bot.capital), 0.0))
    )
    total_capital = float(capital_result.scalar())
    pnl_percentage = (total_pnl / total_capital * 100) if total_capital > 0 else 0.0

    # Open positions count and value
    open_pos_result = await db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(Position.current_price * Position.quantity), 0.0),
        ).where(Position.is_open.is_(True))
    )
    row = open_pos_result.one()
    open_positions = row[0]
    positions_value = float(row[1])

    # Trades today
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    today_count_result = await db.execute(
        select(func.count())
        .select_from(Trade)
        .where(Trade.timestamp >= today_start)
    )
    total_trades_today = today_count_result.scalar() or 0

    # Win rate (from all closed trades)
    closed_count_result = await db.execute(
        select(func.count()).select_from(Trade).where(Trade.profit_loss.isnot(None))
    )
    total_closed = closed_count_result.scalar() or 0

    winning_count_result = await db.execute(
        select(func.count()).select_from(Trade).where(Trade.profit_loss > 0)
    )
    total_winning = winning_count_result.scalar() or 0

    win_rate = (total_winning / total_closed * 100) if total_closed > 0 else 0.0

    return SummaryStatsSchema(
        total_pnl=round(total_pnl, 2),
        pnl_percentage=round(pnl_percentage, 2),
        active_bots=active_bots,
        paused_bots=paused_bots,
        stopped_bots=stopped_bots,
        open_positions=open_positions,
        positions_value=round(positions_value, 2),
        total_trades_today=total_trades_today,
        win_rate=round(win_rate, 1),
    )
