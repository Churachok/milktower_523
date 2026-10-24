from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_engine, run_migrations
from app.errors import register_errors
from app.seed import seed


def init_storage() -> None:
    data = Path(get_settings().data_dir)
    data.mkdir(parents=True, exist_ok=True)
    (data / "uploads").mkdir(exist_ok=True)
    run_migrations()
    with Session(get_engine()) as db:
        seed(db)


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
    if not getattr(app.state, "ready", False):
        return JSONResponse({"status": "starting"}, status_code=503)
    return {"status": "ok"}
