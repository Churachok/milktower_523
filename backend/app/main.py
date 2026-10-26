from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api import actions, applications, session
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


app = FastAPI(
    title="Milk Tower backend", version="1.1.0", lifespan=lifespan,
    docs_url=None, openapi_url="/api/v1/openapi.json", redoc_url=None,
)
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
app.include_router(actions.router)


@app.middleware("http")
async def request_policy(request, call_next):
    # Browser writes must originate from this application or an explicitly
    # configured frontend. CLI clients without Origin remain supported.
    if request.method in {"POST", "PATCH", "PUT", "DELETE"} or request.url.path.startswith("/api/v1/demo/login/"):
        origin = request.headers.get("origin")
        allowed = {str(request.base_url).rstrip("/")}
        allowed.update(o.strip() for o in get_settings().cors_origins.split(",") if o.strip())
        if (origin and origin not in allowed) or (
            not origin and request.headers.get("sec-fetch-site") == "cross-site"
        ):
            return JSONResponse({"code": "origin_denied", "message": "Откройте действие из кредитного кабинета"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Request-ID"] = str(uuid4())
    response.headers["X-Content-Type-Options"] = "nosniff"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/v1/version")
def version():
    settings = get_settings()
    return {"version": settings.release_version, "commit": settings.build_commit,
            "mode": "synthetic-demo", "scoring": "rules-1.0.1"}


@app.get("/healthz")
def healthz():
    if not getattr(app.state, "ready", False):
        return JSONResponse({"status": "starting"}, status_code=503)
    return {"status": "ok"}


@app.get("/api/v1/docs", include_in_schema=False)
def api_docs():
    return get_swagger_ui_html(
        openapi_url="/api/v1/openapi.json", title="Milk Tower API — Swagger UI",
        swagger_js_url="/api-docs/swagger-ui-bundle.js",
        swagger_css_url="/api-docs/swagger-ui.css",
        swagger_favicon_url="/favicon.svg",
    )
