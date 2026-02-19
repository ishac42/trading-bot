"""
API endpoint tests for Market Data and Health endpoints.

Tests cover:
  - Health check
  - Market status (success + Alpaca failure fallback)
  - Market data for symbol (success + failure)
  - Dashboard summary (with and without data)
"""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Trade, Position, generate_uuid, utcnow


# ---------------------------------------------------------------------------
# Health Check
# ---------------------------------------------------------------------------

class TestHealthCheck:
    async def test_health_check(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "environment" in data
        assert "alpaca_connected" in data


# ---------------------------------------------------------------------------
# Market Status
# ---------------------------------------------------------------------------

class TestMarketStatus:
    async def test_market_status_success(self, client, mock_alpaca_client):
        resp = await client.get("/api/market-status")
        assert resp.status_code == 200
        data = resp.json()
        assert "is_open" in data

    async def test_market_status_alpaca_failure(self, client, mock_alpaca_client):
        mock_alpaca_client.get_clock = AsyncMock(
            side_effect=Exception("Alpaca connection refused")
        )
        resp = await client.get("/api/market-status")
        # Market data router returns a safe fallback rather than raising on clock failure
        assert resp.status_code == 200
        assert resp.json()["is_open"] is False


# ---------------------------------------------------------------------------
# Market Data for Symbol
# ---------------------------------------------------------------------------

class TestMarketData:
    async def test_market_data_success(self, client, mock_alpaca_client):
        resp = await client.get("/api/market-data/AAPL")
        assert resp.status_code == 200
        data = resp.json()
        assert data["symbol"] == "AAPL"
        assert "price" in data
        assert "bid_price" in data
        assert "ask_price" in data

    async def test_market_data_alpaca_failure(self, client, mock_alpaca_client):
        mock_alpaca_client.get_latest_quote = AsyncMock(
            side_effect=Exception("Alpaca timeout")
        )
        resp = await client.get("/api/market-data/AAPL")
        assert resp.status_code == 502
        body = resp.json()
        assert "error" in body
        assert "ALPACA" in body["error"]["code"]


# ---------------------------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------------------------

class TestSummary:
    async def test_summary_no_data(self, client):
        resp = await client.get("/api/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_pnl"] == 0
        assert data["active_bots"] == 0
        assert data["open_positions"] == 0

    async def test_summary_with_data(self, client, async_engine, sample_bot):
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
            session.add(Position(
                id=generate_uuid(), bot_id=sample_bot["id"],
                symbol="MSFT", quantity=5,
                entry_price=300.0, current_price=310.0,
                unrealized_pnl=50.0, realized_pnl=0.0,
                opened_at=now, is_open=True,
            ))
            await session.commit()

        resp = await client.get("/api/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_pnl"] == 50.0
        assert data["open_positions"] == 1
        assert data["positions_value"] == 1550.0  # 5 * 310.0
