from sqlalchemy import select
from sqlalchemy.orm import Session

from app.checks import bki_status, egrul_status, run_checks
from app.db import get_engine
from app.models import Application, AuditLog, Decision
from tests.test_states import API, PDF, act, login

GOOD = {"revenue": "12000000", "expenses": "7000000", "debt": "0", "years": "3"}
BAD = {"revenue": "3000000", "expenses": "2800000", "debt": "1500000", "years": "1"}


def to_review(client, amount, term, finances):
    login(client, "ivanova")
    app = client.post(f"{API}/applications", json={
        "productId": "working", "amount": amount, "term": term}).json()
    client.patch(f"{API}/applications/{app['id']}", json={
        "purpose": "Закупка сырья", "consent": True, "finances": finances})
    for name, kind in (("s.pdf", "statement"), ("r.pdf", "report")):
        client.post(f"{API}/applications/{app['id']}/documents",
                    files={"file": (name, PDF, "application/pdf")}, data={"kind": kind})
    assert act(client, app["id"], "submitted").status_code == 200
    login(client, "smirnova")
    r = act(client, app["id"], "manual_review")
    assert r.status_code == 200
    return app["id"], r.json()


def test_simulations_are_deterministic():
    assert egrul_status("5408123456") == "ok"
    assert egrul_status("5408123450") == "failed"
    assert bki_status("5408123456") == "ok"
    assert bki_status("5408123150") == "warning"
    assert bki_status("5408123050") == "failed"


def test_demo_scenario_score(client):
    app_id, data = to_review(client, 2_400_000, 18, GOOD)
    checks = data["checks"]
    assert checks["score"] == 880 and checks["rating"] == "A"
    assert checks["recommendationCode"] == "approve"
    assert checks["rulesVersion"] == "rules-v1"
    assert all({"label", "positive"} <= set(f) for f in checks["factors"])
    assert data["status"] == "manual_review"  # скоринг статус не меняет
    with Session(get_engine()) as db:
        a = db.get(Application, app_id)
        assert run_checks(a) == run_checks(a)  # детерминизм


def test_bad_profile_and_divergence(client):
    app_id, data = to_review(client, 1_500_000, 12, BAD)
    assert data["checks"]["recommendationCode"] == "reject"
    assert data["checks"]["rating"] == "E"
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
