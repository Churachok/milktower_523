def calculate_score(company: dict, application: dict) -> dict:
    """
    Вычисляет скоринговый балл на основе правил.
    Возвращает результат в формате, который ожидает фронтенд (шкала 0-1000).
    """
    score_100 = 100
    factors = []

    def add(code, delta, label):
        nonlocal score_100
        score_100 += delta
        # Для фронтенда важен флаг positive (увеличивает балл или уменьшает)
        factors.append({
            "code": code, 
            "delta": delta, 
            "label": label, 
            "positive": delta > 0
        })

    # 1. Кредитная история (БКИ)
    if company.get("bki_has_delays"):
        days = company.get("bki_max_delay_days", 0)
        if days > 90:
            add("BKI_LONG_DELAY", -40, f"Просрочка в БКИ {days} дн. (>90)")
        elif days > 30:
            add("BKI_MID_DELAY", -25, f"Просрочка в БКИ {days} дн. (30–90)")
        else:
            add("BKI_SHORT_DELAY", -10, f"Просрочка в БКИ {days} дн. (<30)")
    else:
        add("BKI_CLEAN", 10, "Просрочек в кредитной истории нет")

    if company.get("bki_credit_history_months", 0) < 12:
        add("BKI_SHORT_HISTORY", -10, "Короткая кредитная история (<12 мес.)")

    # 2. Долговая нагрузка
    dbr = company.get("debt_burden_ratio", 0)
    if dbr > 0.7:
        add("DBR_CRITICAL", -35, f"Долговая нагрузка {dbr:.0%} (>70%)")
    elif dbr > 0.5:
        add("DBR_HIGH", -20, f"Долговая нагрузка {dbr:.0%} (50–70%)")
    elif dbr <= 0.3:
        add("DBR_LOW", 10, f"Низкая долговая нагрузка {dbr:.0%}")

    # 3. Динамика выручки
    trend = company.get("revenue_trend_6m", 0)
    if trend < -0.2:
        add("REVENUE_FALL", -25, f"Выручка падает на {abs(trend):.0%} за 6 мес.")
    elif trend < 0:
        add("REVENUE_SLIGHT_FALL", -10, f"Выручка снижается на {abs(trend):.0%} за 6 мес.")
    elif trend > 0.1:
        add("REVENUE_GROWTH", 10, f"Выручка растёт на {trend:.0%} за 6 мес.")

    # 4. Прибыль и налоги
    if company.get("net_profit_avg", 0) <= 0:
        add("NEGATIVE_PROFIT", -20, "Отрицательная средняя чистая прибыль")
    
    if company.get("tax_arrears"):
        add("TAX_ARREARS", -30, "Есть налоговая задолженность")
        
    if company.get("egrul_status") != "ACTIVE":
        add("EGRUL_NOT_ACTIVE", -100, "Компания неактивна в ЕГРЮЛ")

    # 5. Соотношение суммы заявки к выручке
    req_amount = application.get("requested_amount", 0)
    rev_6m = max(company.get("monthly_revenue_avg", 1) * 6, 1)
    ratio = req_amount / rev_6m
    if ratio > 0.8:
        add("AMOUNT_TOO_HIGH", -20, f"Сумма заявки — {ratio:.0%} от полугодовой выручки (>80%)")
    elif ratio <= 0.3:
        add("AMOUNT_COMFORTABLE", 5, "Сумма заявки комфортна относительно выручки")

    # 6. Дозапрос документов (Сценарий C)
    if application.get("documents_provided"):
        add("DOCS_PROVIDED", 10, "Предоставлены дополнительные документы")

    # Ограничиваем балл снизу нулем
    final_score_100 = max(score_100, 0)
    
    # Переводим в шкалу 0-1000 для фронтенда
    score_1000 = final_score_100 * 10
    
    # Определяем рейтинг (A, B, C, D, E)
    if score_1000 >= 750: 
        rating = "A"
        recommendation = "Рассмотреть одобрение"
    elif score_1000 >= 550: 
        rating = "B"
        recommendation = "Рассмотреть одобрение"
    elif score_1000 >= 350: 
        rating = "C"
        recommendation = "Требуется ручная проверка"
    elif score_1000 >= 200: 
        rating = "D"
        recommendation = "Требуется дополнительная информация"
    else: 
        rating = "E"
        recommendation = "Отказ"

    return {
        "score": score_1000,
        "rating": rating,
        "recommendation": recommendation,
        "factors": factors
    }