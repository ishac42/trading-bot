"""add client_order_id and reason to trades

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('trades', sa.Column('client_order_id', sa.String(100), nullable=True))
    op.add_column('trades', sa.Column('reason', sa.String(255), nullable=True))
    op.create_index('ix_trades_client_order_id', 'trades', ['client_order_id'])


def downgrade() -> None:
    op.drop_index('ix_trades_client_order_id', table_name='trades')
    op.drop_column('trades', 'reason')
    op.drop_column('trades', 'client_order_id')
