"""runtime orders, signals, and book-scoped position fields

Revision ID: b8d9e0f1a2b3
Revises: a7c8d9e0f1a2
Create Date: 2026-09-22 09:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision: str = "b8d9e0f1a2b3"
down_revision: Union[str, Sequence[str], None] = "a7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("trades", "bot_id", existing_type=sa.String(36), nullable=True)
    op.add_column("trades", sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True))

    op.alter_column("positions", "bot_id", existing_type=sa.String(36), nullable=True)
    op.add_column("positions", sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True))
    op.add_column("positions", sa.Column("side", sa.String(10), nullable=True))
    op.add_column("positions", sa.Column("trail_atr", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("max_hold_minutes", sa.Integer(), nullable=True))
    op.add_column("positions", sa.Column("cluster_id", sa.String(64), nullable=True))

    op.create_table(
        "strategy_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("params", JSON, nullable=False),
        sa.Column("params_hash", sa.String(64), nullable=False),
        sa.Column("promotion_state", sa.String(32), nullable=False),
        sa.Column("is_live", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "feature_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("values", JSON, nullable=False),
        sa.Column("frozen", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "signals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("regime", sa.String(32), nullable=True),
        sa.Column("engine", sa.String(32), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("components", JSON, nullable=False),
        sa.Column("veto_code", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_order_id", sa.String(64), nullable=False),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("order_type", sa.String(20), nullable=False),
        sa.Column("limit_price", sa.Float(), nullable=True),
        sa.Column("intended_price", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("client_order_id", name="uq_orders_client_order_id"),
    )
    op.create_table(
        "fills",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("fee", sa.Float(), nullable=False),
        sa.Column("slippage", sa.Float(), nullable=False),
        sa.Column("shortfall", sa.Float(), nullable=False),
        sa.Column("filled_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("fills")
    op.drop_table("orders")
    op.drop_table("signals")
    op.drop_table("feature_snapshots")
    op.drop_table("strategy_versions")
    op.drop_column("positions", "cluster_id")
    op.drop_column("positions", "max_hold_minutes")
    op.drop_column("positions", "trail_atr")
    op.drop_column("positions", "side")
    op.drop_column("positions", "user_id")
    op.drop_column("trades", "user_id")
