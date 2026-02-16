"""
Shared FastAPI dependencies.
Re-exports commonly used dependencies for clean imports in routers.
"""

from app.database import get_db

__all__ = ["get_db"]
