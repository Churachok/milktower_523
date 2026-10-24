import test from "node:test";
import assert from "node:assert/strict";
import { isPublicRoute, routeAfterLogin } from "./navigation.js";

test("public navigation excludes company, document and application pages", () => {
  for (const route of ["/", "/products", "/how-it-works", "/login"])
    assert.equal(isPublicRoute(route), true);
  for (const route of [
    "/overview",
    "/applications",
    "/applications/A-42",
    "/applications/A-42/edit",
    "/documents",
    "/profile",
    "/queue",
    "/support",
  ])
    assert.equal(isPublicRoute(route), false);
});

test("sign-in preserves a client deep link and sends public entry points to the cabinet", () => {
  assert.equal(
    routeAfterLogin("/applications/A-42/edit", "client"),
    "/applications/A-42/edit",
  );
  assert.equal(routeAfterLogin("/documents", "client"), "/documents");
  for (const route of ["/", "/login", "/products", "/queue", "/unknown"])
    assert.equal(routeAfterLogin(route, "client"), "/overview");
});

test("employee entry cannot open a client edit page", () => {
  assert.equal(
    routeAfterLogin("/applications/A-42/edit", "employee"),
    "/queue",
  );
  assert.equal(
    routeAfterLogin("/applications/A-42", "employee"),
    "/applications/A-42",
  );
  assert.equal(routeAfterLogin("/login", "employee"), "/queue");
});
