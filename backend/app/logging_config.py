"""
Structured logging configuration using structlog.

- Development: colorized, human-readable console output
- Production: JSON lines for machine parsing

Call configure_logging() once at app startup (in main.py lifespan).
"""

from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(*, environment: str = "development", log_level: str = "INFO") -> None:
    """
    Configure structlog + stdlib logging.

    Args:
        environment: "development" for console output, anything else for JSON.
        log_level: Root log level string (DEBUG, INFO, WARNING, ERROR).
    """
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if environment == "development":
        renderer: structlog.types.Processor = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Quiet noisy third-party loggers
    for name in ("uvicorn.access", "sqlalchemy.engine", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)
