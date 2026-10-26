import test from "node:test";
import assert from "node:assert/strict";
import { personalizedNews } from "./news.js";
import { cashScenario } from "./readiness.js";

const application = (changes = {}) => ({ id: "PT-test", productId: "working", status: "draft", updatedAt: "2026-10-26T00:00:00Z", company: {industry: "Производство и торговля"}, ...changes });

test("news priorities change with the client's application and sector", () => {
  const equipment = personalizedNews([application({productId:"equipment"})]);
  const services = personalizedNews([application({company:{industry:"Услуги"}})]);
  assert.equal(equipment[0].id, "equipment");
  assert.ok(services.some((a) => a.id === "services"));
  assert.ok(!equipment.some((a) => a.id === "services"));
  assert.ok(!services.some((a) => a.id === "equipment"));
});

test("a clarification or offer changes news and links to that specific application", () => {
  const rows = [application(), application({id:"PT-offer",status:"approved"}), application({id:"PT-request",status:"needs_info"})];
  const feed = personalizedNews(rows);
  assert.equal(feed[0].id,"clarification");
  assert.equal(feed[0].route,"/applications/PT-request");
  assert.equal(feed[1].route,"/applications/PT-offer");
  assert.equal(new Set(feed.map((a)=>a.id)).size,feed.length);
  assert.ok(personalizedNews([]).every((a)=>a.reason && a.body.length));
});

test("payment scenario includes existing debt and stresses revenue without mutating the form", () => {
  const app = application({amount:2400000,term:18,finances:{revenue:12000000,expenses:7000000,debt:1200000}});
  const before=structuredClone(app);
  const base=cashScenario(app), stress=cashScenario(app,0.8);
  assert.equal(base.monthlyProfit,5000000/12);
  assert.equal(base.existingPayment,100000);
  assert.ok(Math.abs(base.payment-154855.47)<1);
  assert.equal(base.remaining,base.monthlyProfit-100000-base.payment);
  assert.ok(Math.abs(base.remaining-stress.remaining-200000)<0.01);
  assert.deepEqual(app,before);
});

test("empty or invalid finances never become a reassuring zero-filled budget", () => {
  for (const finances of [{}, {revenue:"",expenses:0,debt:0}, {revenue:1000,expenses:-1,debt:0}, {revenue:Infinity,expenses:0,debt:0}])
    assert.equal(cashScenario(application({amount:1000000,term:12,finances})),null);
});
