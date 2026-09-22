"""book control plane tables and nullable book fields

Revision ID: a7c8d9e0f1a2
Revises: f1a2b3c4d5e6
Create Date: 2026-09-22 08:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision: str = "a7c8d9e0f1a2"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "universe_snapshots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("filters", JSON, nullable=False),
        sa.Column("members", JSON, nullable=False),
    )
    op.create_index("ix_universe_snapshots_user_as_of", "universe_snapshots", ["user_id", "as_of"])

    op.create_table(
        "risk_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("reason_code", sa.String(64), nullable=False),
        sa.Column("payload", JSON, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_risk_events_user_created", "risk_events", ["user_id", "created_at"])

    op.add_column("bots", sa.Column("profile", JSON, nullable=True))

    op.add_column("trades", sa.Column("reason_code", sa.String(64), nullable=True))
    op.add_column("trades", sa.Column("shortfall", sa.Float(), nullable=True))
    op.add_column("trades", sa.Column("regime", sa.String(32), nullable=True))
    op.add_column("trades", sa.Column("session", sa.String(32), nullable=True))

    op.add_column("positions", sa.Column("score", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("veto_code", sa.String(64), nullable=True))
    op.add_column("positions", sa.Column("regime", sa.String(32), nullable=True))
    op.add_column("positions", sa.Column("expected_cost", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("realized_cost", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("hold_minutes", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("atr_stop", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("target_price", sa.Float(), nullable=True))
    op.add_column("positions", sa.Column("open_stop_risk", sa.Float(), nullable=True))


def downgrade() -> None:
    for name in (
        "open_stop_risk", "target_price", "atr_stop", "hold_minutes",
        "realized_cost", "expected_cost", "regime", "veto_code", "score",
    ):
        op.drop_column("positions", name)
    for name in ("session", "regime", "shortfall", "reason_code"):
        op.drop_column("trades", name)
    op.drop_column("bots", "profile")
    op.drop_index("ix_risk_events_user_created", table_name="risk_events")
    op.drop_table("risk_events")
    op.drop_index("ix_universe_snapshots_user_as_of", table_name="universe_snapshots")
    op.drop_table("universe_snapshots")
