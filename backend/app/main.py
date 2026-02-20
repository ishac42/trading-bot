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
from app.routers import account, auth, bots, trades, positions, market_data, settings as settings_router
from app.websocket_manager import socket_app
from app.alpaca_client import alpaca_client
from app.trading_engine import trading_engine

logger = structlog.get_logger(__name__)


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

    if alpaca_client:
        logger.info("alpaca_connected", paper=alpaca_client.is_paper)
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
    allow_origins=app_config.CORS_ORIGINS,
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

# Mount Socket.IO at /ws — frontend connects via socket.io-client to ws://host:8000/ws
app.mount("/ws", socket_app)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "environment": app_config.ENVIRONMENT,
        "alpaca_connected": alpaca_client is not None,
        "alpaca_paper": alpaca_client.is_paper if alpaca_client else None,
        "engine_running": trading_engine._running,
        "active_bots": len(trading_engine.bots),
        "market_open": trading_engine.market_is_open,
    }
