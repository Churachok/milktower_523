def build_result_payload(score_result: dict, application: dict) -> dict:
    """
    Преобразует результат скоринга в финальное бизнес-решение 
    и формирует списки причин для UI.
    """
    score_1000 = score_result["score"]
    
    # 1. Определяем бизнес-решение на основе шкалы 0-1000
    decision = "REJECTED"
    message = "Рекомендуется отказ. Сотруднику необходимо проверить факторы риска и объяснить причину клиенту."
    approved_amount = None

    if score_1000 >= 750:
        decision = "APPROVED"
        approved_amount = application["requested_amount"]
        message = "Рекомендуется одобрить исходную сумму. Предложение должен подтвердить сотрудник."
    elif score_1000 >= 550:
        decision = "APPROVED_WITH_CONDITIONS"
        message = "Рекомендуется предложение с уменьшением суммы на 30%. Условия должен подтвердить сотрудник."
        approved_amount = int(application["requested_amount"] * 0.7)
    elif score_1000 >= 350:
        decision = "MANUAL_REVIEW"
        message = "Рекомендуется ручной анализ факторов риска сотрудником банка."
    elif score_1000 >= 200:
        decision = "NEED_MORE_INFO"
        message = "Рекомендуется запрос дополнительных сведений. Сотрудник определяет, какие документы нужны."

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
