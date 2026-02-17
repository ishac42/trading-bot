"""entry_indicator_tracking

Drop primary_indicator from bots table,
add entry_indicator to positions table.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-17 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop primary_indicator from bots; add entry_indicator to positions."""
    op.drop_column('bots', 'primary_indicator')
    op.add_column(
        'positions',
        sa.Column('entry_indicator', sa.String(length=50), nullable=True)
    )


def downgrade() -> None:
    """Reverse: drop entry_indicator from positions; restore primary_indicator on bots."""
    op.drop_column('positions', 'entry_indicator')
    op.add_column(
        'bots',
        sa.Column('primary_indicator', sa.String(length=50), nullable=False, server_default='')
    )
