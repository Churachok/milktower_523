"""Translate the frontend's annual figures and synthetic registry/BKI into features.

This is a demo integration, not a bank backend or verified external information.
"""
import json
import math
from pathlib import Path

from domain.result_builder import build_result_payload
from domain.scoring import calculate_score

MODEL_VERSION = "1.0.1"
COMPANIES = {
    item["inn"]: item
    for item in json.loads((Path(__file__).parent / "fixtures/mock-companies.json").read_text())["companies"]
}
PRODUCTS = {
    "working": (100_000, 10_000_000, 3, 36, 19.5),
    "equipment": (500_000, 15_000_000, 6, 60, 17.5),
}


def number(value, label, minimum=0, maximum=1e15):
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError(f"Некорректное поле: {label}")
    try:
        result = float(value)
    except (ValueError, OverflowError):
        raise ValueError(f"Некорректное поле: {label}") from None
    if not math.isfinite(result) or not minimum <= result <= maximum:
        raise ValueError(f"Некорректное поле: {label}")
    return result


def score_application(payload):
    if not isinstance(payload, dict):
        raise ValueError("Ожидается объект заявки")
    product = payload.get("productId")
    if not isinstance(product, str) or product not in PRODUCTS:
        raise ValueError("Неизвестный кредитный продукт")
    low, high, min_term, max_term, rate = PRODUCTS[product]
    amount = number(payload.get("amount"), "amount", low, high)
    term = number(payload.get("term"), "term", min_term, max_term)
    if not term.is_integer():
        raise ValueError("Срок должен быть целым числом месяцев")
    company = payload.get("company")
    finances = payload.get("finances")
    documents = payload.get("documents")
    if not isinstance(company, dict) or not isinstance(finances, dict):
        raise ValueError("Укажите компанию и финансовые показатели")
    inn = company.get("inn")
    if not isinstance(inn, str) or len(inn) not in (10, 12) or not inn.isascii() or not inn.isdigit():
        raise ValueError("ИНН должен содержать 10 или 12 цифр")
    if not isinstance(documents, list) or any(not isinstance(d, dict) for d in documents):
        raise ValueError("Некорректный список документов")
    revenue = number(finances.get("revenue"), "revenue", 1)
    expenses = number(finances.get("expenses"), "expenses")
    debt = number(finances.get("debt"), "debt")
    years = number(finances.get("years"), "years", 1, 100)
    r = rate / 1200
    payment = amount * r / (1 - (1 + r) ** -term)
    # Outstanding principal is NOT a monthly payment. Use an explicit demo
    # assumption of 12 months to repay existing debts; include the new loan.
    monthly_revenue = revenue / 12
    profile = COMPANIES.get(inn)
    features = {
        "bki_has_delays": False,
        "bki_max_delay_days": 0,
        "bki_credit_history_months": int(years * 12),
        "egrul_status": "ACTIVE",
        "tax_arrears": False,
        "revenue_trend_6m": 0,
    }
    if profile:
        for key in features:
            features[key] = profile[key]
    # User financial figures always take priority over synthetic fixture figures.
    features.update({
        "monthly_revenue_avg": monthly_revenue,
        "net_profit_avg": (revenue - expenses) / 12,
        "debt_burden_ratio": (debt / 12 + payment) / monthly_revenue,
    })
    application = {
        "requested_amount": amount,
        "documents_provided": any(d.get("kind") == "additional" for d in documents),
    }
    result = build_result_payload(calculate_score(features, application), application)
    document_kinds = {d.get("kind") for d in documents if isinstance(d.get("kind"), str)}
    if result["decision"] != "REJECTED" and not {"statement", "report"} <= document_kinds:
        result.update(decision="NEED_MORE_INFO", approved_amount=None,
                      message="Для рассмотрения необходимы выписка и финансовая отчётность. Сотрудник должен запросить недостающие документы.")
    elif result["approved_amount"] is not None and result["approved_amount"] < low:
        result.update(decision="MANUAL_REVIEW", approved_amount=None,
                      message="Расчётная сумма ниже минимума продукта. Необходим ручной подбор условий сотрудником.")
    result["checks"].update({
        "source": "rule-based",
        "modelVersion": MODEL_VERSION,
        "externalChecks": [
            {"label": "Регистрация компании · ЕГРЮЛ", "passed": features["egrul_status"] == "ACTIVE"},
            {"label": "Кредитная история · БКИ", "passed": not features["bki_has_delays"]},
            {"label": "Комплектность документов", "passed": {"statement", "report"} <= document_kinds},
        ],
    })
    result["features"] = features
    result["assumptions"] = [
        "Только синтетические данные; обращения к ЕГРЮЛ, БКИ и ФНС нет.",
        "Текущий долг условно погашается за 12 месяцев; учтён платёж по новому кредиту.",
        "Документы проверяются по метаданным, содержимое не распознаётся.",
        "Профиль внешних проверок выбран по тестовому ИНН." if profile else
        "ИНН вне fixtures: условно активная компания без просрочек и налогового долга, динамика выручки 0%.",
    ]
    # These are suggestions, never changes to the persisted application status.
    return result
