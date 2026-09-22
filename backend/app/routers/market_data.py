"""
Market Data API — market status, per-symbol data, and dashboard summary.

Endpoints:
  GET /api/market-status       → current market open/close status
  GET /api/market-data/{sym}   → market data for a symbol
  GET /api/summary             → dashboard summary statistics
"""

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.alpaca_client import get_alpaca_client
from app.auth import get_current_user
from app.book_control import (
    account_equity,
    book_state,
    default_risk,
    marked_daily_pnl,
    open_stop_risk,
    read_category,
)
from app.database import get_db
from app.exceptions import ExternalServiceError
from app.models import User
from app.schemas import BookSummarySchema, MarketStatusSchema

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["market-data"])


@router.get("/market-status", response_model=MarketStatusSchema)
async def get_market_status():
    """
    Get current market status from Alpaca clock API.
    Falls back to a safe default if the Alpaca client is unavailable.
    """
    client = get_alpaca_client()
    if client is None:
        logger.warning("Alpaca client not configured — returning placeholder market status")
        return MarketStatusSchema(
            is_open=False,
            error="Alpaca API credentials not configured",
        )

    try:
        clock = await client.get_clock()
        return MarketStatusSchema(
            is_open=clock["is_open"],
            next_open=clock["next_open"],
            next_close=clock["next_close"],
            time_until_close=clock["time_until_close"],
        )
    except Exception as e:
        logger.error("Failed to fetch market status from Alpaca: %s", e)
        error_str = str(e)
        if "401" in error_str or "Authorization" in error_str:
            error_msg = "Alpaca API authentication failed — check your API keys"
        else:
            error_msg = "Unable to reach Alpaca API"
        return MarketStatusSchema(
            is_open=False,
            error=error_msg,
        )


@router.get("/market-data/{symbol}")
async def get_market_data(symbol: str):
    """
    Get market data for a specific symbol (latest quote + recent bar).
    Falls back to zeroes if the Alpaca client is unavailable.
    """
    client = get_alpaca_client()
    if client is None:
        logger.warning("Alpaca client not configured — returning placeholder market data")
        return {
            "symbol": symbol.upper(),
            "price": 0.0,
            "bid_price": 0.0,
            "ask_price": 0.0,
            "change": 0.0,
            "change_percent": 0.0,
            "volume": 0,
        }

    try:
        quote = await client.get_latest_quote(symbol.upper())

        # Calculate price and mid-price
        bid = quote["bid_price"]
        ask = quote["ask_price"]
        price = round((bid + ask) / 2, 4) if (bid > 0 and ask > 0) else (ask or bid)

        # Try to get previous close for change calculation
        change = 0.0
        change_percent = 0.0
        try:
            bars = await client.get_bars(symbol.upper(), timeframe="1Day", limit=2)
            if len(bars) >= 2:
                prev_close = bars[-2]["close"]
                current_close = bars[-1]["close"]
                change = round(current_close - prev_close, 2)
                change_percent = round((change / prev_close) * 100, 2) if prev_close > 0 else 0.0
        except Exception:
            # If bar fetch fails, just return 0 change — the quote data is still valid
            pass

        return {
            "symbol": symbol.upper(),
            "price": price,
            "bid_price": bid,
            "ask_price": ask,
            "change": change,
            "change_percent": change_percent,
            "volume": 0,  # Volume not available in latest quote; use bars if needed
        }
    except Exception as e:
        logger.error("market_data_fetch_failed", symbol=symbol, error=str(e))
        raise ExternalServiceError("Alpaca", f"Unable to retrieve market data for {symbol.upper()}")


@router.get("/summary", response_model=BookSummarySchema)
async def get_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Book summary for the dashboard. No bot counts."""
    state = await book_state(db, user.id)
    risk = await read_category(db, user.id, "risk", default_risk())
    equity = await account_equity(user.id)
    marked = await marked_daily_pnl(db, user.id)
    stored_pnl = float(state.get("marked_daily_pnl") or 0)
    if stored_pnl:
        marked = stored_pnl
    if equity:
        marked_pct = marked / equity * 100.0
    else:
        marked_pct = float(state.get("marked_daily_pnl_pct") or 0)
    stop_risk, position_count = await open_stop_risk(db, user.id)
    stop_pct = (stop_risk / equity * 100.0) if equity else 0.0
    throttle = state.get("throttle_stage") or "normal"
    if state.get("locked"):
        throttle = "locked"
    return BookSummarySchema(
        equity=round(equity, 2),
        marked_daily_pnl=round(marked, 2),
        marked_daily_pnl_pct=round(marked_pct, 4),
        daily_lock_pct=float(risk["hard_daily_lock_pct"]),
        throttle_stage=throttle,
        open_stop_risk=round(stop_risk, 2),
        open_stop_risk_pct=round(stop_pct, 4),
        position_count=position_count,
        max_positions=int(risk["max_positions"]),
        regime=state.get("regime"),
        data_freshness={
            "stale": True if state.get("data_stale", True) else False,
            "age_seconds": state.get("data_age_seconds"),
            "feed": "sip",
        },
        kill_switch={
            "halted": bool(state.get("halted")),
            "locked": bool(state.get("locked")),
        },
    )
