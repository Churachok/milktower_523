from functools import lru_cache
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine():
    path = Path(get_settings().data_dir) / "app.db"
    engine = create_engine(
        f"sqlite:///{path}", connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def _pragmas(conn, _):
        cur = conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

    return engine


def run_migrations() -> None:
    cfg = Config()
    base = Path(__file__).resolve().parent.parent
    cfg.set_main_option("script_location", str(base / "migrations"))
    cfg.attributes["engine"] = get_engine()
    command.upgrade(cfg, "head")
