"""
WebSocket real-time layer using python-socketio.

Provides a Socket.IO server that broadcasts events the frontend subscribes to:
  - trade_executed      → when a trade is executed
  - position_updated    → when a position changes (open/close/price update)
  - bot_status_changed  → when a bot starts/stops/pauses/errors
  - price_update        → real-time price changes
  - market_status_changed → market open/close status changes

The frontend connects via socket.io-client at ws://localhost:8000/ws
"""

import socketio

from app.config import settings

# Create async Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.CORS_ORIGINS,
    ping_interval=settings.WS_PING_INTERVAL,
    ping_timeout=settings.WS_PING_TIMEOUT,
    logger=settings.DEBUG,
    engineio_logger=False,
)

# Wrap as ASGI app to mount on FastAPI
# socketio_path="/" means ASGIApp routes all requests at the mount point to the engine
# Combined with app.mount("/ws", ...) → frontend uses path: "/ws/socket.io/"
socket_app = socketio.ASGIApp(sio, socketio_path="/")


# ---------------------------------------------------------------------------
# Connection event handlers
# ---------------------------------------------------------------------------

@sio.event
async def connect(sid, environ):
    """Client connected."""
    print(f"[WebSocket] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    """Client disconnected."""
    print(f"[WebSocket] Client disconnected: {sid}")


# ---------------------------------------------------------------------------
# WebSocketManager — singleton used by routers / engine to broadcast events
# ---------------------------------------------------------------------------

class WebSocketManager:
    """
    Broadcasts events to all connected Socket.IO clients.
    Imported and used by routers, trading engine, etc.
    """

    async def emit_trade_executed(self, trade: dict) -> None:
        """Broadcast a new trade execution to all clients."""
        await sio.emit("trade_executed", trade)

    async def emit_position_updated(self, position: dict) -> None:
        """Broadcast a position update (open/close/price change) to all clients."""
        await sio.emit("position_updated", position)

    async def emit_bot_status_changed(self, bot: dict) -> None:
        """
        Broadcast a bot status change to all clients.
        Payload should include at minimum: { id, status, is_active }
        """
        await sio.emit("bot_status_changed", bot)

    async def emit_price_update(self, data: dict) -> None:
        """
        Broadcast a real-time price update to all clients.
        Payload: { symbol, price, timestamp }
        """
        await sio.emit("price_update", data)

    async def emit_market_status_changed(self, status: dict) -> None:
        """Broadcast a market status change (open/close) to all clients."""
        await sio.emit("market_status_changed", status)


# Singleton instance — import this wherever you need to emit events
ws_manager = WebSocketManager()
