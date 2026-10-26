import React, { useState } from "react";
import { money } from "../domain/application";
import { cashScenario } from "../domain/readiness";
import { Notice } from "./ui";

export default function FinancialPreview({ application }) {
  const [stress, setStress] = useState(false);
  const scenario = cashScenario(application, stress ? 0.8 : 1);
  if (!scenario) return null;
  return (
    <section className="financial-preview" aria-label="Проверка бюджета">
      <div className="section-heading"><h3>Как платёж вписывается в бюджет</h3></div>
      <label className="checkbox-label">
        <input type="checkbox" checked={stress} onChange={(e) => setStress(e.target.checked)} />
        <span>Посмотреть сценарий: выручка на 20% ниже</span>
      </label>
      <dl className="budget-grid" aria-live="polite">
        <div><dt>Прибыль в месяц до платежей</dt><dd>{money(scenario.monthlyProfit)}</dd></div>
        <div><dt>Платёж по новой заявке</dt><dd>{money(scenario.payment)}</dd></div>
        <div><dt>Остаток после платежей</dt><dd className={scenario.remaining < 0 ? "amber-text" : ""}>{money(scenario.remaining)}</dd></div>
      </dl>
      {scenario.remaining < 0 && <Notice tone="amber">В этом сценарии расчётного потока не хватает на платежи. Пересмотрите сумму или срок и поясните фактический график поступлений специалисту.</Notice>}
      <p className="legal-note">Учебный расчёт: годовые доходы и расходы распределены равномерно. Текущий долг условно погашается за 12 месяцев ({money(scenario.existingPayment)} в месяц). Это не прогноз денежного потока и не решение банка.</p>
    </section>
  );
}
