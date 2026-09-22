"""research trials

Revision ID: c9e0f1a2b3c4
Revises: b8d9e0f1a2b3
Create Date: 2026-09-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision: str = "c9e0f1a2b3c4"
down_revision: Union[str, Sequence[str], None] = "b8d9e0f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "research_trials",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("params", JSON, nullable=False),
        sa.Column("params_hash", sa.String(64), nullable=False),
        sa.Column("gate", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("failure_reason", sa.String(64), nullable=True),
        sa.Column("metrics", JSON, nullable=False),
        sa.Column("data_source", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_research_trials_user_created",
        "research_trials",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_research_trials_user_created", table_name="research_trials")
    op.drop_table("research_trials")
