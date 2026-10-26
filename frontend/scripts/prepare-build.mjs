import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
const target = new URL("../public/api-docs/", import.meta.url);
mkdirSync(target, { recursive: true });
for (const name of ["swagger-ui-bundle.js", "swagger-ui.css", "LICENSE"])
  cpSync(new URL(`../node_modules/swagger-ui-dist/${name}`, import.meta.url), new URL(name, target));
const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
writeFileSync(new URL("../public/version.json", import.meta.url), JSON.stringify({version, commit: process.env.VITE_BUILD_COMMIT || "development"}));
