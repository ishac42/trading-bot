"""
API endpoint tests for the Position Management router (/api/positions).

Tests cover:
  - Listing positions (empty, with data, filtering)
  - Getting a single position
  - Closing a position (success, already closed, Alpaca failure)
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import Position, generate_uuid, utcnow


# ---------------------------------------------------------------------------
# List Positions
# ---------------------------------------------------------------------------

class TestListPositions:
    async def test_list_positions_empty(self, client):
        resp = await client.get("/api/positions")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_positions_with_data(self, client, sample_bot_with_position):
        bot, pos = sample_bot_with_position
        resp = await client.get("/api/positions")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == pos["id"]
        assert data[0]["is_open"] is True

    async def test_list_positions_filter_by_bot(self, client, sample_bot_with_position):
        bot, pos = sample_bot_with_position
        resp = await client.get(f"/api/positions?botId={bot['id']}")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp2 = await client.get("/api/positions?botId=nonexistent")
        assert resp2.status_code == 200
        assert resp2.json() == []

    async def test_list_positions_filter_by_symbol(self, client, sample_bot_with_position):
        resp = await client.get("/api/positions?symbol=AAPL")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        resp2 = await client.get("/api/positions?symbol=TSLA")
        assert resp2.status_code == 200
        assert resp2.json() == []


# ---------------------------------------------------------------------------
# Get Single Position
# ---------------------------------------------------------------------------

class TestGetPosition:
    async def test_get_position_exists(self, client, sample_bot_with_position):
        _, pos = sample_bot_with_position
        resp = await client.get(f"/api/positions/{pos['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == pos["id"]
        assert data["symbol"] == "AAPL"
        assert data["quantity"] == 10
        assert data["entry_price"] == 150.0

    async def test_get_position_not_found(self, client):
        resp = await client.get("/api/positions/nonexistent-id")
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "POSITION_NOT_FOUND"


# ---------------------------------------------------------------------------
# Close Position
# ---------------------------------------------------------------------------

class TestClosePosition:
    async def test_close_position_success(self, client, sample_bot_with_position, mock_alpaca_client):
        _, pos = sample_bot_with_position
        mock_alpaca_client.submit_market_order = AsyncMock(return_value={
            "id": "sell-order-001",
        })
        mock_alpaca_client.get_order = AsyncMock(return_value={
            "id": "sell-order-001",
            "status": "filled",
            "filled_avg_price": 156.0,
        })

        resp = await client.post(f"/api/positions/{pos['id']}/close")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        # Verify position is now closed
        get_resp = await client.get(f"/api/positions/{pos['id']}")
        assert get_resp.status_code == 200
        assert get_resp.json()["is_open"] is False

    async def test_close_position_already_closed(self, client, async_engine, sample_bot):
        """Closing an already-closed position should return 400."""
        session_factory = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False,
        )
        pos_id = generate_uuid()
        async with session_factory() as session:
            pos = Position(
                id=pos_id, bot_id=sample_bot["id"],
                symbol="AAPL", quantity=10,
                entry_price=150.0, current_price=155.0,
                unrealized_pnl=0.0, realized_pnl=50.0,
                opened_at=utcnow(), closed_at=utcnow(),
                is_open=False,
            )
            session.add(pos)
            await session.commit()

        resp = await client.post(f"/api/positions/{pos_id}/close")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "POSITION_ALREADY_CLOSED"

    async def test_close_position_alpaca_failure(self, client, sample_bot_with_position, mock_alpaca_client):
        _, pos = sample_bot_with_position
        mock_alpaca_client.submit_market_order = AsyncMock(
            side_effect=Exception("Alpaca connection timeout")
        )

        resp = await client.post(f"/api/positions/{pos['id']}/close")
        assert resp.status_code == 502
        assert "ALPACA" in resp.json()["error"]["code"]

    async def test_close_position_not_found(self, client):
        resp = await client.post("/api/positions/nonexistent-id/close")
        assert resp.status_code == 404
