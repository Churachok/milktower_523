// Preserve the reviewed application during a demo role switch; drafts stay client-only.
export function routeForRole(route, nextRole, applications) {
  if (nextRole === "login") return "/overview";
  const id = route.match(/^\/applications\/([^/]+)/)?.[1];
  const app = applications.find((item) => item.id === id);
  if (app) {
    if (app.status !== "draft") return `/applications/${app.id}`;
    if (nextRole === "client") return `/applications/${app.id}/edit`;
  }
  return nextRole === "employee" ? "/queue" : "/overview";
}
