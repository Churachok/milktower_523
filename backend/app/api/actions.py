import re
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Body
from sqlalchemy import update

from app.checks import run_checks
from app.credit import PRODUCTS, terms_error, to_number
from app.deps import CurrentUser, Db
from app.errors import ApiError
from app.models import Application, AuditLog, Check, Decision, now_iso
from app.scoring import diverges
from app.serializers import make_event, serialize
from app.state_machine import STATUSES, required_role

router = APIRouter(prefix="/api/v1/applications")
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _bad(message: str) -> ApiError:
    return ApiError(400, "validation_error", message)


def _text(body: dict, key: str, message: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise _bad(message)
    return value.strip()


def _submit_error(a: Application) -> str | None:
    """Те же правила, что validateStep во frontend, плюс лимиты продукта."""
    c = a.company or {}
    if not str(c.get("name", "")).strip():
        return "Укажите название компании"
    if not re.fullmatch(r"\d{10}|\d{12}", str(c.get("inn", ""))):
        return "ИНН должен содержать 10 или 12 цифр"
    if not str(c.get("contact", "")).strip():
        return "Укажите контактное лицо"
    if not EMAIL.fullmatch(str(c.get("email", ""))):
        return "Укажите корректную почту"
    if len(re.sub(r"\D", "", str(c.get("phone", "")))) != 11:
        return "Укажите телефон из 11 цифр"
    error = terms_error(a.product_id, a.amount, a.term)
    if error:
        return error
    if not (a.purpose or "").strip():
        return "Расскажите, на что нужны средства"
    f = a.finances or {}
    revenue, expenses = to_number(f.get("revenue")), to_number(f.get("expenses"))
    debt, years = to_number(f.get("debt")), to_number(f.get("years"))
    if revenue is None or revenue <= 0:
        return "Выручка должна быть больше 0 ₽"
    if expenses is None or expenses < 0:
        return "Укажите расходы от 0 ₽"
    if debt is None or debt < 0:
        return "Укажите обязательства от 0 ₽"
    if years is None or not 1 <= years <= 100:
        return "Укажите срок работы бизнеса от 1 до 100 лет"
    kinds = {d.get("kind") for d in a.documents}
    if "statement" not in kinds:
        return "Добавьте выписку по расчётному счёту"
    if "report" not in kinds:
        return "Нужны выписка и финансовая отчётность"
    if not a.consent:
        return "Подтвердите согласие перед отправкой"
    return None


@router.post("/{app_id}/actions")
def apply_action(
    app_id: str, db: Db, user: CurrentUser, body: Annotated[dict, Body()]
):
    a = db.get(Application, app_id)
    hidden = a is None
    if a is not None:
        if user.role == "client":
            hidden = a.owner_user_id != user.id
        else:
            hidden = a.status == "draft"
    if hidden:
        raise ApiError(404, "not_found", "Заявка не найдена")

    target = body.get("action")
    if not isinstance(target, str) or target not in STATUSES:
        raise _bad("Неизвестное действие")
    src = a.status
    role = required_role(src, target)
    if role is None:
        raise ApiError(409, "conflict", "Это действие сейчас недоступно для заявки")
    if role != user.role:
        raise ApiError(403, "forbidden", "Действие недоступно для вашей роли")

    # --- проверка данных до любых изменений ---
    reason = reply = None
    offer = None
    if target == "submitted":
        if src == "needs_info":
            reply = _text(body, "reply", "Добавьте ответ на запрос")
        else:
            error = _submit_error(a)
            if error:
                raise _bad(error)
    elif target in ("needs_info", "rejected"):
        reason = _text(
            body, "reason",
            "Укажите, какие сведения нужны" if target == "needs_info"
            else "Укажите понятную клиенту причину отказа",
        )
    elif target == "approved":
        p = PRODUCTS[a.product_id]
        amount, term = to_number(body.get("amount")), to_number(body.get("term"))
        rate = to_number(body.get("rate"))
        if (
            amount is None or amount < p["min"] or amount > min(a.amount, p["max"])
            or term is None or not float(term).is_integer()
            or not p["min_term"] <= term <= p["max_term"]
            or rate is None or rate <= 0 or rate > 100
        ):
            raise _bad("Проверьте сумму, срок и ставку предложения")
        raw_reason = body.get("reason")
        if raw_reason is not None and not isinstance(raw_reason, str):
            raise _bad("Комментарий должен быть текстом")
        reason = (raw_reason or "").strip() or None
        expires = datetime.now(UTC) + timedelta(days=14)
        offer = {
            "amount": int(amount) if amount.is_integer() else amount,
            "term": int(term),
            "rate": int(rate) if rate.is_integer() else rate,
            "expiresAt": expires.isoformat(timespec="seconds").replace("+00:00", "Z"),
        }
    elif target == "issued":
        if body.get("accepted") is not True:
            raise _bad("Подтвердите условия предложения")
        if not a.offer or a.offer.get("expiresAt", "") < now_iso():
            raise ApiError(
                409, "offer_expired", "Срок предложения истёк. Обратитесь к менеджеру."
            )

    assessment = run_checks(a) if target == "manual_review" else None

    # --- атомарная смена статуса: повторный или конкурирующий запрос не пройдёт ---
    result = db.execute(
        update(Application)
        .where(Application.id == a.id, Application.status == src)
        .values(status=target)
    )
    if result.rowcount != 1:
        db.rollback()
        raise ApiError(409, "conflict", "Статус заявки уже изменился. Обновите страницу.")
    db.refresh(a)

    # --- побочные изменения и история ---
    if target == "submitted":
        a.checks = None
        a.scoring_result = None
        title = "Заявка отправлена"
        if src == "needs_info":
            detail = "Дополнительные сведения переданы банку."
            a.messages = [
                *a.messages,
                {"id": str(uuid.uuid4()), "text": reply,
                 "actor": user.name, "at": now_iso()},
            ]
            a.request = None
        else:
            detail = "Начинаем проверку данных и документов."
    elif target == "manual_review":
        title = "Заявка на рассмотрении"
        summary, items, scoring_result = assessment
        detail = f"ML-скоринг {summary['modelVersion']}: {summary['score']}/1000. Решение принимает сотрудник."
        a.checks = summary
        a.scoring_result = scoring_result
        for item in items:
            db.add(Check(application_id=a.id, **item))
    elif target == "needs_info":
        title, detail = "Нужны дополнительные сведения", reason
        a.request = reason
    elif target == "approved":
        title = "Финансирование одобрено"
        detail = reason or "Для клиента подготовлено предложение."
        a.offer = offer
    elif target == "rejected":
        title, detail = "Принято решение по заявке", reason
        a.rejection_reason = reason
    else:  # issued
        title = "Средства получены"
        detail = "Демонстрационная выдача завершена. Реального перевода денег не было."

    a.history = [*a.history, make_event(title, detail, user.name)]
    a.updated_at = now_iso()

    is_decision = target in ("needs_info", "approved", "rejected")
    code = (a.checks or {}).get("recommendationCode")
    audit_details = (
        {"recommendation": code, "diverges": diverges(code, target)}
        if is_decision else {}
    )
    db.add(AuditLog(
        actor_user_id=user.id, action=target, application_id=a.id,
        from_status=src, to_status=target, details=audit_details,
    ))
    if is_decision:
        db.add(Decision(
            application_id=a.id, employee_id=user.id, decision=target,
            details={"reason": reason, "offer": offer},
            scoring_recommendation=code,
        ))
    db.commit()
    return serialize(a)
