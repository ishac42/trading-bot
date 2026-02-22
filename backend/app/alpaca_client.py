"""
Alpaca API client wrapper.

Provides a unified async interface to the Alpaca Trading API and Market Data API.
Supports:
  - Account information
  - Order submission / status / cancellation
  - Position retrieval / closing
  - Market clock (open/close/next times)
  - Latest quotes and historical bars
  - Real-time market data streaming (via StockDataStream)

All public methods are async. Sync alpaca-py calls are dispatched to a
thread pool via asyncio.to_thread() so they never block the event loop.

Safety:
  - Defaults to paper trading; live trading requires explicit configuration.
  - Refuses to initialize if base URL points to live and ENVIRONMENT != 'production'.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Any, Callable

import structlog

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import (
    GetOrdersRequest,
    MarketOrderRequest,
    LimitOrderRequest,
)
from alpaca.trading.enums import OrderSide, TimeInForce, OrderStatus, QueryOrderStatus
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import (
    StockBarsRequest,
    StockLatestQuoteRequest,
)
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

from app.config import settings

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

LIVE_BASE_URL = "https://api.alpaca.markets"
PAPER_BASE_URL = "https://paper-api.alpaca.markets"

# Map string timeframes used by the trading engine to alpaca-py TimeFrame objects
TIMEFRAME_MAP: dict[str, TimeFrame] = {
    "1Min": TimeFrame.Minute,
    "5Min": TimeFrame(5, TimeFrameUnit.Minute),
    "15Min": TimeFrame(15, TimeFrameUnit.Minute),
    "1Hour": TimeFrame.Hour,
    "1Day": TimeFrame.Day,
}


# ---------------------------------------------------------------------------
# AlpacaClient
# ---------------------------------------------------------------------------

class AlpacaClient:
    """
    Async wrapper around the Alpaca Trading and Market Data APIs.

    Usage:
        client = AlpacaClient()
        account = await client.get_account()
        clock = await client.get_clock()
    """

    def __init__(
        self,
        api_key: str | None = None,
        secret_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._api_key = api_key or settings.ALPACA_API_KEY
        self._secret_key = secret_key or settings.ALPACA_SECRET_KEY
        self._base_url = base_url or settings.ALPACA_BASE_URL

        if not self._api_key or not self._secret_key:
            raise ValueError(
                "Alpaca API credentials are required. "
                "Set ALPACA_API_KEY and ALPACA_SECRET_KEY in your .env file."
            )

        # Safety: refuse live trading unless environment is explicitly 'production'
        self._is_paper = LIVE_BASE_URL not in self._base_url
        if not self._is_paper and settings.ENVIRONMENT != "production":
            raise RuntimeError(
                "DANGER: Alpaca base URL points to LIVE trading but ENVIRONMENT "
                f"is '{settings.ENVIRONMENT}'. Set ENVIRONMENT=production to allow live trading."
            )

        # Trading client (orders, account, positions, clock)
        self._trading_client = TradingClient(
            api_key=self._api_key,
            secret_key=self._secret_key,
            paper=self._is_paper,
        )

        # Market data client (quotes, bars)
        self._data_client = StockHistoricalDataClient(
            api_key=self._api_key,
            secret_key=self._secret_key,
        )

        # Feed: 'iex' for free tier, 'sip' for paid Algo Trader Plus
        self._data_feed = "iex"

        logger.info(
            "Alpaca client initialized (paper=%s, feed=%s)",
            self._is_paper,
            self._data_feed,
        )

    # -----------------------------------------------------------------------
    # Account
    # -----------------------------------------------------------------------

    async def get_account(self) -> dict[str, Any]:
        """Get account information (buying power, equity, etc.)."""
        try:
            account = await asyncio.to_thread(self._trading_client.get_account)
            return {
                "id": str(account.id),
                "account_number": str(account.account_number) if account.account_number else str(account.id),
                "status": str(account.status),
                "buying_power": float(account.buying_power),
                "equity": float(account.equity),
                "cash": float(account.cash),
                "portfolio_value": float(account.portfolio_value),
                "currency": account.currency,
                "pattern_day_trader": account.pattern_day_trader,
                "daytrade_count": account.daytrade_count,
            }
        except Exception as e:
            logger.error("Failed to get account: %s", e)
            raise

    # -----------------------------------------------------------------------
    # Orders
    # -----------------------------------------------------------------------

    async def submit_market_order(
        self,
        symbol: str,
        qty: int,
        side: str,
        time_in_force: str = "day",
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Submit a market order.

        Args:
            symbol: Stock symbol (e.g. 'AAPL')
            qty: Number of shares
            side: 'buy' or 'sell'
            time_in_force: 'day', 'gtc', 'ioc', 'fok'
            client_order_id: Optional client-side order ID for tracking

        Returns:
            Dict with order details (id, status, filled_qty, etc.)
        """
        try:
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = self._parse_time_in_force(time_in_force)

            request = MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=tif,
                client_order_id=client_order_id,
            )
            order = await asyncio.to_thread(self._trading_client.submit_order, request)
            result = self._order_to_dict(order)
            logger.info(
                "Submitted market order: %s %s x%d → order_id=%s",
                side, symbol, qty, result["id"],
            )
            return result
        except Exception as e:
            logger.error("Failed to submit market order (%s %s x%d): %s", side, symbol, qty, e)
            raise

    async def submit_limit_order(
        self,
        symbol: str,
        qty: int,
        side: str,
        limit_price: float,
        time_in_force: str = "day",
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        """Submit a limit order."""
        try:
            order_side = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
            tif = self._parse_time_in_force(time_in_force)

            request = LimitOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=tif,
                limit_price=limit_price,
                client_order_id=client_order_id,
            )
            order = await asyncio.to_thread(self._trading_client.submit_order, request)
            result = self._order_to_dict(order)
            logger.info(
                "Submitted limit order: %s %s x%d @ %.2f → order_id=%s",
                side, symbol, qty, limit_price, result["id"],
            )
            return result
        except Exception as e:
            logger.error(
                "Failed to submit limit order (%s %s x%d @ %.2f): %s",
                side, symbol, qty, limit_price, e,
            )
            raise

    async def get_order(self, order_id: str) -> dict[str, Any]:
        """Get order status by ID."""
        try:
            order = await asyncio.to_thread(
                self._trading_client.get_order_by_id, order_id
            )
            return self._order_to_dict(order)
        except Exception as e:
            logger.error("Failed to get order %s: %s", order_id, e)
            raise

    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel an open order."""
        try:
            await asyncio.to_thread(self._trading_client.cancel_order_by_id, order_id)
            logger.info("Cancelled order: %s", order_id)
            return {"order_id": order_id, "cancelled": True}
        except Exception as e:
            logger.error("Failed to cancel order %s: %s", order_id, e)
            raise

    async def get_orders(
        self, status: str = "open", limit: int = 50
    ) -> list[dict[str, Any]]:
        """Get recent orders filtered by status."""
        try:
            query_status = {
                "open": QueryOrderStatus.OPEN,
                "closed": QueryOrderStatus.CLOSED,
                "all": QueryOrderStatus.ALL,
            }.get(status, QueryOrderStatus.ALL)

            request = GetOrdersRequest(status=query_status, limit=limit)
            orders = await asyncio.to_thread(
                self._trading_client.get_orders, request
            )
            return [self._order_to_dict(o) for o in orders]
        except Exception as e:
            logger.error("Failed to get orders (status=%s): %s", status, e)
            raise

    # -----------------------------------------------------------------------
    # Positions
    # -----------------------------------------------------------------------

    async def get_positions(self) -> list[dict[str, Any]]:
        """Get all open positions from Alpaca."""
        try:
            positions = await asyncio.to_thread(
                self._trading_client.get_all_positions
            )
            return [self._position_to_dict(p) for p in positions]
        except Exception as e:
            logger.error("Failed to get positions: %s", e)
            raise

    async def close_position(self, symbol: str) -> dict[str, Any]:
        """Close an entire position for a given symbol."""
        try:
            order = await asyncio.to_thread(
                self._trading_client.close_position, symbol
            )
            logger.info("Closed position for %s → order_id=%s", symbol, order.id)
            return self._order_to_dict(order)
        except Exception as e:
            logger.error("Failed to close position for %s: %s", symbol, e)
            raise

    # -----------------------------------------------------------------------
    # Market Clock
    # -----------------------------------------------------------------------

    async def get_clock(self) -> dict[str, Any]:
        """
        Get market clock (open/close times, current status).

        Returns:
            {
                "is_open": bool,
                "timestamp": str (ISO 8601),
                "next_open": str | None (ISO 8601),
                "next_close": str | None (ISO 8601),
                "time_until_close": str | None (human-readable)
            }
        """
        try:
            clock = await asyncio.to_thread(self._trading_client.get_clock)
            time_until_close = None
            if clock.is_open and clock.next_close:
                delta = clock.next_close - clock.timestamp
                hours, remainder = divmod(int(delta.total_seconds()), 3600)
                minutes, _ = divmod(remainder, 60)
                time_until_close = f"{hours}h {minutes}m"

            return {
                "is_open": clock.is_open,
                "timestamp": clock.timestamp.isoformat() if clock.timestamp else None,
                "next_open": clock.next_open.isoformat() if clock.next_open else None,
                "next_close": clock.next_close.isoformat() if clock.next_close else None,
                "time_until_close": time_until_close,
            }
        except Exception as e:
            logger.error("Failed to get market clock: %s", e)
            raise

    # -----------------------------------------------------------------------
    # Market Data — Quotes
    # -----------------------------------------------------------------------

    async def get_latest_quote(self, symbol: str) -> dict[str, Any]:
        """
        Get the latest quote for a symbol.

        Returns:
            {
                "symbol": str,
                "ask_price": float,
                "bid_price": float,
                "ask_size": int,
                "bid_size": int,
                "timestamp": str (ISO 8601)
            }
        """
        try:
            request = StockLatestQuoteRequest(
                symbol_or_symbols=symbol,
                feed=self._data_feed,
            )
            quotes = await asyncio.to_thread(
                self._data_client.get_stock_latest_quote, request
            )
            quote = quotes[symbol]
            return {
                "symbol": symbol,
                "ask_price": float(quote.ask_price) if quote.ask_price else 0.0,
                "bid_price": float(quote.bid_price) if quote.bid_price else 0.0,
                "ask_size": int(quote.ask_size) if quote.ask_size else 0,
                "bid_size": int(quote.bid_size) if quote.bid_size else 0,
                "timestamp": quote.timestamp.isoformat() if quote.timestamp else None,
            }
        except Exception as e:
            logger.error("Failed to get latest quote for %s: %s", symbol, e)
            raise

    async def get_latest_price(self, symbol: str) -> float:
        """
        Convenience: get the latest mid-price for a symbol.
        Returns the midpoint of bid/ask, or ask if bid is 0, or 0.0 on failure.
        """
        try:
            quote = await self.get_latest_quote(symbol)
            bid = quote["bid_price"]
            ask = quote["ask_price"]
            if bid > 0 and ask > 0:
                return round((bid + ask) / 2, 4)
            return ask if ask > 0 else bid
        except Exception:
            return 0.0

    # -----------------------------------------------------------------------
    # Market Data — Historical Bars
    # -----------------------------------------------------------------------

    async def get_bars(
        self,
        symbol: str,
        timeframe: str = "1Min",
        limit: int = 100,
        start: datetime | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get historical OHLCV bars for a symbol.

        Args:
            symbol: Stock symbol
            timeframe: '1Min', '5Min', '15Min', '1Hour', '1Day'
            limit: Max number of bars
            start: Start datetime (defaults to `limit` bars ago)

        Returns:
            List of bar dicts with keys: timestamp, open, high, low, close, volume
        """
        try:
            tf = TIMEFRAME_MAP.get(timeframe, TimeFrame.Minute)
            if start is None:
                # Default: go back enough time for the requested bars
                if tf == TimeFrame.Minute:
                    start = datetime.now() - timedelta(days=3)
                elif tf == TimeFrame.Hour:
                    start = datetime.now() - timedelta(days=30)
                else:
                    start = datetime.now() - timedelta(days=365)

            request = StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=tf,
                start=start,
                limit=limit,
                feed=self._data_feed,
            )
            bars_response = await asyncio.to_thread(
                self._data_client.get_stock_bars, request
            )
            bars = bars_response[symbol]
            return [
                {
                    "timestamp": bar.timestamp.isoformat(),
                    "open": float(bar.open),
                    "high": float(bar.high),
                    "low": float(bar.low),
                    "close": float(bar.close),
                    "volume": float(bar.volume),
                }
                for bar in bars
            ]
        except Exception as e:
            logger.error("Failed to get bars for %s (%s, limit=%d): %s", symbol, timeframe, limit, e)
            raise

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    @staticmethod
    def _parse_time_in_force(tif: str) -> TimeInForce:
        """Convert string time-in-force to alpaca-py enum."""
        mapping = {
            "day": TimeInForce.DAY,
            "gtc": TimeInForce.GTC,
            "ioc": TimeInForce.IOC,
            "fok": TimeInForce.FOK,
        }
        return mapping.get(tif.lower(), TimeInForce.DAY)

    @staticmethod
    def _order_to_dict(order: Any) -> dict[str, Any]:
        """Convert an alpaca-py Order object to a plain dict."""
        return {
            "id": str(order.id),
            "client_order_id": str(order.client_order_id) if order.client_order_id else None,
            "symbol": order.symbol,
            "side": str(order.side.value) if order.side else None,
            "type": str(order.type.value) if order.type else None,
            "qty": float(order.qty) if order.qty else None,
            "filled_qty": float(order.filled_qty) if order.filled_qty else 0,
            "filled_avg_price": (
                float(order.filled_avg_price) if order.filled_avg_price else None
            ),
            "status": str(order.status.value) if order.status else None,
            "time_in_force": str(order.time_in_force.value) if order.time_in_force else None,
            "limit_price": float(order.limit_price) if order.limit_price else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "filled_at": order.filled_at.isoformat() if order.filled_at else None,
            "submitted_at": order.submitted_at.isoformat() if order.submitted_at else None,
        }

    @staticmethod
    def _position_to_dict(position: Any) -> dict[str, Any]:
        """Convert an alpaca-py Position object to a plain dict."""
        return {
            "symbol": position.symbol,
            "qty": float(position.qty),
            "side": str(position.side),
            "avg_entry_price": float(position.avg_entry_price),
            "current_price": float(position.current_price),
            "market_value": float(position.market_value),
            "unrealized_pl": float(position.unrealized_pl),
            "unrealized_plpc": float(position.unrealized_plpc),
        }

    @property
    def is_paper(self) -> bool:
        """Whether the client is using paper trading."""
        return self._is_paper


