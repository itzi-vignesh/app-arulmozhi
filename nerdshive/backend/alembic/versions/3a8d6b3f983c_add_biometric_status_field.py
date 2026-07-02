"""add_biometric_status_field

Revision ID: 3a8d6b3f983c
Revises: 9a177d083e04
Create Date: 2026-06-25 10:12:02.017290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a8d6b3f983c'
down_revision: Union[str, None] = '9a177d083e04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('companies', sa.Column('biometric_status', sa.String(), server_default='NOT_REQUESTED', nullable=False))


def downgrade() -> None:
    op.drop_column('companies', 'biometric_status')
