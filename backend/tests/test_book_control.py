"""Cut A control plane: settings caps, universe snapshots, flatten/lock/unlock."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models import AppSettings, UniverseSnapshot
from tests.conftest import TEST_USER_ID

VALID_RISK = {
    "risk_per_trade_pct": 0.25,
    "max_open_stop_risk_pct": 0.75,
    "soft_throttle_pct": -1,
    "stop_new_risk_pct": -1.5,
    "hard_daily_lock_pct": -2,
    "max_positions": 3,
    "single_name_notional_pct": 25,
    "min_score": 70,
    "min_target_r": 1.5,
    "cost_multiple": 3,
}


class TestSettingsValidation:
    async def test_defaults_are_present(self, client):
        resp = await client.get("/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["universe"]["top_n"] == 75
        assert data["session"]["extended_hours"] is False
        assert data["feed"]["primary"] == "sip"
        assert data["risk"]["hard_daily_lock_pct"] == -2
        assert data["mode"]["mode"] == "paper"
        assert data["fees"]["version"] == ""

    async def test_loose_risk_rejected(self, client):
        body = {**VALID_RISK, "hard_daily_lock_pct": -3}
        resp = await client.put("/api/settings/risk", json=body)
        assert resp.status_code == 422

    async def test_iex_primary_rejected(self, client):
        resp = await client.put("/api/settings/feed", json={"primary": "iex", "iex_diagnostic": False})
        assert resp.status_code == 422

    async def test_extended_hours_rejected(self, client):
        resp = await client.put("/api/settings/session", json={
            "rth_enabled": True,
            "extended_hours": True,
        })
        assert resp.status_code == 422

    async def test_two_modes_rejected(self, client):
        resp = await client.put("/api/settings/mode", json={"mode": "paper", "shadow": True})
        assert resp.status_code == 422

    async def test_mode_round_trip(self, client):
        resp = await client.put("/api/settings/mode", json={"mode": "shadow"})
        assert resp.status_code == 200
        assert resp.json()["mode"] == "shadow"


class TestUniverseSnapshot:
    async def test_put_appends_a_row(self, client, async_engine, monkeypatch):
        async def _members(user_id, filters):
            return [{
                "symbol": "AAPL",
                "price": 190.0,
                "dollar_volume": 1_000_000_000,
                "spread_bps": 11.0,
            }]

        monkeypatch.setattr("app.routers.settings.build_universe_snapshot", _members)
        body = {"top_n": 60, "min_price": 5, "max_spread_bps": 12}
        first = await client.put("/api/settings/universe", json=body)
        assert first.status_code == 200
        assert first.json()["snapshot"]["members"][0]["symbol"] == "AAPL"

        second = await client.put("/api/settings/universe", json={**body, "top_n": 80})
        assert second.status_code == 200

        session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            count = (await session.execute(select(func.count()).select_from(UniverseSnapshot))).scalar()
        assert count == 2

        listed = await client.get("/api/settings/universe")
        assert listed.status_code == 200
        assert listed.json()["filters"]["top_n"] == 80


class TestBookCommands:
    async def test_flatten_requires_confirm(self, client):
        resp = await client.post("/api/book/flatten", json={"confirm": False})
        assert resp.status_code == 422

    async def test_flatten_and_lock(self, client, sample_bot_with_position):
        flat = await client.post("/api/book/flatten", json={"confirm": True})
        assert flat.status_code == 200
        assert flat.json()["kind"] == "flatten"
        positions = await client.get("/api/positions")
        assert positions.json() == []

        locked = await client.post("/api/book/lock")
        assert locked.status_code == 200
        summary = await client.get("/api/summary")
        assert summary.json()["kill_switch"]["locked"] is True
        assert summary.json()["throttle_stage"] == "locked"

    async def test_unlock_refused_at_daily_lock(self, client, async_engine):
        session_factory = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
        async with session_factory() as session:
            session.add(AppSettings(
                user_id=TEST_USER_ID,
                category="book",
                settings={
                    "halted": False,
                    "locked": True,
                    "throttle_stage": "locked",
                    "marked_daily_pnl": -100,
                    "marked_daily_pnl_pct": -2,
                    "regime": None,
                    "data_stale": True,
                    "data_age_seconds": None,
                },
            ))
            await session.commit()

        resp = await client.post("/api/book/unlock")
        assert resp.status_code == 422

    async def test_unlock_clears_lock_without_reopening(self, client, sample_bot_with_position):
        await client.post("/api/book/flatten", json={"confirm": True})
        await client.post("/api/book/lock")
        unlocked = await client.post("/api/book/unlock")
        assert unlocked.status_code == 200
        assert unlocked.json()["payload"]["locked"] is False
        positions = await client.get("/api/positions")
        assert positions.json() == []
