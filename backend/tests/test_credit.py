from app.credit import calculate_loan, monthly_payment, terms_error

API = "/api/v1"


def login(client, name):
    client.cookies.clear()
    client.get(f"{API}/demo/login/{name}", follow_redirects=False)


def test_monthly_payment():
    assert round(monthly_payment(1_000_000, 12, 12), 2) == 88848.79


def test_terms_error():
    assert terms_error("working", 1_000_000, 12) is None
    assert terms_error("working", 50_000, 12) is not None  # меньше минимума
    assert terms_error("working", 1_000_000, 60) is not None  # дольше максимума
    assert terms_error("equipment", 400_000, 12) is not None
    assert terms_error("bad", 1, 1) == "Неизвестный кредитный продукт"
    assert calculate_loan("working", 50_000, 12) is None


def test_create_limits(client):
    login(client, "ivanova")
    r = client.post(f"{API}/applications", json={"productId": "working",
                                                 "amount": 50_000, "term": 12})
    assert r.status_code == 400 and "message" in r.json()


def test_server_calculates(client):
    login(client, "ivanova")
    r = client.post(f"{API}/applications", json={
        "productId": "working", "amount": 2_400_000, "term": 18,
        "calculation": {"rate": 1}})  # клиентский снимок игнорируется
    calc = r.json()["calculation"]
    assert calc["rate"] == 19.5
    assert abs(calc["monthlyPayment"] * 18 - calc["totalPayment"]) < 1
    patched = client.patch(f"{API}/applications/{r.json()['id']}",
                           json={"productId": "equipment", "amount": 1_000_000,
                                 "term": 24}).json()
    assert patched["calculation"]["rate"] == 17.5
