"""
FastAPI application entry point.

- Initializes the app with CORS middleware
- Registers all API routers under /api prefix
- Mounts Socket.IO ASGI app at /ws for real-time events
- Provides /api/health endpoint
- Startup/shutdown lifecycle events for database connection
- Starts/stops TradingEngine on application lifecycle
- Structured logging via structlog
- Global exception handlers + request-ID middleware
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings as app_config
from app.database import engine
from app.logging_config import configure_logging
from app.middleware import register_middleware_and_handlers
from app.routers import account, activity_logs, auth, bots, trades, positions, market_data, settings as settings_router
from app.websocket_manager import socket_app
from app.alpaca_client import get_alpaca_client, reinitialize_alpaca_client, set_user_alpaca_client
from app.database import async_session
from app.models import AppSettings
from app.trading_engine import trading_engine

logger = structlog.get_logger(__name__)

PAPER_BASE_URL = "https://paper-api.alpaca.markets"


async def _load_db_broker_credentials() -> None:
    """
    On startup, load all users' broker credentials from the DB and register
    per-user Alpaca clients. Also initializes the default client from the
    first available credentials (for backward compatibility).
    """
    try:
        async with async_session() as session:
            from sqlalchemy import select
            result = await session.execute(
                select(AppSettings).where(AppSettings.category == "broker")
            )
            rows = result.scalars().all()
            if not rows:
                return

            default_loaded = False
            for row in rows:
                data = row.settings or {}
                api_key = data.get("alpaca_api_key")
                secret_key = data.get("alpaca_secret_key")
                base_url = data.get("base_url", PAPER_BASE_URL)

                if api_key and secret_key:
                    set_user_alpaca_client(row.user_id, api_key, secret_key, base_url)
                    if not default_loaded:
                        reinitialize_alpaca_client(api_key, secret_key, base_url)
                        default_loaded = True

            logger.info("alpaca_clients_loaded_from_db", count=len(rows))
    except Exception as e:
        logger.warning("Failed to load broker credentials from DB: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    configure_logging(
        environment=app_config.ENVIRONMENT,
        log_level=app_config.LOG_LEVEL,
    )

    logger.info(
        "app_starting",
        app_name=app_config.APP_NAME,
        environment=app_config.ENVIRONMENT,
    )
    logger.info("websocket_mounted", path="/ws")

    await _load_db_broker_credentials()

    client = get_alpaca_client()
    if client:
        logger.info("alpaca_connected", paper=client.is_paper)
    else:
        logger.warning("alpaca_not_configured")

    await trading_engine.start()
    logger.info("trading_engine_started", bots_loaded=len(trading_engine.bots))

    yield

    logger.info("app_shutting_down")
    await trading_engine.stop()
    logger.info("trading_engine_stopped")
    await engine.dispose()


app = FastAPI(
    title=app_config.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# Exception handlers + Request ID / Request Logging middleware
register_middleware_and_handlers(app)

# CORS — allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_config.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(account.router, prefix="/api")
app.include_router(bots.router, prefix="/api")
app.include_router(trades.router, prefix="/api")
app.include_router(positions.router, prefix="/api")
app.include_router(market_data.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(activity_logs.router, prefix="/api")

# Mount Socket.IO at /ws — frontend connects via socket.io-client to ws://host:8000/ws
app.mount("/ws", socket_app)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "environment": app_config.ENVIRONMENT,
        "alpaca_connected": (ac := get_alpaca_client()) is not None,
        "alpaca_paper": ac.is_paper if ac else None,
        "engine_running": trading_engine._running,
        "active_bots": len(trading_engine.bots),
        "market_open": trading_engine.market_is_open,
    }
