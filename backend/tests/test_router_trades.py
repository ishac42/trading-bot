"""
API endpoint tests for the Trade Management router (/api/trades).

Tests cover:
  - Listing trades (empty, with data, filtering, pagination, sorting)
  - Getting a single trade
  - Trade statistics
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Trade, generate_uuid, utcnow


# ---------------------------------------------------------------------------
# List Trades
# ---------------------------------------------------------------------------

class TestListTrades:
    async def test_list_trades_empty(self, client, sample_bot):
        resp = await client.get("/api/trades")
        assert resp.status_code == 200
        data = resp.json()
        assert data["trades"] == []
        assert data["pagination"]["totalItems"] == 0

    async def test_list_trades_with_data(self, client, sample_bot_with_trade):
        bot, trade = sample_bot_with_trade
        resp = await client.get("/api/trades")
        assert resp.status_code == 200
        data = resp.json()
        assert data["pagination"]["totalItems"] == 1
        assert len(data["trades"]) == 1
        assert data["trades"][0]["id"] == trade["id"]

    async def test_list_trades_filter_by_bot(self, client, sample_bot_with_trade):
        bot, trade = sample_bot_with_trade
        resp = await client.get(f"/api/trades?botId={bot['id']}")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["totalItems"] == 1

        resp2 = await client.get("/api/trades?botId=nonexistent")
        assert resp2.status_code == 200
        assert resp2.json()["pagination"]["totalItems"] == 0

    async def test_list_trades_filter_by_symbol(self, client, sample_bot_with_trade):
        resp = await client.get("/api/trades?symbol=AAPL")
        assert resp.status_code == 200
        assert resp.json()["pagination"]["totalItems"] == 1

        resp2 = await client.get("/api/trades?symbol=TSLA")
        assert resp2.status_code == 200
        assert resp2.json()["pagination"]["totalItems"] == 0

    async def test_list_trades_pagination(self, client, async_engine, sample_bot):
        session_factory = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False,
        )
        now = utcnow()
        async with session_factory() as session:
            for i in range(15):
                session.add(Trade(
                    id=generate_uuid(), bot_id=sample_bot["id"],
                    symbol="AAPL", type="buy", quantity=1,
                    price=100.0 + i, timestamp=now - timedelta(minutes=i),
                    status="filled",
                ))
            await session.commit()

        resp = await client.get("/api/trades?page=1&pageSize=5")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["trades"]) == 5
        assert data["pagination"]["totalItems"] == 15
        assert data["pagination"]["totalPages"] == 3
        assert data["pagination"]["page"] == 1

        resp2 = await client.get("/api/trades?page=2&pageSize=5")
        assert resp2.status_code == 200
        assert len(resp2.json()["trades"]) == 5

    async def test_list_trades_sort_by_price_desc(self, client, async_engine, sample_bot):
        session_factory = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False,
        )
        now = utcnow()
        async with session_factory() as session:
            for i, price in enumerate([100.0, 200.0, 50.0]):
                session.add(Trade(
                    id=generate_uuid(), bot_id=sample_bot["id"],
                    symbol="AAPL", type="buy", quantity=1,
                    price=price, timestamp=now - timedelta(minutes=i),
                    status="filled",
                ))
            await session.commit()

        resp = await client.get("/api/trades?sortField=price&sortDirection=desc")
        assert resp.status_code == 200
        prices = [t["price"] for t in resp.json()["trades"]]
        assert prices == sorted(prices, reverse=True)


# ---------------------------------------------------------------------------
# Get Single Trade
# ---------------------------------------------------------------------------

class TestGetTrade:
    async def test_get_trade_exists(self, client, sample_bot_with_trade):
        _, trade = sample_bot_with_trade
        resp = await client.get(f"/api/trades/{trade['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == trade["id"]
        assert data["symbol"] == "AAPL"
        assert data["quantity"] == 10

    async def test_get_trade_not_found(self, client):
        resp = await client.get("/api/trades/nonexistent-id")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "TRADE_NOT_FOUND"


# ---------------------------------------------------------------------------
# Trade Stats
# ---------------------------------------------------------------------------

class TestTradeStats:
    async def test_stats_no_trades(self, client):
        resp = await client.get("/api/trades/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalTrades"] == 0
        assert data["winRate"] == 0
        assert data["totalPnL"] == 0

    async def test_stats_with_trades(self, client, async_engine, sample_bot):
        session_factory = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False,
        )
        now = utcnow()
        async with session_factory() as session:
            session.add(Trade(
                id=generate_uuid(), bot_id=sample_bot["id"],
                symbol="AAPL", type="sell", quantity=10,
                price=155.0, timestamp=now, status="filled",
                profit_loss=50.0,
            ))
            session.add(Trade(
                id=generate_uuid(), bot_id=sample_bot["id"],
                symbol="MSFT", type="sell", quantity=5,
                price=300.0, timestamp=now, status="filled",
                profit_loss=-20.0,
            ))
            await session.commit()

        resp = await client.get("/api/trades/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["totalTrades"] == 2
        assert data["winningTrades"] == 1
        assert data["losingTrades"] == 1
        assert data["totalPnL"] == 30.0
        assert data["winRate"] == 50.0
