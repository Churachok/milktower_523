import uuid

from app.models import Application, now_iso


def make_event(title: str, detail: str, actor: str) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "title": title,
        "detail": detail,
        "actor": actor,
        "at": now_iso(),
    }


def serialize(a: Application) -> dict:
    amount = int(a.amount) if float(a.amount).is_integer() else a.amount
    out = {
        "id": a.id,
        "productId": a.product_id,
        "status": a.status,
        "amount": amount,
        "term": a.term,
        "purpose": a.purpose,
        "company": a.company,
        "finances": a.finances,
        "consent": a.consent,
        "documents": a.documents,
        "history": a.history,
        "messages": a.messages,
        "calculation": a.calculation,
        "checks": a.checks,
        "scoringResult": a.scoring_result,
        "request": a.request,
        "createdAt": a.created_at,
        "updatedAt": a.updated_at,
    }
    if a.offer:
        out["offer"] = a.offer
    if a.rejection_reason:
        out["rejectionReason"] = a.rejection_reason
    return out
