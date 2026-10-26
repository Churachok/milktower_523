API = "/api/v1"
PDF = b"%PDF-1.4 test"


def login(client, name):
    client.cookies.clear()
    r = client.get(f"{API}/demo/login/{name}", follow_redirects=False)
    assert r.status_code == 303


def test_session_flow(client):
    r = client.get(f"{API}/session")
    assert r.status_code == 401 and "message" in r.json()
    login(client, "volkov")
    assert client.get(f"{API}/session").json() == {"role": "client"}
    assert client.delete(f"{API}/session").status_code == 204
    assert client.get(f"{API}/session").status_code == 401


def test_unknown_login(client):
    r = client.get(f"{API}/demo/login/nobody", follow_redirects=False)
    assert r.status_code == 404


def test_json_login_rotates_server_session(client):
    assert client.post(f"{API}/session", json={"login": "volkov"}).json() == {"role": "client"}
    old_cookie = client.cookies.get("session")
    response = client.post(f"{API}/session", json={"login": "smirnova"})
    assert response.json() == {"role": "employee"}
    assert "HttpOnly" in response.headers["set-cookie"]
    assert client.get(f"{API}/session").json() == {"role": "employee"}
    assert client.get(f"{API}/session", headers={"Cookie": f"session={old_cookie}"}).status_code == 401


def test_json_login_can_be_disabled(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "demo_login_enabled", False)
    assert client.post(f"{API}/session", json={"login": "volkov"}).status_code == 404
    assert client.get(f"{API}/demo/login/volkov").status_code == 404


def test_json_login_rejects_unknown_or_malformed_login(client):
    assert client.post(f"{API}/session", json={"login": "missing"}).status_code == 404
    assert client.post(f"{API}/session", json={"login": []}).status_code == 400


def test_unauthenticated_list(client):
    assert client.get(f"{API}/applications").status_code == 401


def test_client_sees_only_own(client):
    login(client, "volkov")
    ids = {a["id"] for a in client.get(f"{API}/applications").json()}
    assert ids == {"PT-2026-0042", "PT-2026-0038", "PT-2026-0045", "PT-2026-0046"}
    login(client, "ivanova")
    assert client.get(f"{API}/applications").json() == []


def test_employee_does_not_see_drafts(client):
    login(client, "smirnova")
    ids = {a["id"] for a in client.get(f"{API}/applications").json()}
    assert ids == {"PT-2026-0042", "PT-2026-0038", "PT-2026-0045"}


def test_employee_cannot_create_or_edit(client):
    login(client, "smirnova")
    r = client.post(f"{API}/applications", json={"productId": "working",
                                                 "amount": 1000000, "term": 12})
    assert r.status_code == 403
    r = client.patch(f"{API}/applications/PT-2026-0046", json={"purpose": "x"})
    assert r.status_code == 403


def test_foreign_application_is_404(client):
    login(client, "ivanova")
    assert client.patch(f"{API}/applications/PT-2026-0046",
                        json={"purpose": "x"}).status_code == 404
    assert client.delete(f"{API}/applications/PT-2026-0046").status_code == 404
    r = client.post(f"{API}/applications/PT-2026-0046/documents",
                    files={"file": ("a.pdf", PDF, "application/pdf")},
                    data={"kind": "statement"})
    assert r.status_code == 404


def test_create_patch_delete(client):
    login(client, "ivanova")
    r = client.post(f"{API}/applications", json={"productId": "working",
                                                 "amount": 2400000, "term": 18})
    assert r.status_code == 201
    app = r.json()
    assert app["id"] == "PT-2026-0047" and app["status"] == "draft"
    assert app["history"][0]["title"] == "Черновик создан"
    r = client.patch(f"{API}/applications/{app['id']}",
                     json={"purpose": "Закупка сырья", "consent": True})
    assert r.status_code == 200 and r.json()["purpose"] == "Закупка сырья"
    assert client.patch(f"{API}/applications/{app['id']}",
                        json={"status": "approved"}).status_code == 400
    assert client.delete(f"{API}/applications/{app['id']}").status_code == 204
    assert client.get(f"{API}/applications").json() == []


def test_create_validation(client):
    login(client, "ivanova")
    r = client.post(f"{API}/applications", json={"productId": "bad",
                                                 "amount": 1, "term": 1})
    assert r.status_code == 400 and "message" in r.json()
    assert client.post(f"{API}/applications", json={"productId": []}).status_code == 400


def test_patch_non_draft_conflict(client):
    login(client, "volkov")
    r = client.patch(f"{API}/applications/PT-2026-0042", json={"purpose": "x"})
    assert r.status_code == 409


def test_documents(client):
    login(client, "ivanova")
    app = client.post(f"{API}/applications", json={"productId": "working",
                                                   "amount": 1000000, "term": 12}).json()
    url = f"{API}/applications/{app['id']}/documents"
    r = client.post(url, files={"file": ("s.pdf", PDF, "application/pdf")},
                    data={"kind": "statement"})
    assert r.status_code == 200
    docs = r.json()["documents"]
    assert len(docs) == 1 and docs[0]["name"] == "s.pdf"
    bad = client.post(url, files={"file": ("a.txt", b"hi", "text/plain")},
                      data={"kind": "statement"})
    assert bad.status_code == 415
    empty = client.post(url, files={"file": ("a.pdf", b"", "application/pdf")},
                        data={"kind": "statement"})
    assert empty.status_code == 400
    big = client.post(url, files={"file": ("a.pdf", b"%PDF" + b"0" * (10 * 1024 * 1024),
                                           "application/pdf")},
                      data={"kind": "statement"})
    assert big.status_code == 413
    assert client.delete(f"{url}/{docs[0]['id']}").status_code == 204
