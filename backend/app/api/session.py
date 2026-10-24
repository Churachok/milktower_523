from typing import Annotated

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select

from app.config import get_settings
from app.deps import (
    SESSION_COOKIE,
    SESSION_TTL,
    CurrentUser,
    Db,
    create_session,
    revoke_session,
)
from app.errors import ApiError
from app.models import User

router = APIRouter(prefix="/api/v1")


@router.get("/session")
def get_session(user: CurrentUser):
    return {"role": user.role}


@router.delete("/session", status_code=204)
def logout(request: Request, db: Db):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        revoke_session(db, token)
    resp = Response(status_code=204)
    resp.delete_cookie(SESSION_COOKIE, path="/")
    return resp


def _safe_next(value: str) -> str:
    if value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
    if any(value == o or value.startswith(o + "/") for o in origins):
        return value
    return "/"


@router.get("/demo/login/{login}")
def demo_login(login: str, db: Db, next_url: Annotated[str, Query(alias="next")] = "/"):
    """Демо-вход для синтетических пользователей: пароля нет."""
    settings = get_settings()
    if not settings.demo_login_enabled:
        raise ApiError(404, "not_found", "Не найдено")
    user = db.scalar(select(User).where(User.login == login))
    if user is None:
        raise ApiError(404, "not_found", "Пользователь не найден")
    token = create_session(db, user)
    resp = RedirectResponse(_safe_next(next_url), status_code=303)
    resp.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )
    return resp
