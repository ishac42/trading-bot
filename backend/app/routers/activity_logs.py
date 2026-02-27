"""
Activity Log API — paginated, filterable log viewer.

Endpoints:
  GET /api/activity-logs          → list activity logs (filtered, paginated)
  GET /api/activity-logs/levels   → available log levels
"""

from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import ActivityLog, User
from app.schemas import (
    ActivityLogListResponseSchema,
    ActivityLogResponseSchema,
    PaginationSchema,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/activity-logs", tags=["activity-logs"])


def _log_to_response(log: ActivityLog) -> dict:
    """Convert an ActivityLog ORM model to the response dict."""
    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "level": log.level,
        "category": log.category,
        "message": log.message,
        "details": log.details,
        "bot_id": log.bot_id,
        "user_id": log.user_id,
    }


@router.get("/levels")
async def get_levels(
    _user: User = Depends(get_current_user),
):
    """Return available log levels and categories for filtering."""
    return {
        "levels": ["debug", "info", "warning", "error"],
        "categories": ["trade", "bot", "auth", "system", "risk", "error"],
    }


@router.get("", response_model=ActivityLogListResponseSchema)
async def get_activity_logs(
    level: str = Query(""),
    category: str = Query(""),
    botId: str = Query(""),
    dateRange: str = Query("all"),
    search: str = Query(""),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List activity logs with filtering and pagination."""
    query = select(ActivityLog)

    if level:
        query = query.where(ActivityLog.level == level.lower())
    if category:
        query = query.where(ActivityLog.category == category.lower())
    if botId:
        query = query.where(ActivityLog.bot_id == botId)
    if search:
        query = query.where(ActivityLog.message.ilike(f"%{search}%"))

    now = datetime.now(timezone.utc)
    if dateRange == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.where(ActivityLog.timestamp >= start)
    elif dateRange == "week":
        query = query.where(ActivityLog.timestamp >= now - timedelta(days=7))
    elif dateRange == "month":
        query = query.where(ActivityLog.timestamp >= now - timedelta(days=30))

    count_query = select(func.count()).select_from(query.subquery())
    total_items = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ActivityLog.timestamp.desc())
    offset = (page - 1) * pageSize
    query = query.offset(offset).limit(pageSize)

    result = await db.execute(query)
    logs = result.scalars().all()

    total_pages = max(1, -(-total_items // pageSize))

    return ActivityLogListResponseSchema(
        logs=[ActivityLogResponseSchema(**_log_to_response(l)) for l in logs],
        pagination=PaginationSchema(
            page=page,
            pageSize=pageSize,
            totalItems=total_items,
            totalPages=total_pages,
        ),
    )
