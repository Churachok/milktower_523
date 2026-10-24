import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from app.config import get_settings
from app.errors import register_errors


def init_storage() -> None:
    data = Path(get_settings().data_dir)
    data.mkdir(parents=True, exist_ok=True)
    (data / "uploads").mkdir(exist_ok=True)
    conn = sqlite3.connect(data / "app.db")  # проверка, что БД открывается
    conn.execute("SELECT 1")
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    init_storage()
    app.state.ready = True
    yield


app = FastAPI(title="Milk Tower backend", lifespan=lifespan)
register_errors(app)


@app.get("/healthz")
def healthz():
    from fastapi.responses import JSONResponse

    if not getattr(app.state, "ready", False):
        return JSONResponse({"status": "starting"}, status_code=503)
    return {"status": "ok"}