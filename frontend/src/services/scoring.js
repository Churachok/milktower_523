// Only data needed by the synthetic scorer leaves the browser. No contacts/files.
export async function scoreApplication(app, request = fetch) {
  const response = await request("/ml-api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      company: { inn: app.company.inn },
      productId: app.productId,
      amount: app.amount,
      term: app.term,
      finances: app.finances,
      documents: app.documents.map(({ kind }) => ({ kind })),
    }),
  }).catch(() => {
    throw new Error("Сервис скоринга недоступен. Запустите ML-сервис и повторите проверку.");
  });
  const result = await response.json().catch(() => null);
  if (response.status >= 500)
    throw new Error("Сервис скоринга недоступен. Запустите ML-сервис и повторите проверку.");
  if (!response.ok)
    throw new Error(result?.message || "Не удалось выполнить скоринг. Повторите проверку.");
  const checks = result?.checks;
  const validFeatures = result?.features && ["monthly_revenue_avg", "net_profit_avg", "debt_burden_ratio"]
    .every((key) => Number.isFinite(result.features[key]));
  if (!Number.isInteger(checks?.score) || checks.score < 0 || checks.score > 1000 ||
      !["A", "B", "C", "D", "E"].includes(checks.rating) ||
      typeof checks.recommendation !== "string" || !Array.isArray(checks.factors) ||
      checks.factors.some((factor) => !factor || typeof factor.label !== "string" || typeof factor.positive !== "boolean") ||
      checks.source !== "rule-based" || typeof checks.modelVersion !== "string" ||
      !Array.isArray(checks.externalChecks) || checks.externalChecks.some((item) => !item || typeof item.label !== "string" || typeof item.passed !== "boolean") ||
      !validFeatures || typeof result.message !== "string" ||
      !["APPROVED", "APPROVED_WITH_CONDITIONS", "MANUAL_REVIEW", "NEED_MORE_INFO", "REJECTED"].includes(result.decision) ||
      !(result.approved_amount === null || Number.isFinite(result.approved_amount) && result.approved_amount > 0) ||
      !Array.isArray(result.assumptions) || result.assumptions.some((item) => typeof item !== "string"))
    throw new Error("Сервис скоринга вернул некорректный результат");
  return result;
}
