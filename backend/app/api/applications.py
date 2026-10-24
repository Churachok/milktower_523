import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Body, File, Form, Response, UploadFile
from sqlalchemy import select

from app.config import get_settings
from app.credit import PRODUCTS, calculate_loan, terms_error
from app.credit import to_number as _num
from app.deps import CurrentUser, Db
from app.errors import ApiError
from app.models import Application, User, next_application_id, now_iso
from app.seed import COMPANY
from app.serializers import make_event, serialize

router = APIRouter(prefix="/api/v1/applications")

DOC_KINDS = {"statement", "report", "additional", "other"}
SIGNATURES = {
    ".pdf": (b"%PDF",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
}
PATCH_FIELDS = {
    "productId", "amount", "term", "purpose",
    "company", "finances", "consent", "calculation",
}


def _require_client(user: User) -> None:
    if user.role != "client":
        raise ApiError(403, "forbidden", "Действие доступно только клиенту")


def _own(db, user: User, app_id: str) -> Application:
    _require_client(user)
    a = db.get(Application, app_id)
    if a is None or a.owner_user_id != user.id:
        raise ApiError(404, "not_found", "Заявка не найдена")
    return a


def _bad(message: str) -> ApiError:
    return ApiError(400, "validation_error", message)


@router.get("")
def list_applications(db: Db, user: CurrentUser):
    q = select(Application)
    if user.role == "client":
        q = q.where(Application.owner_user_id == user.id)
    else:
        q = q.where(Application.status != "draft")
    q = q.order_by(Application.created_at.desc(), Application.id.desc())
    return [serialize(a) for a in db.scalars(q)]


@router.post("", status_code=201)
def create_application(db: Db, user: CurrentUser, body: Annotated[dict, Body()]):
    _require_client(user)
    product = body.get("productId")
    if product not in PRODUCTS:
        raise _bad("Неизвестный кредитный продукт")
    amount, term = _num(body.get("amount")), _num(body.get("term"))
    error = terms_error(product, amount, term)
    if error:
        raise _bad(error)
    now = now_iso()
    a = Application(
        id=next_application_id(db),
        owner_user_id=user.id,
        product_id=product,
        status="draft",
        amount=amount,
        term=int(term),
        purpose="",
        company={**COMPANY, "contact": user.name},  # заглушка: данные компании
        finances={"revenue": "", "expenses": "", "debt": "0", "years": ""},
        consent=False,
        documents=[],
        history=[make_event("Черновик создан", "Вы начали новую заявку.", user.name)],
        messages=[],
        calculation=calculate_loan(product, amount, term),  # считает сервер
        created_at=now,
        updated_at=now,
    )
    db.add(a)
    db.commit()
    return serialize(a)


@router.patch("/{app_id}")
def update_draft(app_id: str, db: Db, user: CurrentUser, body: Annotated[dict, Body()]):
    a = _own(db, user, app_id)
    if a.status != "draft":
        raise ApiError(409, "conflict", "Редактировать можно только черновик")
    unknown = set(body) - PATCH_FIELDS
    if unknown:
        raise _bad("Недопустимые поля: " + ", ".join(sorted(unknown)))
    if "productId" in body:
        if body["productId"] not in PRODUCTS:
            raise _bad("Неизвестный кредитный продукт")
        a.product_id = body["productId"]
    if "amount" in body:
        amount = _num(body["amount"])
        if amount is None or amount <= 0:
            raise _bad("Укажите сумму кредита")
        a.amount = amount
    if "term" in body:
        term = _num(body["term"])
        if term is None or term < 1 or not float(term).is_integer():
            raise _bad("Укажите срок кредита в месяцах")
        a.term = int(term)
    if "purpose" in body:
        if not isinstance(body["purpose"], str):
            raise _bad("Цель кредита должна быть текстом")
        a.purpose = body["purpose"]
    for key in ("company", "finances"):
        if key in body:
            if not isinstance(body[key], dict):
                raise _bad(f"Поле {key} заполнено неверно")
            setattr(a, key, body[key])
    if "consent" in body:
        if not isinstance(body["consent"], bool):
            raise _bad("Согласие должно быть да или нет")
        a.consent = body["consent"]
    if {"productId", "amount", "term"} & set(body):
        # расчёт всегда считает сервер; при неверных условиях — None
        a.calculation = calculate_loan(a.product_id, a.amount, a.term)
    a.updated_at = now_iso()
    db.commit()
    return serialize(a)


@router.delete("/{app_id}", status_code=204)
def delete_draft(app_id: str, db: Db, user: CurrentUser):
    a = _own(db, user, app_id)
    if a.status != "draft":
        raise ApiError(409, "conflict", "Можно удалить только черновик")
    db.delete(a)
    db.commit()
    return Response(status_code=204)


@router.post("/{app_id}/documents")
async def upload_document(
    app_id: str,
    db: Db,
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
    kind: Annotated[str, Form()],
):
    a = _own(db, user, app_id)
    if a.status not in ("draft", "needs_info"):
        raise ApiError(409, "conflict", "Добавить документ сейчас нельзя")
    if kind not in DOC_KINDS:
        raise _bad("Неизвестный тип документа")
    name = Path(file.filename or "").name[:200]
    ext = Path(name).suffix.lower()
    if ext not in SIGNATURES:
        raise ApiError(415, "unsupported_type", "Поддерживаются PDF, JPG и PNG")
    limit = get_settings().max_upload_bytes
    data = await file.read(limit + 1)
    if len(data) == 0:
        raise _bad("Файл должен быть непустым")
    if len(data) > limit:
        raise ApiError(413, "too_large", "Файл должен быть не больше 10 МБ")
    if not data.startswith(SIGNATURES[ext]):
        raise ApiError(415, "unsupported_type", "Содержимое файла не соответствует типу")
    doc = {
        "id": str(uuid.uuid4()),
        "name": name,
        "size": len(data),
        "kind": kind,
        "uploadedAt": now_iso(),
        "demo": False,
    }
    a.documents = [*a.documents, doc]  # содержимое не храним, только метаданные
    a.updated_at = now_iso()
    db.commit()
    return serialize(a)


@router.delete("/{app_id}/documents/{doc_id}", status_code=204)
def delete_document(app_id: str, doc_id: str, db: Db, user: CurrentUser):
    a = _own(db, user, app_id)
    if a.status not in ("draft", "needs_info"):
        raise ApiError(409, "conflict", "Удалить документ сейчас нельзя")
    if not any(d["id"] == doc_id for d in a.documents):
        raise ApiError(404, "not_found", "Документ не найден")
    a.documents = [d for d in a.documents if d["id"] != doc_id]
    a.updated_at = now_iso()
    db.commit()
    return Response(status_code=204)
