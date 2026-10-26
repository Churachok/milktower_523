import { calculateLoan } from "./application.js";

export const REQUIRED_DOCUMENTS = [
  { kind: "statement", title: "Выписка по счёту за 6 месяцев", help: "Показывает поступления и расходы бизнеса. Один непустой PDF, JPG или PNG до 10 МБ." },
  { kind: "report", title: "Финансовая отчётность", help: "Отчёт о финансовых результатах или управленческий отчёт за 12 месяцев. До 10 МБ." },
];

export function cashScenario(application, revenueFactor = 1) {
  const f = application.finances || {};
  const read = (value) => {
    if (value === null || value === undefined || typeof value === "boolean" || String(value).trim() === "") return NaN;
    return Number(value);
  };
  const revenue = read(f.revenue), expenses = read(f.expenses), debt = read(f.debt);
  const calculation = calculateLoan(application.productId, application.amount, application.term);
  if (!calculation || ![revenue, expenses, debt, revenueFactor].every(Number.isFinite) ||
      revenue <= 0 || expenses < 0 || debt < 0 || revenueFactor <= 0) return null;
  const monthlyProfit = (revenue * revenueFactor - expenses) / 12;
  const existingPayment = debt / 12;
  return {
    monthlyProfit, existingPayment, payment: calculation.monthlyPayment,
    remaining: monthlyProfit - existingPayment - calculation.monthlyPayment,
  };
}
