"""Объяснимый скоринг на правилах. Даёт РЕКОМЕНДАЦИЮ, статус заявки не меняет.

Пороги и веса — рабочие допущения. Позже функцию score_application
можно заменить версией Михаила, сохранив формат результата.
"""

from app.credit import PRODUCTS, monthly_payment, to_number

RULES_VERSION = "rules-v1"
RECOMMENDATIONS = {
    "approve": "Рекомендуется одобрить",
    "review": "Требуется внимательная оценка",
    "reject": "Рекомендуется отказать",
}


def _rating(score: int) -> str:
    for limit, name in ((800, "A"), (700, "B"), (600, "C"), (450, "D")):
        if score >= limit:
            return name
    return "E"


def diverges(code: str | None, decision: str) -> bool:
    """Решение сотрудника прямо противоположно рекомендации скоринга."""
    return (code == "approve" and decision == "rejected") or (
        code == "reject" and decision == "approved"
    )


def score_application(a, items: list[dict]) -> dict:
    f = a.finances or {}
    revenue = to_number(f.get("revenue")) or 0.0
    expenses = to_number(f.get("expenses")) or 0.0
    debt = to_number(f.get("debt")) or 0.0
    years = to_number(f.get("years")) or 0.0
    status = {i["kind"]: i["status"] for i in items}
    rows: list[tuple[str, bool, int]] = []

    margin = (revenue - expenses) / revenue if revenue > 0 else -1.0
    if margin >= 0.3:
        rows.append((f"Высокая маржа бизнеса ({margin:.0%})", True, 120))
    elif margin >= 0.15:
        rows.append((f"Приемлемая маржа бизнеса ({margin:.0%})", True, 60))
    elif margin >= 0.05:
        rows.append((f"Низкая маржа бизнеса ({margin:.0%})", False, -40))
    else:
        rows.append(("Маржа близка к нулю или отрицательная", False, -120))

    ratio = debt / revenue if revenue > 0 else 1.0
    if debt == 0:
        rows.append(("Нет текущих обязательств", True, 60))
    elif ratio <= 0.3:
        rows.append(("Умеренная долговая нагрузка", True, 20))
    elif ratio <= 0.7:
        rows.append(("Повышенная долговая нагрузка", False, -60))
    else:
        rows.append(("Высокая долговая нагрузка", False, -120))

    if years >= 3:
        rows.append(("Бизнес работает 3 года и более", True, 60))
    elif years >= 2:
        rows.append(("Бизнес работает 2 года", True, 20))
    else:
        rows.append(("Короткая история бизнеса (1 год)", False, -40))

    profit_month = (revenue - expenses) / 12
    rate = PRODUCTS.get(a.product_id, {}).get("rate", 20.0)
    payment = monthly_payment(a.amount, a.term, rate)
    if profit_month <= 0:
        rows.append(("Нет прибыли для обслуживания платежа", False, -160))
    else:
        load = payment / profit_month
        text = f"Платёж занимает {load:.0%} месячной прибыли"
        if load <= 0.35:
            rows.append((text, True, 100))
        elif load <= 0.5:
            rows.append((text, True, 40))
        elif load <= 0.8:
            rows.append((text + " — высокая нагрузка", False, -80))
        else:
            rows.append((text + " — слишком высокая нагрузка", False, -160))

    if status.get("egrul") == "ok":
        rows.append(("Компания действует (имитация ЕГРЮЛ)", True, 40))
    else:
        rows.append(("Компания в процессе ликвидации (имитация ЕГРЮЛ)", False, -300))
    bki = status.get("bki")
    if bki == "ok":
        rows.append(("Кредитная история без просрочек (имитация БКИ)", True, 60))
    elif bki == "warning":
        rows.append(("В кредитной истории есть единичные просрочки (имитация БКИ)",
                     False, -40))
    else:
        rows.append(("В кредитной истории серьёзные просрочки (имитация БКИ)",
                     False, -150))
    if status.get("documents") != "ok":
        rows.append(("Не хватает обязательных документов", False, -100))

    score = max(0, min(1000, 500 + sum(r[2] for r in rows)))
    if status.get("egrul") != "ok" or score < 500:
        code = "reject"
    elif score >= 700:
        code = "approve"
    else:
        code = "review"
    return {
        "score": score,
        "rating": _rating(score),
        "recommendation": RECOMMENDATIONS[code],
        "recommendationCode": code,
        "factors": [{"label": l, "positive": p, "impact": i} for l, p, i in rows],
        "rulesVersion": RULES_VERSION,
    }
