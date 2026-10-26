def test_cross_origin_writes_and_login_links_are_rejected(client):
    assert client.post("/api/v1/session", json={"login": "volkov"}, headers={"Origin": "https://unrelated.example"}).status_code == 403
    assert client.get("/api/v1/demo/login/volkov", headers={"Sec-Fetch-Site": "cross-site"}, follow_redirects=False).status_code == 403
    assert client.get("/api/v1/session").status_code == 401


def test_same_origin_login_and_api_cache_headers(client):
    response = client.post("/api/v1/session", json={"login": "volkov"}, headers={"Origin": "http://testserver"})
    assert response.status_code == 200
    response = client.get("/api/v1/applications")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-request-id"]


def test_public_version_identifies_the_exact_build(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "build_commit", "a" * 40)
    response = client.get("/api/v1/version")
    assert response.json()["commit"] == "a" * 40
    assert response.json()["version"] == "1.1.0"
    assert response.headers["cache-control"] == "no-store"
