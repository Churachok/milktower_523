def build_result_payload(score_result: dict, application: dict) -> dict:
    """
    Преобразует результат скоринга в финальное бизнес-решение 
    и формирует списки причин для UI.
    """
    score_1000 = score_result["score"]
    
    # 1. Определяем бизнес-решение на основе шкалы 0-1000
    decision = "REJECTED"
    message = "К сожалению, по заявке принято отрицательное решение."
    approved_amount = application.get("requested_amount", 0)

    if score_1000 >= 750:
        decision = "APPROVED"
        message = "Заявка одобрена. Вы можете перейти к оформлению документов."
    elif score_1000 >= 550:
        decision = "APPROVED_WITH_CONDITIONS"
        message = "Заявка одобрена с изменёнными условиями: сумма скорректирована."
        approved_amount = int(approved_amount * 0.7) # Урезаем на 30%
    elif score_1000 >= 350:
        decision = "MANUAL_REVIEW"
        message = "Заявка передана на ручное рассмотрение сотруднику банка."
    elif score_1000 >= 200:
        decision = "NEED_MORE_INFO"
        message = "Для принятия решения нужны дополнительные сведения. Приложите документы."

    # 2. Сортируем факторы для UI (топ-3 негативных и топ-2 позитивных)
    neg_factors = sorted(
        [f for f in score_result["factors"] if f["delta"] < 0], 
        key=lambda x: x["delta"]
    )[:3]
    
    pos_factors = sorted(
        [f for f in score_result["factors"] if f["delta"] > 0], 
        key=lambda x: -x["delta"]
    )[:2]

    # 3. Возвращаем полный пакет для API
    return {
        "decision": decision,
        "message": message,
        "approved_amount": approved_amount,
        "positive_factors": [{"label": f["label"], "positive": True} for f in pos_factors],
        "negative_factors": [{"label": f["label"], "positive": False} for f in neg_factors],
        "checks": score_result # Прокидываем оригинальный ответ скоринга (score, rating, factors)
    }