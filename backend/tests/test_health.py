def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_error_format(client):
    r = client.get("/nope")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message"}
