import re

from tests.test_states import API, login

REQUIRED = {
    "id", "productId", "status", "amount", "term", "purpose", "company",
    "finances", "documents", "history", "messages", "createdAt", "updatedAt",
}
ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def test_application_shape(client):
    login(client, "volkov")
    apps = client.get(f"{API}/applications").json()
    assert apps
    for a in apps:
        assert REQUIRED <= set(a)
        assert ISO_UTC.match(a["createdAt"]) and ISO_UTC.match(a["updatedAt"])
        for e in a["history"]:
            assert {"id", "title", "detail", "actor", "at"} <= set(e)
            assert ISO_UTC.match(e["at"])


def test_errors_have_message(client):
    for r in (
        client.get(f"{API}/applications"),                      # 401
        client.get(f"{API}/applications/none"),                 # 404/405
    ):
        assert "message" in r.json()
    login(client, "volkov")
    r = client.post(f"{API}/applications", json={"productId": "x"})
    assert r.status_code == 400 and "message" in r.json()
