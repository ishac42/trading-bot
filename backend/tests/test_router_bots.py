"""Profile contract for /api/bots. Pause and the old factory body are retired."""

from __future__ import annotations

from tests.conftest import BOT_CREATE_PAYLOAD


class TestBotProfiles:
    async def test_list_empty(self, client):
        resp = await client.get("/api/bots")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_profile(self, client):
        resp = await client.post("/api/bots", json=BOT_CREATE_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Test Bot Alpha"
        assert data["status"] == "stopped"
        assert data["universe"]["top_n"] == 75
        assert data["risk"]["sleeve_loss_limit_pct"] == -1.5
        assert "capital" not in data
        assert "symbols" not in data

    async def test_factory_body_rejected(self, client):
        resp = await client.post("/api/bots", json={
            "name": "Old",
            "capital": 10000,
            "symbols": ["AAPL"],
            "indicators": {"RSI": {}},
        })
        assert resp.status_code == 422

    async def test_start_stop_and_delete(self, client, sample_bot):
        started = await client.post(f"/api/bots/{sample_bot['id']}/start")
        assert started.status_code == 200
        assert started.json()["status"] == "running"

        blocked = await client.delete(f"/api/bots/{sample_bot['id']}")
        assert blocked.status_code == 409

        stopped = await client.post(f"/api/bots/{sample_bot['id']}/stop")
        assert stopped.status_code == 200
        assert stopped.json()["status"] == "stopped"

        deleted = await client.delete(f"/api/bots/{sample_bot['id']}")
        assert deleted.status_code == 200

    async def test_start_refused_while_locked(self, client, sample_bot):
        lock = await client.post("/api/book/lock")
        assert lock.status_code == 200
        resp = await client.post(f"/api/bots/{sample_bot['id']}/start")
        assert resp.status_code == 409

    async def test_pause_and_resume_are_gone(self, client, sample_bot):
        pause = await client.post(f"/api/bots/{sample_bot['id']}/pause")
        resume = await client.post(f"/api/bots/{sample_bot['id']}/resume")
        assert pause.status_code == 410
        assert resume.status_code == 410
