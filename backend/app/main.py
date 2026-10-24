from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api import applications, session
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(session.router)
app.include_router(applications.router)


@app.get("/healthz")
def healthz():
    if not getattr(app.state, "ready", False):
        return JSONResponse({"status": "starting"}, status_code=503)
    return {"status": "ok"}
