import test from "node:test";
import assert from "node:assert/strict";
import {
  assertTransition,
  validateStep,
  monthlyPayment,
  TRANSITIONS,
} from "./application.js";
import { seedApplications } from "../data/seed.js";
const valid = () => ({ ...seedApplications()[0], status: "draft" });
test("a complete client application can be submitted", () =>
  assert.doesNotThrow(() => assertTransition(valid(), "submitted", "client")));
test("employee cannot submit a client draft or accept an offer", () => {
  assert.throws(
    () => assertTransition(valid(), "submitted", "employee"),
    /роли/,
  );
  assert.throws(
    () => assertTransition({ status: "approved" }, "issued", "employee"),
    /роли/,
  );
});
test("client cannot decide on financing or run bank checks", () => {
  assert.throws(
    () => assertTransition({ status: "manual_review" }, "approved", "client"),
    /роли/,
  );
  assert.throws(
    () => assertTransition({ status: "submitted" }, "manual_review", "client"),
    /роли/,
  );
});
test("an unknown role has no permission", () =>
  assert.throws(() => assertTransition(valid(), "submitted", "guest"), /роль/));
test("terminal states cannot be reopened", () => {
  for (const status of ["issued", "rejected"])
    for (const next of Object.keys(TRANSITIONS))
      assert.throws(() => assertTransition({ status }, next, "employee"));
});
test("documents and consent are required to submit", () => {
  assert.throws(
    () =>
      assertTransition({ ...valid(), documents: [] }, "submitted", "client"),
    /выписка/,
  );
  assert.throws(
    () =>
      assertTransition({ ...valid(), consent: false }, "submitted", "client"),
    /согласие/,
  );
});
test("invalid contact information is caught before proceeding", () => {
  const app = valid();
  app.company = { ...app.company, inn: "123", email: "bad", phone: "+7" };
  const errors = validateStep(app, 0);
  assert.ok(errors["company.inn"]);
  assert.ok(errors["company.email"]);
  assert.ok(errors["company.phone"]);
});
test("product limits and integral loan term are enforced", () => {
  const app = { ...valid(), productId: "equipment", amount: 100000, term: 5.5 };
  const errors = validateStep(app, 1);
  assert.ok(errors.amount);
  assert.ok(errors.term);
});
test("financial values must be finite and nonnegative", () => {
  const app = valid();
  app.finances = { revenue: Infinity, expenses: -1, debt: "x", years: 0 };
  assert.equal(Object.keys(validateStep(app, 2)).length, 4);
});
test("an additional-information response must go through checking again", () => {
  assert.doesNotThrow(() =>
    assertTransition({ status: "needs_info" }, "submitted", "client"),
  );
  assert.throws(() =>
    assertTransition({ status: "needs_info" }, "approved", "employee"),
  );
});
test("annuity payment matches an independently computed example", () => {
  assert.ok(Math.abs(monthlyPayment(1000000, 12, 12) - 88848.7887) < 0.01);
  assert.equal(monthlyPayment(120000, 12, 0), 10000);
  assert.equal(monthlyPayment(0, 12, 12), 0);
});
