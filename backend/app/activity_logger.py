"""
Structured activity logger for trades, reconciliation events, and system events.

Wraps structlog to emit categorised, machine-readable log entries that can be
consumed by monitoring dashboards or persisted to a dedicated activity table
in the future.
"""

from __future__ import annotations

import structlog

logger = structlog.get_logger("activity")


class ActivityLogger:
    """Thin façade over structlog for domain-specific activity logging."""

    async def log(
        self,
        *,
        level: str = "info",
        category: str = "general",
        message: str,
        **extra,
    ) -> None:
        _emit(level, message, category=category, **extra)

    async def trade(self, message: str, **extra) -> None:
        _emit("info", message, category="trade", **extra)

    async def system_event(self, message: str, *, level: str = "info", **extra) -> None:
        _emit(level, message, category="system", **extra)


def _emit(level: str, message: str, **kwargs) -> None:
    log_fn = getattr(logger, level, logger.info)
    log_fn(message, **kwargs)


activity_logger = ActivityLogger()
