"""
SQLAlchemy ORM models for Users, Bots, Trades, and Positions.

These models define the database schema and must align with:
- Frontend TypeScript interfaces in types/index.ts
- Pydantic schemas in app/schemas.py
- ARCHITECTURE.md database schema section
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def generate_uuid() -> str:
    """Generate a new UUID string for use as primary key."""
    return str(uuid.uuid4())


def utcnow() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


# =============================================================================
# Users Table — matches frontend User interface in types/index.ts
# =============================================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    google_sub: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="google")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    # Relationships
    settings: Mapped[list["AppSettings"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_users_google_sub", "google_sub"),
        Index("ix_users_email", "email"),
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id!r}, email={self.email!r})>"


# =============================================================================
# AppSettings Table — per-user settings stored as JSON by category
# =============================================================================

class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    settings: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    user: Mapped["User"] = relationship(back_populates="settings")

    __table_args__ = (
        UniqueConstraint("user_id", "category", name="uq_user_category"),
        Index("ix_app_settings_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<AppSettings(user_id={self.user_id!r}, category={self.category!r})>"


# =============================================================================
# Bots Table — matches frontend Bot interface in types/index.ts
# =============================================================================

class Bot(Base):
    __tablename__ = "bots"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="stopped"
    )  # 'running' | 'paused' | 'stopped' | 'error'
    capital: Mapped[float] = mapped_column(Float, nullable=False)
    trading_frequency: Mapped[int] = mapped_column(Integer, nullable=False)

    # JSON columns for flexible configuration
    indicators: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    risk_management: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    symbols: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Trading window
    start_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=9)
    start_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    end_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=12)
    end_minute: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )
    last_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # Status tracking (required by frontend Bot interface)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    trades: Mapped[list["Trade"]] = relationship(
        back_populates="bot", cascade="all, delete-orphan"
    )
    positions: Mapped[list["Position"]] = relationship(
        back_populates="bot", cascade="all, delete-orphan"
    )

    # Indexes
    __table_args__ = (
        Index("ix_bots_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<Bot(id={self.id!r}, name={self.name!r}, status={self.status!r})>"


# =============================================================================
# Trades Table — matches frontend Trade interface in types/index.ts
# =============================================================================

class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    bot_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bots.id", ondelete="CASCADE"), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # 'buy' | 'sell'
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    # Optional fields
    indicators_snapshot: Mapped[dict | None] = mapped_column(
        JSON, nullable=True, default=None
    )
    profit_loss: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )
    order_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )  # Alpaca order statuses: pending, filled, cancelled, failed, accepted, partially_filled, pending_new, etc.
    commission: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )
    slippage: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )

    # Sprint F: linking and traceability
    client_order_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None
    )
    reason: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None
    )

    # Relationships
    bot: Mapped["Bot"] = relationship(back_populates="trades")

    # Indexes (per ARCHITECTURE.md Implementation Notes)
    __table_args__ = (
        Index("ix_trades_bot_id", "bot_id"),
        Index("ix_trades_symbol", "symbol"),
        Index("ix_trades_timestamp", "timestamp"),
        Index("ix_trades_status", "status"),
        Index("ix_trades_client_order_id", "client_order_id"),
    )

    def __repr__(self) -> str:
        return f"<Trade(id={self.id!r}, symbol={self.symbol!r}, type={self.type!r})>"


# =============================================================================
# Positions Table — matches frontend Position interface in types/index.ts
# =============================================================================

class Position(Base):
    __tablename__ = "positions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=generate_uuid
    )
    bot_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bots.id", ondelete="CASCADE"), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    current_price: Mapped[float] = mapped_column(Float, nullable=False)

    # Optional price levels
    stop_loss_price: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )
    take_profit_price: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None
    )

    # P&L
    unrealized_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    realized_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Timestamps
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    # Status
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Entry-indicator tracking — which indicator triggered the buy (e.g. "RSI", "MACD")
    entry_indicator: Mapped[str | None] = mapped_column(
        String(50), nullable=True, default=None
    )

    # Relationships
    bot: Mapped["Bot"] = relationship(back_populates="positions")

    # Indexes (per ARCHITECTURE.md Implementation Notes)
    __table_args__ = (
        Index("ix_positions_bot_id", "bot_id"),
        Index("ix_positions_symbol", "symbol"),
        Index("ix_positions_is_open", "is_open"),
    )

    def __repr__(self) -> str:
        return f"<Position(id={self.id!r}, symbol={self.symbol!r}, is_open={self.is_open!r})>"
