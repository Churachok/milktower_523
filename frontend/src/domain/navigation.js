export const PUBLIC_ROUTES = ["/", "/products", "/how-it-works", "/login"];
export const isPublicRoute = (route) => PUBLIC_ROUTES.includes(route);

export function routeAfterLogin(route, role) {
  if (role === "employee") {
    return /^\/applications\/[^/]+$/.test(route) ||
      ["/documents", "/profile", "/support"].includes(route)
      ? route
      : "/queue";
  }
  return /^\/applications\/[^/]+(?:\/edit)?$/.test(route) ||
    [
      "/overview",
      "/applications",
      "/documents",
      "/profile",
      "/support",
    ].includes(route)
    ? route
    : "/overview";
}

// Preserve the reviewed application during a demo role switch; drafts stay client-only.
export function routeForRole(route, nextRole, applications) {
  if (nextRole === "login") return "/";
  const id = route.match(/^\/applications\/([^/]+)/)?.[1];
  const app = applications.find((item) => item.id === id);
  if (app) {
    if (app.status !== "draft") return `/applications/${app.id}`;
    if (nextRole === "client") return `/applications/${app.id}/edit`;
  }
  return nextRole === "employee" ? "/queue" : "/overview";
}
