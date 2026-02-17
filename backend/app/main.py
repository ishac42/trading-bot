"""
FastAPI application entry point.

- Initializes the app with CORS middleware
- Registers all API routers under /api prefix
- Mounts Socket.IO ASGI app at /ws for real-time events
- Provides /api/health endpoint
- Startup/shutdown lifecycle events for database connection
- Starts/stops TradingEngine on application lifecycle
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.routers import bots, trades, positions, market_data
from app.websocket_manager import socket_app
from app.alpaca_client import alpaca_client
from app.trading_engine import trading_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    print(f"Starting {settings.APP_NAME} ({settings.ENVIRONMENT})")
    print("[WebSocket] Socket.IO server mounted at /ws")
    if alpaca_client:
        print(f"[Alpaca] Connected (paper={alpaca_client.is_paper})")
    else:
        print("[Alpaca] Not configured — market data/trading disabled")

    # Start the trading engine (loads running bots, starts market monitor)
    await trading_engine.start()
    print(f"[TradingEngine] Started — {len(trading_engine.bots)} bot(s) loaded")

    yield

    # Shutdown
    print("Shutting down...")
    await trading_engine.stop()
    print("[TradingEngine] Stopped")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers under /api prefix
app.include_router(bots.router, prefix="/api")
app.include_router(trades.router, prefix="/api")
app.include_router(positions.router, prefix="/api")
app.include_router(market_data.router, prefix="/api")

# Mount Socket.IO at /ws — frontend connects via socket.io-client to ws://host:8000/ws
app.mount("/ws", socket_app)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "alpaca_connected": alpaca_client is not None,
        "alpaca_paper": alpaca_client.is_paper if alpaca_client else None,
        "engine_running": trading_engine._running,
        "active_bots": len(trading_engine.bots),
        "market_open": trading_engine.market_is_open,
    }
