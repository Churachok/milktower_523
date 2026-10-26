"""Имитации внешних проверок. Детерминированы: результат зависит только от данных."""

from app.scoring import score_application


def egrul_status(inn: str) -> str:
    """Имитация ЕГРЮЛ: ИНН, оканчивающийся на 0, — компания в ликвидации."""
    return "failed" if str(inn).endswith("0") else "ok"


def bki_status(inn: str) -> str:
    """Имитация БКИ: по последним трём цифрам ИНН."""
    digits = "".join(c for c in str(inn) if c.isdigit())[-3:] or "0"
    n = int(digits)
    return "ok" if n >= 200 else "warning" if n >= 100 else "failed"


def run_checks(a) -> tuple[dict, list[dict]]:
    inn = (a.company or {}).get("inn", "")
    egrul, bki = egrul_status(inn), bki_status(inn)
    kinds = {d.get("kind") for d in a.documents or []}
    docs_ok = {"statement", "report"} <= kinds
    items = [
        {"kind": "egrul", "status": egrul,
         "details": {"summary": "Компания действует" if egrul == "ok"
                     else "Компания в процессе ликвидации", "simulated": True}},
        {"kind": "bki", "status": bki,
         "details": {"summary": {"ok": "Просрочек нет",
                                 "warning": "Есть единичные просрочки",
                                 "failed": "Есть серьёзные просрочки"}[bki],
                     "simulated": True}},
        {"kind": "documents", "status": "ok" if docs_ok else "failed",
         "details": {"summary": "Выписка и отчётность приложены" if docs_ok
                     else "Не хватает обязательных документов"}},
    ]
    return score_application(a, items), items
