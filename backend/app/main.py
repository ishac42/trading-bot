"""
FastAPI application entry point.

- Initializes the app with CORS middleware
- Registers all API routers under /api prefix
- Mounts Socket.IO ASGI app at /ws for real-time events
- Provides /api/health endpoint
- Startup/shutdown lifecycle events for database connection
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.routers import bots, trades, positions, market_data
from app.websocket_manager import socket_app


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    print(f"Starting {settings.APP_NAME} ({settings.ENVIRONMENT})")
    print("[WebSocket] Socket.IO server mounted at /ws")
    yield
    # Shutdown
    print("Shutting down...")
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
    return {"status": "healthy", "environment": settings.ENVIRONMENT}
