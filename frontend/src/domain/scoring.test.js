import test from "node:test";
import assert from "node:assert/strict";
import { scoreApplication } from "../services/scoring.js";
import { seedApplications } from "../data/seed.js";
import { validateStep } from "./application.js";

test("scoring adapter sends annual finances and document kinds, excluding contacts and files", async () => {
  const app = seedApplications()[0];
  const result = {
    checks: { score: 650, rating: "B", recommendation: "Условия", factors: [{ label: "Риск", positive: false }], source: "rule-based", modelVersion: "1.0.1", externalChecks: [] },
    decision: "APPROVED_WITH_CONDITIONS", message: "Рекомендация", approved_amount: 2240000,
    features: { monthly_revenue_avg: 1000000, net_profit_avg: 100000, debt_burden_ratio: 0.2 }, assumptions: ["Синтетика"],
  };
  const actual = await scoreApplication(app, async (url, options) => {
    assert.equal(url, "/ml-api/score");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.company, { inn: app.company.inn });
    assert.deepEqual(body.finances, app.finances);
    assert.deepEqual(body.documents, [{ kind: "statement" }, { kind: "report" }]);
    assert.equal(body.amount, app.amount);
    assert.equal(body.term, app.term);
    return Response.json(result);
  });
  assert.deepEqual(actual, result);
});

test("scoring failures and invalid results are surfaced rather than replaced by a constant", async () => {
  const app = seedApplications()[0];
  await assert.rejects(scoreApplication(app, async () => { throw new Error("offline"); }), /недоступен/);
  await assert.rejects(scoreApplication(app, async () => new Response("Bad Gateway", { status: 502 })), /недоступен/);
  await assert.rejects(scoreApplication(app, async () => Response.json({ message: "Неверные данные" }, { status: 422 })), /Неверные данные/);
  for (const score of [-1, 1001, 1350, null]) {
    await assert.rejects(scoreApplication(app, async () => Response.json({ checks: { score, rating: "A", factors: [] } })), /некорректный/);
  }
});

test("business age must be finite and within the form's stated range", () => {
  for (const years of [Infinity, "Infinity", 0, 101, "abc"]) {
    const app = seedApplications()[0];
    app.finances.years = years;
    assert.ok(validateStep(app, 2)["finances.years"]);
  }
});
