"""add activity_logs table

Revision ID: f1a2b3c4d5e6
Revises: e1f2a3b4c5d6
Create Date: 2026-02-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('level', sa.String(10), nullable=False),
        sa.Column('category', sa.String(30), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('details', JSON, nullable=True),
        sa.Column('bot_id', sa.String(36), sa.ForeignKey('bots.id', ondelete='SET NULL'), nullable=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_activity_logs_timestamp', 'activity_logs', ['timestamp'])
    op.create_index('ix_activity_logs_level', 'activity_logs', ['level'])
    op.create_index('ix_activity_logs_category', 'activity_logs', ['category'])
    op.create_index('ix_activity_logs_bot_id', 'activity_logs', ['bot_id'])
    op.create_index('ix_activity_logs_user_id', 'activity_logs', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_activity_logs_user_id', table_name='activity_logs')
    op.drop_index('ix_activity_logs_bot_id', table_name='activity_logs')
    op.drop_index('ix_activity_logs_category', table_name='activity_logs')
    op.drop_index('ix_activity_logs_level', table_name='activity_logs')
    op.drop_index('ix_activity_logs_timestamp', table_name='activity_logs')
    op.drop_table('activity_logs')
