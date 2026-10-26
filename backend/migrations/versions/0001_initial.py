"""initial schema"""

from alembic import op

import app.models  # noqa: F401
from app.db import Base

revision = "0001"
down_revision = None


def upgrade() -> None:
    Base.metadata.create_all(op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(op.get_bind())
