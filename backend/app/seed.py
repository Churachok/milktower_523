"""ВРЕМЕННАЯ ЗАГЛУШКА ДЛЯ ТЕСТОВ.

Минимальные данные, чтобы проверять сессии, права доступа и переходы статусов.
Это не реальные и не итоговые синтетические данные: финансовые профили,
признаки и скоринг готовит Михаил, его данные заменят этот файл.
Формат заявок совпадает с Application из docs/openapi.json.
"""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Application, User

USERS = [  # (login, имя, роль)
    ("volkov", "Александр Волков", "client"),
    ("ivanova", "Мария Иванова", "client"),
    ("smirnova", "Елена Смирнова", "employee"),
]

COMPANY = {
    "name": "ООО «Мануфактура»",
    "inn": "5408123456",
    "industry": "Производство и торговля",
    "contact": "Александр Волков",
    "email": "alex@manufactura.example",
    "phone": "+7 913 000-12-34",
}
FINANCES = {"revenue": 12000000, "expenses": 7000000, "debt": 0, "years": 3}
EMPTY_FINANCES = {"revenue": "", "expenses": "", "debt": "0", "years": ""}


def _ts(days_ago: float = 0) -> str:
    t = datetime.now(UTC) - timedelta(days=days_ago)
    return t.isoformat(timespec="seconds").replace("+00:00", "Z")


def _event(title: str, detail: str, actor: str, days_ago: float) -> dict:
    return {"id": str(uuid.uuid4()), "title": title, "detail": detail,
            "actor": actor, "at": _ts(days_ago)}


def _docs() -> list:
    return [
        {"id": str(uuid.uuid4()), "name": "statement.pdf", "size": 48213,
         "kind": "statement", "uploadedAt": _ts(3), "demo": True},
        {"id": str(uuid.uuid4()), "name": "financial-report.pdf", "size": 61544,
         "kind": "report", "uploadedAt": _ts(3), "demo": True},
    ]


def seed(db: Session) -> None:
    if db.scalar(select(func.count(User.id))):
        return  # уже заполнено, повторно не дублируем
    users = {login: User(login=login, name=name, role=role)
             for login, name, role in USERS}
    db.add_all(users.values())
    db.flush()
    owner = users["volkov"].id
    created = _event("Черновик создан", "Вы начали новую заявку.",
                     "Александр Волков", 5)
    
    def make(id_, status, **kw):
        base = {
            "id": id_,
            "owner_user_id": owner,
            "product_id": "working",
            "status": status,
            "amount": 2400000,
            "term": 18,
            "company": COMPANY,
            "finances": FINANCES,
            "consent": True,
            "documents": _docs(),
            "history": [created],
            "created_at": _ts(5),
            "updated_at": _ts(1),
        }
        base.update(kw)
        return Application(**base)
    
    db.add_all([
        make("PT-2026-0042", "needs_info", purpose="Закупка сырья",
             request="Уточните текущую задолженность"),
        make("PT-2026-0038", "approved", purpose="Закупка сырья",
             offer={"amount": 2000000, "term": 24, "rate": 20,
                    "expiresAt": _ts(-14)}),
        make("PT-2026-0045", "rejected", purpose="Закупка сырья",
             rejection_reason="Доходов недостаточно для обслуживания платежа."),
        make("PT-2026-0046", "draft", amount=1000000, term=24, consent=False,
             finances=EMPTY_FINANCES, documents=[]),
    ])
    db.commit()
