"""add_primary_indicator_to_bots

Revision ID: a1b2c3d4e5f6
Revises: d0f131fcbb06
Create Date: 2026-02-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd0f131fcbb06'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add primary_indicator column to bots table."""
    op.add_column(
        'bots',
        sa.Column('primary_indicator', sa.String(length=50), nullable=False, server_default='')
    )


def downgrade() -> None:
    """Remove primary_indicator column from bots table."""
    op.drop_column('bots', 'primary_indicator')
