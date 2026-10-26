"""Persist the ML response separately from the employee's decision."""
from alembic import op
from sqlalchemy import JSON, Column, inspect

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    # 0001 creates the current metadata on a fresh installation.
    columns = {c["name"] for c in inspect(op.get_bind()).get_columns("applications")}
    if "scoring_result" not in columns:
        op.add_column("applications", Column("scoring_result", JSON, nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "scoring_result")
