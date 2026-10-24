import pytest

API = "/api/v1"
PDF = b"%PDF-1.4 test"


def login(client, name):
    client.cookies.clear()
    assert client.get(f"{API}/demo/login/{name}", follow_redirects=False).status_code == 303


def act(client, app_id, action, **payload):
    return client.post(f"{API}/applications/{app_id}/actions",
                       json={"action": action, **payload})


def make_ready_draft(client):
    """Черновик ivanova, заполненный по сценарию README."""
    login(client, "ivanova")
    app = client.post(f"{API}/applications", json={"productId": "working",
                                                   "amount": 2400000, "term": 18}).json()
    client.patch(f"{API}/applications/{app['id']}", json={
        "purpose": "Закупка сырья", "consent": True,
        "finances": {"revenue": "12000000", "expenses": "7000000",
                     "debt": "0", "years": "3"}})
    for name, kind in (("statement.pdf", "statement"), ("report.pdf", "report")):
        client.post(f"{API}/applications/{app['id']}/documents",
                    files={"file": (name, PDF, "application/pdf")}, data={"kind": kind})
    return app["id"]


def test_full_scenario(client):
    app_id = make_ready_draft(client)
    r = act(client, app_id, "submitted")
    assert r.status_code == 200 and r.json()["status"] == "submitted"

    login(client, "smirnova")
    r = act(client, app_id, "manual_review")
    assert r.status_code == 200
    assert r.json()["status"] == "manual_review" and r.json()["checks"] is not None

    assert act(client, app_id, "needs_info").status_code == 400  # нужна причина
    r = act(client, app_id, "needs_info", reason="Уточните текущую задолженность")
    assert r.json()["status"] == "needs_info"
    assert r.json()["request"] == "Уточните текущую задолженность"

    login(client, "ivanova")
    assert act(client, app_id, "submitted").status_code == 400  # нужен ответ
    r = act(client, app_id, "submitted", reply="Просроченная задолженность отсутствует")
    assert r.json()["status"] == "submitted"
    assert r.json()["request"] is None and len(r.json()["messages"]) == 1

    login(client, "smirnova")
    assert act(client, app_id, "manual_review").status_code == 200
    r = act(client, app_id, "approved", amount=3000000, term=24, rate=20)
    assert r.status_code == 400  # больше запрошенной суммы
    r = act(client, app_id, "approved", amount=2000000, term=24, rate=20)
    assert r.status_code == 200
    offer = r.json()["offer"]
    assert (offer["amount"], offer["term"], offer["rate"]) == (2000000, 24, 20)
    assert r.json()["amount"] == 2400000  # исходные условия не изменились

    login(client, "ivanova")
    assert act(client, app_id, "issued", accepted=False).status_code == 400
    r = act(client, app_id, "issued", accepted=True)
    assert r.status_code == 200 and r.json()["status"] == "issued"
    assert len(r.json()["history"]) >= 8


def test_repeated_action_conflict(client):
    app_id = make_ready_draft(client)
    assert act(client, app_id, "submitted").status_code == 200
    again = act(client, app_id, "submitted")
    assert again.status_code == 409 and "message" in again.json()
    login(client, "smirnova")
    history_len = len(client.get(f"{API}/applications").json()[0]["history"])
    assert act(client, app_id, "manual_review").status_code == 200
    assert act(client, app_id, "manual_review").status_code == 409
    apps = client.get(f"{API}/applications").json()
    after = next(a for a in apps if a["id"] == app_id)
    assert len(after["history"]) == history_len + 1  # без дублей


def test_submit_validation(client):
    login(client, "ivanova")
    app = client.post(f"{API}/applications", json={"productId": "working",
                                                   "amount": 1000000, "term": 12}).json()
    r = act(client, app["id"], "submitted")
    assert r.status_code == 400 and "message" in r.json()
    assert client.get(f"{API}/applications").json()[0]["status"] == "draft"


@pytest.mark.parametrize("target", [
    "draft", "submitted", "manual_review", "needs_info",
    "approved", "rejected", "issued",
])
def test_terminal_status_is_closed(client, target):
    login(client, "smirnova")
    assert act(client, "PT-2026-0045", target, reason="x", amount=1, term=1,
               rate=1, accepted=True, reply="x").status_code == 409


def test_role_checks(client):
    app_id = make_ready_draft(client)
    act(client, app_id, "submitted")
    # клиент пытается выполнить действие сотрудника
    assert act(client, app_id, "manual_review").status_code == 403
    login(client, "smirnova")
    act(client, app_id, "manual_review")
    login(client, "ivanova")
    assert act(client, app_id, "approved", amount=1000000, term=12,
               rate=20).status_code == 403
    login(client, "smirnova")
    assert act(client, app_id, "issued", accepted=True).status_code == 409


def test_visibility_and_validation(client):
    login(client, "smirnova")
    assert act(client, "PT-2026-0046", "submitted").status_code == 404  # черновик
    assert act(client, "PT-2026-9999", "submitted").status_code == 404
    login(client, "ivanova")
    assert act(client, "PT-2026-0042", "submitted").status_code == 404  # чужая
    assert act(client, "PT-2026-0046", "no_such").status_code == 404  # чужая важнее
    login(client, "volkov")
    assert act(client, "PT-2026-0046", "no_such").status_code == 400


def test_approved_expired_offer(client):
    login(client, "volkov")  # у PT-2026-0038 есть предложение в seed
    assert act(client, "PT-2026-0038", "issued", accepted=True).status_code == 200
