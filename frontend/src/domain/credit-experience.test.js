import test from "node:test";
import assert from "node:assert/strict";
import { calculateLoan, compareOffer, monthlyPayment } from "./application.js";
import { routeForRole } from "./navigation.js";
import { api, invalidateDemo } from "../services/api.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.window = new EventTarget();

test("calculator rejects empty, fractional-term and out-of-product values", () => {
  for (const [product, amount, term] of [
    ["working", "", 24],
    ["working", 10000001, 24],
    ["working", 1000000, 12.5],
    ["working", 1000000, 37],
    ["equipment", 499999, 12],
    ["equipment", 500000, 5],
    ["equipment", Infinity, 12],
  ])
    assert.equal(calculateLoan(product, amount, term), null);
  const estimate = calculateLoan("equipment", 500000, 60);
  assert.equal(estimate.rate, 17.5);
  assert.equal(estimate.totalPayment, estimate.monthlyPayment * 60);
  assert.ok(estimate.overpayment > 0);
});

test("calculating does not create a draft; continuing transfers exact terms and persists", async () => {
  api.resetDemo();
  const before = await api.list();
  const estimate = calculateLoan("working", "2400000", "18");
  assert.equal((await api.list()).length, before.length);
  const draft = await api.create("working", {
    amount: estimate.amount,
    term: estimate.term,
  });
  assert.equal(draft.amount, 2400000);
  assert.equal(draft.term, 18);
  assert.deepEqual(draft.calculation, estimate);
  invalidateDemo();
  assert.deepEqual(
    (await api.list()).find((app) => app.id === draft.id).calculation,
    estimate,
  );
});

test("invalid calculator terms cannot create a draft", async () => {
  api.resetDemo();
  const before = await api.list();
  await assert.rejects(api.create("working", { amount: 20000000, term: 18 }));
  await assert.rejects(api.create("equipment", { amount: 600000, term: 3 }));
  await assert.rejects(api.create("unknown"));
  assert.deepEqual(await api.list(), before);
});

test("editing terms refreshes the estimate and caller cannot inject a calculation", async () => {
  api.resetDemo();
  const draft = await api.create("working", { amount: 2400000, term: 18 });
  const saved = await api.saveDraft(draft.id, {
    amount: 1800000,
    term: 24,
    calculation: { rate: 1, monthlyPayment: 1 },
  });
  assert.deepEqual(saved.calculation, calculateLoan("working", 1800000, 24));
  const incomplete = await api.saveDraft(draft.id, { amount: "" });
  assert.equal(incomplete.calculation, null);
});

test("offer comparison uses the saved rate, calculates both payments, and retains requested terms", () => {
  const app = {
    productId: "working",
    amount: 2400000,
    term: 18,
    calculation: { amount: 2400000, term: 18, rate: 18 },
    offer: { amount: 2000000, term: 24, rate: 20 },
  };
  const result = compareOffer(app);
  assert.equal(result.hasSnapshot, true);
  assert.equal(result.changed, true);
  assert.equal(result.requested.rate, 18);
  assert.equal(
    result.requested.monthlyPayment,
    monthlyPayment(2400000, 18, 18),
  );
  assert.equal(result.offered.monthlyPayment, monthlyPayment(2000000, 24, 20));
  assert.equal(app.amount, 2400000);
});

test("old or mismatched estimates use an explicitly distinguishable fallback", () => {
  const app = {
    productId: "equipment",
    amount: 5000000,
    term: 36,
    offer: { amount: 5000000, term: 36, rate: 17.5 },
  };
  assert.equal(compareOffer(app).hasSnapshot, false);
  assert.equal(compareOffer(app).changed, false);
  app.calculation = { amount: 4000000, term: 36, rate: 10 };
  assert.equal(compareOffer(app).hasSnapshot, false);
  assert.equal(compareOffer(app).requested.rate, 17.5);
});

test("role switch retains the current non-draft application in both directions", () => {
  for (const status of [
    "submitted",
    "needs_info",
    "manual_review",
    "approved",
    "issued",
    "rejected",
  ]) {
    const apps = [{ id: "A-42", status }];
    for (const role of ["client", "employee"])
      assert.equal(
        routeForRole("/applications/A-42", role, apps),
        "/applications/A-42",
      );
  }
});

test("role switch keeps drafts client-only and handles lists, missing cards and logout", () => {
  const apps = [{ id: "A-1", status: "draft" }];
  assert.equal(
    routeForRole("/applications/A-1/edit", "employee", apps),
    "/queue",
  );
  assert.equal(
    routeForRole("/applications/A-1", "client", apps),
    "/applications/A-1/edit",
  );
  assert.equal(
    routeForRole("/applications/missing", "employee", apps),
    "/queue",
  );
  assert.equal(routeForRole("/overview", "employee", apps), "/queue");
  assert.equal(routeForRole("/queue", "client", apps), "/overview");
  assert.equal(routeForRole("/applications/A-1", "login", apps), "/overview");
});
