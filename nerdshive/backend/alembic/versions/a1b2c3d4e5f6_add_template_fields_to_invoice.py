"""add_template_fields_to_invoice

Revision ID: a1b2c3d4e5f6
Revises: e7bcd702d284
Create Date: 2026-06-29 15:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e7bcd702d284'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoices', sa.Column('template_version', sa.Integer(), nullable=True))
    op.add_column('invoices', sa.Column('template_snapshot', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('invoices', 'template_snapshot')
    op.drop_column('invoices', 'template_version')
