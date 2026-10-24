import assert from "node:assert/strict";

// Run against an already started Docker stack; uses only Node.js built-ins.
const base = process.argv[2] || "http://127.0.0.1:8080";

async function request(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, expectedStatus, `${path}: HTTP status`);
  return response;
}

const index = await request("/index.html");
assert.match(index.headers.get("content-type") || "", /text\/html/);
assert.match(index.headers.get("cache-control") || "", /no-cache/);
const html = await index.text();
assert.match(html, /Milk Tower/);
assert.match(html, /id="root"/);

const javascript = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
const stylesheet = html.match(/href="(\/assets\/[^\"]+\.css)"/)?.[1];
assert.ok(javascript, "HTML must reference built JavaScript");
assert.ok(stylesheet, "HTML must reference built CSS");
for (const path of [javascript, stylesheet]) {
  const asset = await request(path);
  assert.match(asset.headers.get("cache-control") || "", /immutable/);
  assert.ok((await asset.arrayBuffer()).byteLength > 0, `${path}: nonempty asset`);
}

const home = await request("/");
assert.equal(await home.text(), html, "Root route must serve the application");
const fallback = await request("/applications/demo");
assert.equal(await fallback.text(), html, "SPA fallback must serve the application");
for (const path of ["/brand/milk-tower.svg", "/favicon.svg", "/fonts/golos-regular.ttf"]) {
  const asset = await request(path);
  assert.ok((await asset.arrayBuffer()).byteLength > 0, `${path}: local asset`);
}
await request("/assets/missing-smoke-check.js", 404);
const api = await request("/api/v1/applications", 503);
assert.match(api.headers.get("content-type") || "", /application\/json/);
assert.equal(typeof (await api.json()).message, "string");

const health = await request("/ml-api/healthz");
assert.equal((await health.json()).status, "ok");
const score = await fetch(new URL("/ml-api/score", base), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  signal: AbortSignal.timeout(5000),
  body: JSON.stringify({
    company: { inn: "5408123456" }, productId: "working", amount: 2400000, term: 18,
    finances: { revenue: 12000000, expenses: 7000000, debt: 0, years: 3 },
    documents: [{ kind: "statement" }, { kind: "report" }],
  }),
});
assert.equal(score.status, 200);
const scored = await score.json();
assert.equal(scored.checks.source, "rule-based");
assert.ok(Number.isInteger(scored.checks.score) && scored.checks.score >= 0 && scored.checks.score <= 1000);
assert.equal(scored.features.monthly_revenue_avg, 1000000);
console.log("HTTP smoke check passed: SPA, assets, API boundary and real Python scoring through Nginx.");
