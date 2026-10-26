from sqlalchemy import select
from sqlalchemy.orm import Session

from app.checks import run_checks
from app.db import get_engine
from app.models import Application, AuditLog, Decision
from tests.test_states import API, PDF, act, login

GOOD = {"revenue": "12000000", "expenses": "7000000", "debt": "0", "years": "3"}
BAD = {"revenue": "3000000", "expenses": "2800000", "debt": "1500000", "years": "1"}


def to_review(client, amount, term, finances, inn="5408123456"):
    login(client, "ivanova")
    app = client.post(f"{API}/applications", json={
        "productId": "working", "amount": amount, "term": term}).json()
    app["company"]["inn"] = inn
    client.patch(f"{API}/applications/{app['id']}", json={
        "company": app["company"],
        "purpose": "Закупка сырья", "consent": True, "finances": finances})
    for name, kind in (("s.pdf", "statement"), ("r.pdf", "report")):
        client.post(f"{API}/applications/{app['id']}/documents",
                    files={"file": (name, PDF, "application/pdf")}, data={"kind": kind})
    assert act(client, app["id"], "submitted").status_code == 200
    login(client, "smirnova")
    r = act(client, app["id"], "manual_review")
    assert r.status_code == 200
    return app["id"], r.json()


def test_demo_scenario_score(client):
    app_id, data = to_review(client, 2_400_000, 18, GOOD)
    checks = data["checks"]
    assert checks["score"] == 1000 and checks["rating"] == "A"
    assert checks["recommendationCode"] == "approve"
    assert checks["modelVersion"] == "1.0.1"
    assert checks["source"] == "rule-based"
    assert data["scoringResult"]["features"]["monthly_revenue_avg"] == 1000000
    assert all({"label", "positive"} <= set(f) for f in checks["factors"])
    assert data["status"] == "manual_review"  # скоринг статус не меняет
    with Session(get_engine()) as db:
        a = db.get(Application, app_id)
        assert run_checks(a) == run_checks(a)  # детерминизм


def test_bad_profile_and_divergence(client):
    app_id, data = to_review(client, 1_500_000, 12, BAD, "7705678901")
    assert data["checks"]["recommendationCode"] == "reject"
    assert data["checks"]["score"] < 200
    assert any(not f["positive"] for f in data["checks"]["factors"])
    # сотрудник вправе решить иначе, это фиксируется отдельно
    r = act(client, app_id, "approved", amount=1_000_000, term=12, rate=20)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    with Session(get_engine()) as db:
        log = db.scalars(select(AuditLog).where(
            AuditLog.application_id == app_id, AuditLog.action == "approved")).one()
        assert log.details["diverges"] is True
        decision = db.scalars(select(Decision).where(
            Decision.application_id == app_id)).one()
        assert decision.scoring_recommendation == "reject"


def test_ml_outage_keeps_application_and_history(client, monkeypatch):
    from app.config import get_settings
    from tests.test_states import make_ready_draft

    app_id = make_ready_draft(client)
    submitted = act(client, app_id, "submitted").json()
    login(client, "smirnova")
    settings = get_settings()
    monkeypatch.setattr(settings, "ml_base_url", "http://127.0.0.1:1")
    response = act(client, app_id, "manual_review")
    assert response.status_code == 503
    current = next(a for a in client.get(f"{API}/applications").json() if a["id"] == app_id)
    assert current["status"] == "submitted"
    assert current["history"] == submitted["history"]
    assert current["checks"] is None and current["scoringResult"] is None


def test_clarification_clears_assessment_and_recomputes(client):
    app_id, original = to_review(client, 2_400_000, 18, GOOD)
    assert original["scoringResult"]
    act(client, app_id, "needs_info", reason="Уточните задолженность")
    login(client, "ivanova")
    resubmitted = act(client, app_id, "submitted", reply="Задолженности нет").json()
    assert resubmitted["checks"] is None and resubmitted["scoringResult"] is None
    login(client, "smirnova")
    reviewed = act(client, app_id, "manual_review").json()
    assert reviewed["scoringResult"]["checks"]["score"] == original["checks"]["score"]


def test_invalid_ml_response_keeps_application_submitted(client, monkeypatch):
    from io import BytesIO

    from tests.test_states import make_ready_draft

    app_id = make_ready_draft(client)
    act(client, app_id, "submitted")
    login(client, "smirnova")
    monkeypatch.setattr("app.scoring.urlopen", lambda *args, **kwargs: BytesIO(b"{}"))
    assert act(client, app_id, "manual_review").status_code == 503
    current = next(a for a in client.get(f"{API}/applications").json() if a["id"] == app_id)
    assert current["status"] == "submitted" and current["checks"] is None
