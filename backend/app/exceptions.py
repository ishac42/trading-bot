"""
Custom exception hierarchy for the trading bot application.

All domain exceptions inherit from AppException and carry:
  - message: human-readable description
  - error_code: machine-readable string (e.g. "BOT_NOT_FOUND")
  - details: optional dict with contextual data
  - status_code: HTTP status code for the response

Routers raise these instead of raw HTTPException. The global
exception handler in middleware.py catches them and returns a
consistent ErrorResponseSchema.
"""

from __future__ import annotations

from typing import Any


class AppException(Exception):
    """Base exception for all application errors."""

    status_code: int = 500
    error_code: str = "INTERNAL_ERROR"

    def __init__(
        self,
        message: str = "An unexpected error occurred",
        *,
        error_code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message
        if error_code is not None:
            self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


class UnauthorizedError(AppException):
    """Authentication required or token invalid (401)."""

    status_code = 401
    error_code = "UNAUTHORIZED"

    def __init__(self, message: str = "Authentication required", **kwargs: Any) -> None:
        super().__init__(message, **kwargs)


class NotFoundError(AppException):
    """Resource not found (404)."""

    status_code = 404
    error_code = "NOT_FOUND"

    def __init__(
        self,
        resource: str = "Resource",
        resource_id: str = "",
        **kwargs: Any,
    ) -> None:
        msg = f"{resource} not found" if not resource_id else f"{resource} with ID {resource_id} not found"
        super().__init__(msg, error_code=f"{resource.upper()}_NOT_FOUND", **kwargs)


class ConflictError(AppException):
    """Action conflicts with current resource state (409)."""

    status_code = 409
    error_code = "CONFLICT"


class ValidationError(AppException):
    """Request data fails business-rule validation (422)."""

    status_code = 422
    error_code = "VALIDATION_ERROR"


class BadRequestError(AppException):
    """Generic client error (400)."""

    status_code = 400
    error_code = "BAD_REQUEST"


class ExternalServiceError(AppException):
    """Upstream service (Alpaca, etc.) failed (502)."""

    status_code = 502
    error_code = "EXTERNAL_SERVICE_ERROR"

    def __init__(
        self,
        service: str = "External service",
        message: str = "",
        **kwargs: Any,
    ) -> None:
        msg = f"{service} error" if not message else f"{service}: {message}"
        super().__init__(msg, error_code=f"{service.upper().replace(' ', '_')}_ERROR", **kwargs)


class RateLimitError(AppException):
    """Rate limit exceeded (429)."""

    status_code = 429
    error_code = "RATE_LIMIT_EXCEEDED"


class TradingNotAllowedError(AppException):
    """Trading action not permitted in current state (403)."""

    status_code = 403
    error_code = "TRADING_NOT_ALLOWED"
