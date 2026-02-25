"""
Persistent activity logger that writes to the activity_logs DB table.

Respects the LOG_LEVEL env variable — only persists entries at or above the
configured level. Also emits to structlog so console output is unchanged.

Usage:
    from app.activity_logger import activity_logger

    await activity_logger.log(
        level="info",
        category="trade",
        message="BUY executed: AAPL x10 @ $150.00",
        details={"symbol": "AAPL", "qty": 10},
        bot_id="...",
        user_id="...",
    )
"""

from __future__ import annotations

import logging
from typing import Any

import structlog

from app.config import settings
from app.database import async_session
from app.models import ActivityLog, generate_uuid, utcnow

logger = structlog.get_logger(__name__)

LEVEL_MAP = {
    "debug": logging.DEBUG,
    "verbose": logging.DEBUG,
    "info": logging.INFO,
    "warning": logging.WARNING,
    "error": logging.ERROR,
}


def _should_log(level: str) -> bool:
    """Check if the given level meets the configured LOG_LEVEL threshold."""
    numeric_level = LEVEL_MAP.get(level.lower(), logging.INFO)
    configured_level = LEVEL_MAP.get(settings.LOG_LEVEL.lower(), logging.INFO)
    return numeric_level >= configured_level


class ActivityLogger:
    """Singleton activity logger that persists to the DB."""

    async def log(
        self,
        *,
        level: str,
        category: str,
        message: str,
        details: dict[str, Any] | None = None,
        bot_id: str | None = None,
        user_id: str | None = None,
    ) -> None:
        """
        Persist an activity log entry if the level is at or above LOG_LEVEL.
        Always emits to structlog regardless.
        """
        structlog_method = getattr(logger, level.lower() if level.lower() != "verbose" else "debug", logger.info)
        structlog_method(
            message,
            category=category,
            bot_id=bot_id[:8] if bot_id else None,
            user_id=user_id[:8] if user_id else None,
            **(details or {}),
        )

        if not _should_log(level):
            return

        try:
            async with async_session() as session:
                entry = ActivityLog(
                    id=generate_uuid(),
                    timestamp=utcnow(),
                    level=level.lower() if level.lower() != "verbose" else "debug",
                    category=category,
                    message=message,
                    details=details,
                    bot_id=bot_id,
                    user_id=user_id,
                )
                session.add(entry)
                await session.commit()
        except Exception as e:
            logger.error("Failed to persist activity log: %s", e)

    async def trade(self, message: str, *, bot_id: str | None = None, user_id: str | None = None, **details: Any) -> None:
        await self.log(level="info", category="trade", message=message, details=details or None, bot_id=bot_id, user_id=user_id)

    async def bot_event(self, message: str, *, level: str = "info", bot_id: str | None = None, user_id: str | None = None, **details: Any) -> None:
        await self.log(level=level, category="bot", message=message, details=details or None, bot_id=bot_id, user_id=user_id)

    async def auth_event(self, message: str, *, level: str = "info", user_id: str | None = None, **details: Any) -> None:
        await self.log(level=level, category="auth", message=message, details=details or None, user_id=user_id)

    async def risk_event(self, message: str, *, bot_id: str | None = None, **details: Any) -> None:
        await self.log(level="warning", category="risk", message=message, details=details or None, bot_id=bot_id)

    async def system_event(self, message: str, *, level: str = "info", **details: Any) -> None:
        await self.log(level=level, category="system", message=message, details=details or None)

    async def error_event(self, message: str, *, bot_id: str | None = None, user_id: str | None = None, **details: Any) -> None:
        await self.log(level="error", category="error", message=message, details=details or None, bot_id=bot_id, user_id=user_id)


activity_logger = ActivityLogger()
