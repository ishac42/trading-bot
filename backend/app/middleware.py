"""
Middleware and global exception handlers.

- RequestIdMiddleware: attaches a unique X-Request-ID to every request/response
- RequestLoggingMiddleware: logs method, path, status, and duration
- Exception handlers: map AppException / ValidationError / unhandled to ErrorResponseSchema
"""

from __future__ import annotations

import time
import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.exceptions import AppException

logger = structlog.get_logger(__name__)


# ─── Error response helper ────────────────────────────────────────────────

def _error_response(
    status_code: int,
    code: str,
    message: str,
    details: dict | None = None,
    request_id: str | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "request_id": request_id,
            }
        },
    )


# ─── Exception handlers ──────────────────────────────────────────────────

async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.warning(
        "app_error",
        error_code=exc.error_code,
        message=exc.message,
        status_code=exc.status_code,
        request_id=request_id,
    )
    return _error_response(
        status_code=exc.status_code,
        code=exc.error_code,
        message=exc.message,
        details=exc.details,
        request_id=request_id,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    field_errors = [
        {"field": " → ".join(str(loc) for loc in e["loc"]), "message": e["msg"]}
        for e in exc.errors()
    ]
    logger.warning(
        "validation_error",
        errors=field_errors,
        request_id=request_id,
    )
    return _error_response(
        status_code=422,
        code="VALIDATION_ERROR",
        message="Request validation failed",
        details={"errors": field_errors},
        request_id=request_id,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        "unhandled_error",
        error=str(exc),
        error_type=type(exc).__name__,
        request_id=request_id,
        exc_info=exc,
    )
    return _error_response(
        status_code=500,
        code="INTERNAL_ERROR",
        message="An unexpected error occurred",
        request_id=request_id,
    )


# ─── Middleware ───────────────────────────────────────────────────────────

class RequestIdMiddleware(BaseHTTPMiddleware):
    """Generate a unique request ID for every request and bind it to the logging context."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status code, and duration for every request."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)

        if not request.url.path.startswith("/ws"):
            logger.info(
                "request",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                duration_ms=duration_ms,
            )
        return response


# ─── Registration helper ─────────────────────────────────────────────────

def register_middleware_and_handlers(app: FastAPI) -> None:
    """Wire up all middleware and exception handlers onto the FastAPI app."""
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RequestIdMiddleware)

    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
