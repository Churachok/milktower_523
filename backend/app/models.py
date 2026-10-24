from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from app.db import Base


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds").replace(
        "+00:00", "Z"
    )


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    login: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # client | employee


class UserSession(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # хэш токена
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[str] = mapped_column(String, default=now_iso)
    expires_at: Mapped[str] = mapped_column(String)
    revoked_at: Mapped[str | None] = mapped_column(String, nullable=True)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[str] = mapped_column(String, primary_key=True)  # PT-2026-0042
    owner_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    product_id: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="draft")
    amount: Mapped[float] = mapped_column(Float)  # исходная сумма, рубли
    term: Mapped[int] = mapped_column(Integer)  # исходный срок, месяцы
    purpose: Mapped[str] = mapped_column(String, default="")
    company: Mapped[dict] = mapped_column(JSON)
    finances: Mapped[dict] = mapped_column(JSON)
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    documents: Mapped[list] = mapped_column(JSON, default=list)
    history: Mapped[list] = mapped_column(JSON, default=list)
    messages: Mapped[list] = mapped_column(JSON, default=list)
    calculation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    checks: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    request: Mapped[str | None] = mapped_column(String, nullable=True)
    offer: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=now_iso)
    updated_at: Mapped[str] = mapped_column(String, default=now_iso)


class Check(Base):
    """Результат одной имитации проверки (ЕГРЮЛ, БКИ, документы)."""

    __tablename__ = "checks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"))
    kind: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)  # ok | warning | failed
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String, default=now_iso)


class Decision(Base):
    """Решение сотрудника. Хранится отдельно от рекомендации скоринга."""

    __tablename__ = "decisions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    decision: Mapped[str] = mapped_column(String)  # approved|rejected|needs_info
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    scoring_recommendation: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=now_iso)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String)
    application_id: Mapped[str | None] = mapped_column(String, nullable=True)
    from_status: Mapped[str | None] = mapped_column(String, nullable=True)
    to_status: Mapped[str | None] = mapped_column(String, nullable=True)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[str] = mapped_column(String, default=now_iso)


def next_application_id(db: Session) -> str:
    ids = db.scalars(select(Application.id)).all()
    last = max((int(i.rsplit("-", 1)[1]) for i in ids), default=0)
    return f"PT-{datetime.now(UTC).year}-{last + 1:04d}"