# ---------------------------------------------------------------------------
# Client management — default client + per-user client registry
# ---------------------------------------------------------------------------

def create_alpaca_client() -> AlpacaClient | None:
    """
    Factory that creates an AlpacaClient if credentials are configured.
    Returns None if API key/secret are empty (allows app to start without Alpaca).
    """
    if not settings.ALPACA_API_KEY or not settings.ALPACA_SECRET_KEY:
        logger.warning(
            "Alpaca API credentials not configured. "
            "Market data and trading features will be unavailable."
        )
        return None
    try:
        return AlpacaClient()
    except Exception as e:
        logger.error("Failed to create Alpaca client: %s", e)
        return None


_default_client: AlpacaClient | None = create_alpaca_client()

# Per-user Alpaca clients keyed by user_id.
# Populated when a user tests/saves broker credentials via the Settings UI.
_user_clients: dict[str, AlpacaClient] = {}


def get_alpaca_client(user_id: str | None = None) -> AlpacaClient | None:
    """
    Return the Alpaca client for the given user, falling back to the default.

    Priority:
      1. Per-user client (if user_id provided and client exists)
      2. Default client (from env vars)
    """
    if user_id and user_id in _user_clients:
        return _user_clients[user_id]
    return _default_client


def set_user_alpaca_client(
    user_id: str, api_key: str, secret_key: str, base_url: str
) -> AlpacaClient | None:
    """
    Create and register a per-user Alpaca client.
    Called when a user saves/tests new broker settings via the Settings UI.
    """
    try:
        client = AlpacaClient(
            api_key=api_key, secret_key=secret_key, base_url=base_url
        )
        _user_clients[user_id] = client
        logger.info("alpaca_client_registered", user_id=user_id)
        return client
    except Exception as e:
        logger.error("Failed to create Alpaca client for user %s: %s", user_id, e)
        return None


def reinitialize_alpaca_client(
    api_key: str, secret_key: str, base_url: str
) -> AlpacaClient | None:
    """
    Replace the default AlpacaClient with new credentials.
    Used during startup to load credentials from DB.
    """
    global _default_client
    try:
        _default_client = AlpacaClient(
            api_key=api_key, secret_key=secret_key, base_url=base_url
        )
        logger.info("Default Alpaca client reinitialized with new credentials")
        return _default_client
    except Exception as e:
        logger.error("Failed to reinitialize Alpaca client: %s", e)
        return None


# Backward compat alias
alpaca_client = _default_client
