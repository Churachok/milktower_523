import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.db import get_engine
from app.errors import ApiError
from app.models import User, UserSession, now_iso

SESSION_COOKIE = "session"
SESSION_TTL = timedelta(hours=12)


def get_db():
    with Session(get_engine()) as db:
        yield db


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    expires = (datetime.now(UTC) + SESSION_TTL).isoformat(
        timespec="seconds"
    ).replace("+00:00", "Z")
    db.add(UserSession(id=_hash(token), user_id=user.id, expires_at=expires))
    db.commit()
    return token


def revoke_session(db: Session, token: str) -> None:
    s = db.get(UserSession, _hash(token))
    if s and s.revoked_at is None:
        s.revoked_at = now_iso()
        db.commit()


def current_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        s = db.get(UserSession, _hash(token))
        if s and s.revoked_at is None and s.expires_at > now_iso():
            user = db.get(User, s.user_id)
            if user:
                return user
    raise ApiError(401, "unauthorized", "Требуется вход в кабинет")


Db = Annotated[Session, Depends(get_db)]
CurrentUser = Annotated[User, Depends(current_user)]
