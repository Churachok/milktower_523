from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_engine, run_migrations
from app.models import Application, User, next_application_id
from app.seed import seed

IDS = {"PT-2026-0042", "PT-2026-0038", "PT-2026-0045", "PT-2026-0046"}


def test_seed_created(client):
    with Session(get_engine()) as db:
        assert db.scalar(select(func.count(User.id))) == 3
        assert set(db.scalars(select(Application.id))) == IDS


def test_seed_is_idempotent(client):
    with Session(get_engine()) as db:
        seed(db)
        assert db.scalar(select(func.count(User.id))) == 3
        assert db.scalar(select(func.count(Application.id))) == 4


def test_migrations_repeatable(client):
    run_migrations()


def test_foreign_keys_enabled(client):
    with get_engine().connect() as c:
        assert c.exec_driver_sql("PRAGMA foreign_keys").scalar() == 1


def test_next_application_id(client):
    with Session(get_engine()) as db:
        assert next_application_id(db) == "PT-2026-0047"
