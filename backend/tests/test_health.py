def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_error_format(client):
    r = client.get("/nope")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message"}


def test_swagger_is_available_on_the_shared_api_path_without_cdn(client):
    response = client.get("/api/v1/docs")
    assert response.status_code == 200
    assert "/api-docs/swagger-ui-bundle.js" in response.text
    assert "cdn.jsdelivr.net" not in response.text
    spec = client.get("/api/v1/openapi.json").json()
    assert "post" in spec["paths"]["/api/v1/session"]
    assert spec["info"]["version"] == "1.1.0"
