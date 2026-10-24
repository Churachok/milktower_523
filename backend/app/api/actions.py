import re
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Body
from sqlalchemy import update

from app.api.applications import _num
from app.checks import run_checks
from app.deps import CurrentUser, Db
from app.errors import ApiError
from app.models import Application, AuditLog, Decision, now_iso
from app.serializers import make_event, serialize
from app.state_machine import STATUSES, required_role

router = APIRouter(prefix="/api/v1/applications")


def _bad(message: str) -> ApiError:
    return ApiError(400, "validation_error", message)


def _text(body: dict, key: str, message: str) -> str:
    value = body.get(key)
    if not isinstance(value, str) or not value.strip():
        raise _bad(message)
    return value.strip()


def _submit_error(a: Application) -> str | None:
    company = a.company or {}
    if not str(company.get("name", "")).strip():
        return "Укажите название компании"
    if not re.fullmatch(r"\d{10}|\d{12}", str(company.get("inn", ""))):
        return "ИНН должен содержать 10 или 12 цифр"
    if not (a.purpose or "").strip():
        return "Укажите цель кредита"
    f = a.finances or {}
    revenue, expenses = _num(f.get("revenue")), _num(f.get("expenses"))
    debt, years = _num(f.get("debt")), _num(f.get("years"))
    if revenue is None or revenue <= 0:
        return "Укажите выручку за 12 месяцев"
    if expenses is None or expenses < 0:
        return "Укажите расходы за 12 месяцев"
    if debt is None or debt < 0:
        return "Укажите остаток обязательств"
    if years is None or years < 1 or not float(years).is_integer():
        return "Укажите возраст бизнеса в годах"
    if not a.consent:
        return "Подтвердите согласие на обработку данных"
    kinds = {d["kind"] for d in a.documents}
    if "statement" not in kinds:
        return "Добавьте выписку по счёту"
    if "report" not in kinds:
        return "Добавьте финансовую отчётность"
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
        amount, term = _num(body.get("amount")), _num(body.get("term"))
        rate = _num(body.get("rate"))
        if (
            amount is None or amount <= 0 or amount > a.amount
            or term is None or term < 1 or not float(term).is_integer()
            or rate is None or rate <= 0 or rate > 100
        ):
            raise _bad("Проверьте сумму, срок и ставку предложения")
        reason = (body.get("reason") or "").strip() or None
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
        title = "Заявка отправлена"
        if src == "needs_info":
            detail = "Дополнительные сведения переданы банку."
            a.messages = [
                *a.messages,
                {"id": make_event("", "", "")["id"], "text": reply,
                 "actor": user.name, "at": now_iso()},
            ]
            a.request = None
        else:
            detail = "Начинаем проверку данных и документов."
    elif target == "manual_review":
        title = "Заявка на рассмотрении"
        detail = "Демонстрационные проверки завершены. Решение принимает сотрудник."
        a.checks = run_checks(a)
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

    db.add(AuditLog(
        actor_user_id=user.id, action=target, application_id=a.id,
        from_status=src, to_status=target,
    ))
    if target in ("needs_info", "approved", "rejected"):
        db.add(Decision(
            application_id=a.id, employee_id=user.id, decision=target,
            details={"reason": reason, "offer": offer},
            scoring_recommendation=(a.checks or {}).get("recommendation"),
        ))
    db.commit()
    return serialize(a)
