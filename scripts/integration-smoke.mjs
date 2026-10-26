import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
const stateFile = new URL("../.local/smoke-state.json", import.meta.url);
function actor() {
  let cookie = "";
  return async (path, options = {}, expected = 200) => {
    const response = await fetch(new URL(`/api/v1${path}`, base), {
      ...options,
      headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        Cookie: cookie, ...options.headers },
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, expected, `${options.method || "GET"} ${path}: ${await response.clone().text()}`);
    const session = response.headers.get("set-cookie");
    if (session) cookie = session.split(";")[0];
    return response.status === 204 ? null : response.json();
  };
}
const client = actor(), employee = actor(), otherClient = actor();
const json = (method, body) => ({ method, body: JSON.stringify(body) });
await client("/applications", {}, 401);
assert.equal((await client("/session", json("POST", { login: "volkov" }))).role, "client");
assert.equal((await employee("/session", json("POST", { login: "smirnova" }))).role, "employee");
await otherClient("/session", json("POST", { login: "ivanova" }));
if (process.argv.includes("--verify-persisted")) {
  const expected = JSON.parse(await readFile(stateFile, "utf8"));
  const saved = (await client("/applications")).find((application) => application.id === expected.id);
  assert.deepEqual(saved, expected, "Restart must preserve the application, history, offer and ML result");
  console.log(`Persistence check passed after backend restart: ${expected.id}`);
} else {
const app = await client("/applications", json("POST", { productId: "working", amount: 2400000, term: 18 }), 201);
const path = `/applications/${app.id}`;
const act = (user, action, payload = {}) => user(`${path}/actions`, json("POST", { action, ...payload }));
await client(path, json("PATCH", {
  purpose: "Закупка сырья", finances: { revenue: 12000000, expenses: 7000000, debt: 0, years: 3 }, consent: true,
}));
for (const [filename, kind] of [["statement.pdf", "statement"], ["financial-report.pdf", "report"]]) {
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", new Blob([await readFile(new URL(`../docs/fixtures/${filename}`, import.meta.url))], { type: "application/pdf" }), filename);
  await client(`${path}/documents`, { method: "POST", body: form });
}
await otherClient(path, json("PATCH", { purpose: "Чужая заявка" }), 404);
assert.ok(!(await employee("/applications")).some((a) => a.id === app.id), "Employee must not see drafts");
await act(client, "submitted");
const reviewed = await act(employee, "manual_review");
assert.equal(reviewed.checks.source, "rule-based");
assert.equal(reviewed.scoringResult.features.monthly_revenue_avg, 1000000);
assert.equal(reviewed.status, "manual_review");
await act(employee, "needs_info", { reason: "Уточните текущую задолженность" });
const replied = await act(client, "submitted", { reply: "Просроченной задолженности нет" });
assert.equal(replied.checks, null);
assert.equal(replied.scoringResult, null);
await act(employee, "manual_review");
await act(employee, "approved", { amount: 2000000, term: 24, rate: 20 });
const issued = await act(client, "issued", { accepted: true });
assert.equal(issued.status, "issued");
assert.equal(issued.amount, 2400000);
assert.equal(issued.offer.amount, 2000000);
assert.ok(issued.history.length >= 8);
const saved = (await client("/applications")).find((a) => a.id === app.id);
assert.deepEqual(saved, issued);
await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
await writeFile(stateFile, JSON.stringify(saved));
await client("/session", { method: "DELETE" }, 204);
await client("/applications", {}, 401);
console.log(`Integration smoke passed: server sessions, ownership, uploads, real ML, clarification, offer, issue and persisted ${app.id}.`);
}
