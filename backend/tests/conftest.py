"""
Shared test fixtures for all tests.

Provides:
  - API test infrastructure (async client, in-memory DB, dependency overrides)
  - Sample database records (bot, trade, position)
  - Sample OHLCV bar data (various scenarios)
  - Indicator config presets
  - Bot config presets
  - Risk config presets
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
import numpy as np
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base, get_db
from app.models import Bot, Trade, Position, generate_uuid, utcnow


# ---------------------------------------------------------------------------
# API Test Infrastructure
# ---------------------------------------------------------------------------

@pytest.fixture
async def async_engine():
    """Create an in-memory SQLite async engine with all tables."""
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def async_session(async_engine):
    """Fresh async session per test, auto-commits at end."""
    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False,
    )
    async with session_factory() as session:
        yield session


@pytest.fixture
def mock_trading_engine():
    """Mock TradingEngine to avoid real trading during tests."""
    engine = MagicMock()
    engine.bots = {}
    engine.market_is_open = True
    engine._running = True
    engine.start = AsyncMock()
    engine.stop = AsyncMock()
    engine.register_bot = AsyncMock()
    engine.unregister_bot = AsyncMock()
    engine.pause_bot = MagicMock()
    engine.resume_bot = MagicMock()
    return engine


@pytest.fixture
def mock_ws_manager():
    """Mock WebSocketManager to avoid real WS broadcasts during tests."""
    mgr = MagicMock()
    mgr.emit_bot_status_changed = AsyncMock()
    mgr.emit_trade_executed = AsyncMock()
    mgr.emit_position_updated = AsyncMock()
    mgr.emit_price_update = AsyncMock()
    mgr.emit_market_status_changed = AsyncMock()
    return mgr


@pytest.fixture
def mock_alpaca_client():
    """Mock AlpacaClient to avoid real Alpaca API calls."""
    client = MagicMock()
    client.is_paper = True
    client.get_clock = AsyncMock(return_value={
        "is_open": True,
        "next_open": "2026-02-20T14:30:00Z",
        "next_close": "2026-02-19T21:00:00Z",
        "time_until_close": "4h 30m",
    })
    client.get_latest_quote = AsyncMock(return_value={
        "bid_price": 150.0,
        "ask_price": 150.10,
    })
    client.get_latest_price = AsyncMock(return_value=150.05)
    client.get_bars = AsyncMock(return_value=[
        {"open": 149.0, "high": 151.0, "low": 148.5, "close": 150.0, "volume": 10000.0},
        {"open": 150.0, "high": 152.0, "low": 149.5, "close": 151.0, "volume": 12000.0},
    ])
    client.submit_market_order = AsyncMock(return_value={
        "id": "mock-order-001",
        "status": "filled",
        "filled_avg_price": 150.05,
        "filled_qty": 10,
    })
    client.get_order = AsyncMock(return_value={
        "id": "mock-order-001",
        "status": "filled",
        "filled_avg_price": 150.05,
        "filled_qty": 10,
    })
    return client


@pytest.fixture
async def client(async_engine, mock_trading_engine, mock_ws_manager, mock_alpaca_client):
    """httpx AsyncClient wired to the FastAPI app with overridden dependencies."""
    import app.routers.bots as bots_mod
    import app.routers.positions as positions_mod
    import app.routers.market_data as market_data_mod
    from app.main import app

    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False,
    )

    async def _override_get_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db

    # Patch module-level singletons
    original_te_bots = bots_mod.trading_engine
    original_ws_bots = bots_mod.ws_manager
    original_te_positions = positions_mod.alpaca_client
    original_ws_positions = positions_mod.ws_manager
    original_alpaca_market = market_data_mod.alpaca_client

    bots_mod.trading_engine = mock_trading_engine
    bots_mod.ws_manager = mock_ws_manager
    positions_mod.ws_manager = mock_ws_manager
    positions_mod.alpaca_client = mock_alpaca_client
    market_data_mod.alpaca_client = mock_alpaca_client

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    # Restore originals
    app.dependency_overrides.clear()
    bots_mod.trading_engine = original_te_bots
    bots_mod.ws_manager = original_ws_bots
    positions_mod.alpaca_client = original_te_positions
    positions_mod.ws_manager = original_ws_positions
    market_data_mod.alpaca_client = original_alpaca_market


# ---------------------------------------------------------------------------
# Sample Data Fixtures
# ---------------------------------------------------------------------------

BOT_CREATE_PAYLOAD = {
    "name": "Test Bot Alpha",
    "capital": 10000.0,
    "trading_frequency": 60,
    "symbols": ["AAPL", "MSFT"],
    "start_hour": 9,
    "start_minute": 30,
    "end_hour": 16,
    "end_minute": 0,
    "indicators": {
        "RSI": {"period": 14, "oversold": 30, "overbought": 70},
        "MACD": {"fast": 12, "slow": 26, "signal": 9},
    },
    "risk_management": {
        "stop_loss": 2.0,
        "take_profit": 5.0,
        "max_position_size": 10.0,
        "max_daily_loss": 5.0,
        "max_concurrent_positions": 5,
    },
}


@pytest.fixture
async def sample_bot(client) -> dict:
    """Create and return a bot via the API."""
    resp = await client.post("/api/bots", json=BOT_CREATE_PAYLOAD)
    assert resp.status_code == 201
    return resp.json()


@pytest.fixture
async def sample_bot_with_trade(client, async_engine) -> tuple[dict, dict]:
    """Create a bot and insert a trade directly into the DB. Returns (bot, trade_dict)."""
    resp = await client.post("/api/bots", json=BOT_CREATE_PAYLOAD)
    bot = resp.json()

    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False,
    )
    trade_id = generate_uuid()
    now = utcnow()
    async with session_factory() as session:
        trade = Trade(
            id=trade_id,
            bot_id=bot["id"],
            symbol="AAPL",
            type="buy",
            quantity=10,
            price=150.0,
            timestamp=now,
            status="filled",
            order_id="test-order-001",
        )
        session.add(trade)
        await session.commit()

    trade_dict = {
        "id": trade_id,
        "bot_id": bot["id"],
        "symbol": "AAPL",
        "type": "buy",
        "quantity": 10,
        "price": 150.0,
        "timestamp": now.isoformat(),
        "status": "filled",
    }
    return bot, trade_dict


@pytest.fixture
async def sample_bot_with_position(client, async_engine) -> tuple[dict, dict]:
    """Create a bot and insert an open position directly into the DB."""
    resp = await client.post("/api/bots", json=BOT_CREATE_PAYLOAD)
    bot = resp.json()

    session_factory = async_sessionmaker(
        async_engine, class_=AsyncSession, expire_on_commit=False,
    )
    pos_id = generate_uuid()
    now = utcnow()
    async with session_factory() as session:
        pos = Position(
            id=pos_id,
            bot_id=bot["id"],
            symbol="AAPL",
            quantity=10,
            entry_price=150.0,
            current_price=155.0,
            stop_loss_price=147.0,
            take_profit_price=157.5,
            unrealized_pnl=50.0,
            realized_pnl=0.0,
            opened_at=now,
            is_open=True,
            entry_indicator="RSI",
        )
        session.add(pos)
        await session.commit()

    pos_dict = {
        "id": pos_id,
        "bot_id": bot["id"],
        "symbol": "AAPL",
        "quantity": 10,
        "entry_price": 150.0,
        "current_price": 155.0,
        "is_open": True,
    }
    return bot, pos_dict


# ---------------------------------------------------------------------------
# OHLCV Bar Data Factories
# ---------------------------------------------------------------------------

def _make_bars(
    prices: list[float],
    *,
    spread: float = 0.5,
    volume_base: int = 10000,
) -> list[dict]:
    """
    Generate OHLCV bar dicts from a list of close prices.

    Each bar gets:
      open  = close ± small offset
      high  = max(open, close) + spread
      low   = min(open, close) - spread
      volume = volume_base with some variation
    """
    bars = []
    for i, close in enumerate(prices):
        open_price = prices[i - 1] if i > 0 else close
        high = max(open_price, close) + spread
        low = min(open_price, close) - spread
        vol = volume_base + (i * 100)
        bars.append({
            "timestamp": f"2026-02-17T09:{30 + i}:00Z",
            "open": round(open_price, 4),
            "high": round(high, 4),
            "low": round(low, 4),
            "close": round(close, 4),
            "volume": float(vol),
        })
    return bars


@pytest.fixture
def trending_up_bars() -> list[dict]:
    """50 bars with a steady uptrend (with enough noise to create some down-bars for RSI)."""
    # Noise must be wide enough that delta = 0.5 + noise[i] - noise[i-1] can go negative
    # so avg_loss > 0 and RSI doesn't become NaN.
    rng = np.random.RandomState(42)
    noise = rng.uniform(-0.8, 0.3, 50)
    prices = [100.0 + i * 0.5 + noise[i] for i in range(50)]
    return _make_bars(prices)


@pytest.fixture
def trending_down_bars() -> list[dict]:
    """50 bars with a steady downtrend (with enough noise to create some up-bars for RSI)."""
    rng = np.random.RandomState(42)
    noise = rng.uniform(-0.3, 0.8, 50)
    prices = [125.0 - i * 0.5 + noise[i] for i in range(50)]
    return _make_bars(prices)


@pytest.fixture
def oversold_bars() -> list[dict]:
    """50 bars ending in an extreme drop — triggers RSI oversold."""
    # Start with mild oscillation so RSI has a baseline, then drop hard
    rng = np.random.RandomState(42)
    mild = [100.0 + rng.uniform(-0.5, 0.5) for _ in range(20)]
    drop = [mild[-1] - i * 1.5 + rng.uniform(-0.1, 0.1) for i in range(30)]
    return _make_bars(mild + drop)


@pytest.fixture
def overbought_bars() -> list[dict]:
    """50 bars ending in an extreme rally — triggers RSI overbought."""
    rng = np.random.RandomState(42)
    mild = [100.0 + rng.uniform(-0.5, 0.5) for _ in range(20)]
    rally = [mild[-1] + i * 1.5 + rng.uniform(-0.1, 0.1) for i in range(30)]
    return _make_bars(mild + rally)


@pytest.fixture
def flat_bars() -> list[dict]:
    """50 bars with flat price action — no trend."""
    prices = [100.0] * 50
    return _make_bars(prices)


@pytest.fixture
def volatile_bars() -> list[dict]:
    """50 bars with high volatility — oscillating between 90 and 110."""
    prices = [100.0 + 10.0 * np.sin(i * 0.5) for i in range(50)]
    return _make_bars(prices)


@pytest.fixture
def few_bars() -> list[dict]:
    """Only 3 bars — insufficient for most indicators."""
    return _make_bars([100.0, 101.0, 99.0])


# ---------------------------------------------------------------------------
# Indicator Config Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def rsi_config() -> dict:
    return {"RSI": {"period": 14, "oversold": 30, "overbought": 70}}


@pytest.fixture
def macd_config() -> dict:
    return {"MACD": {"fast": 12, "slow": 26, "signal": 9}}


@pytest.fixture
def sma_config() -> dict:
    return {"SMA": {"period": 20}}


@pytest.fixture
def ema_config() -> dict:
    return {"EMA": {"period": 20}}


@pytest.fixture
def bbands_config() -> dict:
    return {"Bollinger Bands": {"period": 20, "stdDev": 2}}


@pytest.fixture
def stochastic_config() -> dict:
    return {"Stochastic": {"kPeriod": 14, "dPeriod": 3}}


@pytest.fixture
def obv_config() -> dict:
    return {"OBV": {}}


@pytest.fixture
def all_indicators_config() -> dict:
    return {
        "RSI": {"period": 14, "oversold": 30, "overbought": 70},
        "MACD": {"fast": 12, "slow": 26, "signal": 9},
        "SMA": {"period": 20},
        "EMA": {"period": 20},
        "Bollinger Bands": {"period": 20, "stdDev": 2},
        "Stochastic": {"kPeriod": 14, "dPeriod": 3},
        "OBV": {},
    }


# ---------------------------------------------------------------------------
# Bot / Risk Config Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def default_risk_config() -> dict:
    return {
        "stop_loss": 2.0,
        "take_profit": 5.0,
        "max_position_size": 10.0,
        "max_daily_loss": 5.0,
        "max_concurrent_positions": 5,
    }


@pytest.fixture
def default_bot_config(default_risk_config: dict) -> dict:
    return {
        "name": "Test Bot",
        "capital": 10000.0,
        "trading_frequency": 60,
        "symbols": ["AAPL", "MSFT"],
        "indicators": {
            "RSI": {"period": 14, "oversold": 30, "overbought": 70},
            "MACD": {"fast": 12, "slow": 26, "signal": 9},
        },
        "risk_management": default_risk_config,
        "start_hour": 9,
        "start_minute": 30,
        "end_hour": 16,
        "end_minute": 0,
    }
