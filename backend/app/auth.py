"""
Authentication utilities for Google OAuth and JWT token management.

Provides:
  - Google ID token verification via google.oauth2.id_token
  - JWT creation and validation using python-jose
  - FastAPI dependency (get_current_user) for protecting endpoints
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import structlog
from fastapi import Depends, Request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.exceptions import UnauthorizedError
from app.models import User

logger = structlog.get_logger(__name__)

# Reusable transport for Google token verification
_google_transport = google_requests.Request()


def verify_google_token(credential: str) -> dict:
    """
    Verify a Google ID token and return the decoded payload.

    Raises UnauthorizedError if the token is invalid or the audience doesn't match.
    """
    try:
        payload = google_id_token.verify_oauth2_token(
            credential,
            _google_transport,
            audience=settings.GOOGLE_CLIENT_ID,
        )

        if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
            raise UnauthorizedError("Invalid token issuer")

        return payload
    except ValueError as e:
        logger.warning("google_token_verification_failed", error=str(e))
        raise UnauthorizedError("Invalid Google credential") from e


def create_jwt(user_id: str) -> str:
    """Create a signed JWT for the given user ID."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": now,
        "exp": now + timedelta(hours=settings.JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Decode and validate a JWT. Raises UnauthorizedError on failure."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise UnauthorizedError("Invalid or expired token") from e


def _extract_token(request: Request) -> str:
    """Extract Bearer token from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing authorization token")
    return auth_header[7:]


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts the JWT from the Authorization header,
    validates it, and returns the corresponding User from the database.
    """
    token = _extract_token(request)
    payload = decode_jwt(token)

    user_id = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError("User not found")

    return user
