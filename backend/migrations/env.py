from alembic import context

import app.models  # noqa: F401  (регистрирует таблицы)
from app.db import Base, get_engine

engine = context.config.attributes.get("engine") or get_engine()
with engine.begin() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
