"""add_user_id_to_bots

Revision ID: e1f2a3b4c5d6
Revises: a0693d075f6d
Create Date: 2026-02-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, Sequence[str], None] = 'a0693d075f6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add user_id FK column to bots table."""
    # Step 1: Add column as nullable first (existing rows have no user_id)
    op.add_column('bots', sa.Column('user_id', sa.String(length=36), nullable=True))

    # Step 2: Assign existing bots to the first user (if any exist).
    # In production, run a manual data-migration script before deploying.
    op.execute(
        "UPDATE bots SET user_id = (SELECT id FROM users LIMIT 1) WHERE user_id IS NULL"
    )

    # Step 3: Make column non-nullable and add FK + index
    op.alter_column('bots', 'user_id', nullable=False)
    op.create_foreign_key(
        'fk_bots_user_id', 'bots', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )
    op.create_index('ix_bots_user_id', 'bots', ['user_id'], unique=False)


def downgrade() -> None:
    """Remove user_id column from bots table."""
    op.drop_index('ix_bots_user_id', table_name='bots')
    op.drop_constraint('fk_bots_user_id', 'bots', type_='foreignkey')
    op.drop_column('bots', 'user_id')
