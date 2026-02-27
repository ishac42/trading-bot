"""
Authentication router for Google OAuth login.

Endpoints:
  POST /auth/google  — Verify Google credential, create/update user, return JWT
  GET  /auth/me      — Return the currently authenticated user
"""

from __future__ import annotations

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.activity_logger import activity_logger
from app.auth import create_jwt, get_current_user, verify_google_token
from app.database import get_db
from app.models import User
from app.schemas import AuthResponse, GoogleAuthRequest, UserResponse

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=AuthResponse)
async def google_login(
    body: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate with a Google ID token.
    Creates a new user on first login, or updates profile on subsequent logins.
    """
    google_payload = verify_google_token(body.credential)

    google_sub = google_payload["sub"]
    email = google_payload.get("email", "")
    name = google_payload.get("name", email.split("@")[0])
    avatar_url = google_payload.get("picture")

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user:
        user.name = name
        user.avatar_url = avatar_url
        user.last_login_at = datetime.now(timezone.utc)
        logger.info("user_login", user_id=user.id, email=user.email)
        await activity_logger.auth_event(
            f"User '{name}' ({email}) logged in",
            user_id=user.id,
            email=email,
        )
    else:
        user = User(
            email=email,
            name=name,
            avatar_url=avatar_url,
            google_sub=google_sub,
            provider="google",
        )
        db.add(user)
        await db.flush()
        logger.info("user_created", user_id=user.id, email=user.email)
        await activity_logger.auth_event(
            f"New user '{name}' ({email}) created via Google OAuth",
            user_id=user.id,
            email=email,
        )

    token = create_jwt(user.id)

    return AuthResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            provider=user.provider,
            created_at=user.created_at.isoformat(),
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        provider=user.provider,
        created_at=user.created_at.isoformat(),
    )
