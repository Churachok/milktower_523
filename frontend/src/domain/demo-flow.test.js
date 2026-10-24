import test from "node:test";
import assert from "node:assert/strict";
import { api, invalidateDemo } from "../services/api.js";
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.window = new EventTarget();
test("complete demo journey: draft → submit → clarify → reply → counteroffer → issue; persists", async () => {
  api.resetDemo();
  const app = await api.create("working");
  await api.saveDraft(app.id, {
    purpose: "Закупка сырья",
    finances: { revenue: 12000000, expenses: 7000000, debt: 0, years: 3 },
    consent: true,
  });
  await api.upload(
    app.id,
    { name: "statement.pdf", type: "application/pdf", size: 200 },
    "statement",
  );
  await api.upload(
    app.id,
    { name: "report.pdf", type: "application/pdf", size: 200 },
    "report",
  );
  await api.transition(app.id, "submitted", "client");
  await api.transition(app.id, "manual_review", "employee");
  await api.transition(app.id, "needs_info", "employee", {
    reason: "Уточните задолженность",
  });
  await assert.rejects(
    api.transition(app.id, "submitted", "client", { reply: "" }),
    /ответ/,
  );
  await api.transition(app.id, "submitted", "client", {
    reply: "Просроченной задолженности нет",
  });
  assert.equal((await api.list()).find((a) => a.id === app.id).checks, null);
  await api.transition(app.id, "manual_review", "employee");
  await api.transition(app.id, "approved", "employee", {
    amount: 900000,
    term: 18,
    rate: 18.5,
  });
  await assert.rejects(
    api.transition(app.id, "issued", "client", { accepted: false }),
    /Подтвердите/,
  );
  await api.transition(app.id, "issued", "client", { accepted: true });
  invalidateDemo();
  const result = (await api.list()).find((a) => a.id === app.id);
  assert.equal(result.status, "issued");
  assert.equal(result.amount, 1000000);
  assert.equal(result.term, 24);
  assert.equal(result.calculation.amount, 1000000);
  assert.equal(result.calculation.term, 24);
  assert.equal(result.offer.amount, 900000);
  assert.equal(result.messages.length, 1);
  assert.equal(result.history.length, 8);
});
test("rejection requires a reason and the reason is available to the client", async () => {
  api.resetDemo();
  await assert.rejects(
    api.transition("PT-2026-0045", "rejected", "employee", {}),
    /причину/,
  );
  const result = await api.transition("PT-2026-0045", "rejected", "employee", {
    reason: "Слишком высокая текущая нагрузка",
  });
  assert.equal(result.rejectionReason, "Слишком высокая текущая нагрузка");
  assert.equal(result.status, "rejected");
});
test("invalid uploads and changes to a submitted application are blocked", async () => {
  api.resetDemo();
  await assert.rejects(
    api.upload(
      "PT-2026-0046",
      { name: "script.exe", type: "application/pdf", size: 1 },
      "statement",
    ),
    /PDF/,
  );
  await assert.rejects(
    api.upload(
      "PT-2026-0046",
      { name: "empty.pdf", type: "application/pdf", size: 0 },
      "statement",
    ),
    /непустым/,
  );
  await assert.rejects(
    api.saveDraft("PT-2026-0045", { amount: 1 }),
    /черновик/,
  );
  await assert.rejects(
    api.transition("PT-2026-0045", "approved", "employee", {
      amount: 2000000,
      term: 12,
      rate: 15,
    }),
    /Проверьте/,
  );
});
test("saving a full UI draft does not overwrite immutable history, status or documents", async () => {
  api.resetDemo();
  const before = (await api.list()).find((a) => a.id === "PT-2026-0046");
  const saved = await api.saveDraft(before.id, {
    ...before,
    history: [],
    status: "issued",
    documents: [{ id: "injected" }],
    purpose: "Новая цель",
  });
  assert.equal(saved.status, "draft");
  assert.equal(saved.history.length, before.history.length);
  assert.deepEqual(saved.documents, before.documents);
  assert.equal(saved.purpose, "Новая цель");
});
