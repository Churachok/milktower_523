"""Продукты, лимиты и аннуитетный расчёт (как в frontend/src/domain/application.js)."""

PRODUCTS = {
    "working": {"min": 100_000, "max": 10_000_000, "min_term": 3, "max_term": 36,
                "rate": 19.5},
    "equipment": {"min": 500_000, "max": 15_000_000, "min_term": 6, "max_term": 60,
                  "rate": 17.5},
}


def to_number(value) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", "."))
        except ValueError:
            return None
    return None


def monthly_payment(amount: float, months: float, rate: float) -> float:
    if not amount or not months:
        return 0.0
    r = rate / 1200
    return amount * r / (1 - (1 + r) ** -months) if r else amount / months


def _money(value: float) -> str:
    return f"{int(value):,}".replace(",", " ")


def terms_error(product_id: str, amount, term) -> str | None:
    p = PRODUCTS.get(product_id)
    if p is None:
        return "Неизвестный кредитный продукт"
    if amount is None or not p["min"] <= amount <= p["max"]:
        return f"Сумма должна быть от {_money(p['min'])} до {_money(p['max'])} ₽"
    if term is None or not float(term).is_integer() or not (
        p["min_term"] <= term <= p["max_term"]
    ):
        return f"Срок должен быть от {p['min_term']} до {p['max_term']} месяцев"
    return None


def calculate_loan(product_id: str, amount, term) -> dict | None:
    if terms_error(product_id, amount, term):
        return None
    rate = PRODUCTS[product_id]["rate"]
    payment = monthly_payment(amount, term, rate)
    total = payment * term
    return {
        "amount": int(amount) if float(amount).is_integer() else amount,
        "term": int(term),
        "rate": rate,
        "monthlyPayment": round(payment, 2),
        "totalPayment": round(total, 2),
        "overpayment": round(total - amount, 2),
    }
