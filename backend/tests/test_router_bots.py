"""
API endpoint tests for the Bot Management router (/api/bots).

Tests cover:
  - CRUD operations (list, create, get, update, delete)
  - Lifecycle control (start, stop, pause, resume)
  - Error cases (not found, conflict, bad request)
"""

from __future__ import annotations

import pytest

from tests.conftest import BOT_CREATE_PAYLOAD


# ---------------------------------------------------------------------------
# List Bots
# ---------------------------------------------------------------------------

class TestListBots:
    async def test_list_bots_empty(self, client):
        resp = await client.get("/api/bots")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_bots_with_data(self, client, sample_bot):
        resp = await client.get("/api/bots")
        assert resp.status_code == 200
        bots = resp.json()
        assert len(bots) == 1
        assert bots[0]["id"] == sample_bot["id"]


# ---------------------------------------------------------------------------
# Create Bot
# ---------------------------------------------------------------------------

class TestCreateBot:
    async def test_create_bot_valid(self, client):
        resp = await client.post("/api/bots", json=BOT_CREATE_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == BOT_CREATE_PAYLOAD["name"]
        assert data["status"] == "stopped"
        assert data["is_active"] is False
        assert data["capital"] == BOT_CREATE_PAYLOAD["capital"]
        assert data["symbols"] == BOT_CREATE_PAYLOAD["symbols"]
        assert data["error_count"] == 0

    async def test_create_bot_missing_fields(self, client):
        resp = await client.post("/api/bots", json={"name": "Incomplete"})
        assert resp.status_code == 422
        body = resp.json()
        assert "error" in body
        assert body["error"]["code"] == "VALIDATION_ERROR"


# ---------------------------------------------------------------------------
# Get Bot
# ---------------------------------------------------------------------------

class TestGetBot:
    async def test_get_bot_exists(self, client, sample_bot):
        resp = await client.get(f"/api/bots/{sample_bot['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_bot["id"]
        assert resp.json()["name"] == sample_bot["name"]

    async def test_get_bot_not_found(self, client):
        resp = await client.get("/api/bots/nonexistent-id")
        assert resp.status_code == 404
        body = resp.json()
        assert body["error"]["code"] == "BOT_NOT_FOUND"


# ---------------------------------------------------------------------------
# Update Bot
# ---------------------------------------------------------------------------

class TestUpdateBot:
    async def test_update_bot_valid(self, client, sample_bot):
        updated = {**BOT_CREATE_PAYLOAD, "name": "Updated Bot Name", "capital": 25000.0}
        resp = await client.put(f"/api/bots/{sample_bot['id']}", json=updated)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Bot Name"
        assert data["capital"] == 25000.0

    async def test_update_bot_not_found(self, client):
        resp = await client.put("/api/bots/nonexistent-id", json=BOT_CREATE_PAYLOAD)
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "BOT_NOT_FOUND"


# ---------------------------------------------------------------------------
# Delete Bot
# ---------------------------------------------------------------------------

class TestDeleteBot:
    async def test_delete_bot_stopped(self, client, sample_bot):
        resp = await client.delete(f"/api/bots/{sample_bot['id']}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

        get_resp = await client.get(f"/api/bots/{sample_bot['id']}")
        assert get_resp.status_code == 404

    async def test_delete_bot_running(self, client, async_engine):
        """Running bots cannot be deleted."""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        from app.models import Bot, generate_uuid, utcnow

        session_factory = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False,
        )
        bot_id = generate_uuid()
        async with session_factory() as session:
            bot = Bot(
                id=bot_id, name="Running Bot", status="running",
                capital=5000, trading_frequency=60,
                indicators={}, risk_management={}, symbols=["AAPL"],
                start_hour=9, start_minute=30, end_hour=16, end_minute=0,
                is_active=True, error_count=0,
            )
            session.add(bot)
            await session.commit()

        resp = await client.delete(f"/api/bots/{bot_id}")
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "BOT_RUNNING"

    async def test_delete_bot_not_found(self, client):
        resp = await client.delete("/api/bots/nonexistent-id")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Start / Stop / Pause / Resume
# ---------------------------------------------------------------------------

class TestBotLifecycle:
    async def test_start_bot(self, client, sample_bot, mock_trading_engine):
        resp = await client.post(f"/api/bots/{sample_bot['id']}/start")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        mock_trading_engine.register_bot.assert_awaited_once_with(sample_bot["id"])

    async def test_start_bot_not_found(self, client):
        resp = await client.post("/api/bots/nonexistent-id/start")
        assert resp.status_code == 404

    async def test_stop_bot(self, client, sample_bot, mock_trading_engine):
        resp = await client.post(f"/api/bots/{sample_bot['id']}/stop")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        mock_trading_engine.unregister_bot.assert_awaited_once_with(sample_bot["id"])

    async def test_stop_bot_not_found(self, client):
        resp = await client.post("/api/bots/nonexistent-id/stop")
        assert resp.status_code == 404

    async def test_pause_bot(self, client, sample_bot, mock_trading_engine):
        resp = await client.post(f"/api/bots/{sample_bot['id']}/pause")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        mock_trading_engine.pause_bot.assert_called_once_with(sample_bot["id"])

    async def test_pause_bot_not_found(self, client):
        resp = await client.post("/api/bots/nonexistent-id/pause")
        assert resp.status_code == 404

    async def test_resume_paused_bot(self, client, async_engine, mock_trading_engine):
        """Resume should only work on paused bots."""
        from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
        from app.models import Bot, generate_uuid

        session_factory = async_sessionmaker(
            async_engine, class_=AsyncSession, expire_on_commit=False,
        )
        bot_id = generate_uuid()
        async with session_factory() as session:
            bot = Bot(
                id=bot_id, name="Paused Bot", status="paused",
                capital=5000, trading_frequency=60,
                indicators={}, risk_management={}, symbols=["AAPL"],
                start_hour=9, start_minute=30, end_hour=16, end_minute=0,
                is_active=True, error_count=0,
            )
            session.add(bot)
            await session.commit()

        resp = await client.post(f"/api/bots/{bot_id}/resume")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        mock_trading_engine.resume_bot.assert_called_once_with(bot_id)

    async def test_resume_non_paused_bot(self, client, sample_bot):
        """Resuming a stopped bot should fail with 400."""
        resp = await client.post(f"/api/bots/{sample_bot['id']}/resume")
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "BOT_NOT_PAUSED"

    async def test_resume_bot_not_found(self, client):
        resp = await client.post("/api/bots/nonexistent-id/resume")
        assert resp.status_code == 404
