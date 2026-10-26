import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
assert.equal(resolve(git(["rev-parse", "--show-toplevel"]).trim()), root);

function ignored(path) {
  const result = spawnSync("git", ["check-ignore", "--no-index", "-q", "--", path], { cwd: root });
  assert.ok([0, 1].includes(result.status), `git check-ignore failed for ${path}`);
  return result.status === 0;
}

for (const path of [
  "frontend/node_modules/example/index.js", "frontend/dist/index.html", ".local/preview.png",
  ".env", ".env.integration", "frontend/.env.local", "backend/.env.production",
  "backend/.venv/bin/python", "ml/__pycache__/model.pyc", "ml/.pytest_cache/state",
  "ml/.cache/model", "ml/.ipynb_checkpoints/experiment.ipynb", "backend/data/app.db",
  "backend/uploads/document.pdf", "ml/data/train.csv", "ml/checkpoints/model.pt",
  "ml/models/weights.safetensors", "secrets/private.pem", "tmp/preview.pdf",
  "compose.override.yaml", "compose.debug.local.yaml", ".env.server", "frontend/public/api-docs/swagger-ui-bundle.js", "frontend/public/version.json",
]) assert.ok(ignored(path), `${path} must be excluded from Git`);

for (const path of [
  ".env.example", ".env.integration.example", ".env.server.example", "frontend/.env.example",
  "backend/Dockerfile", "backend/src/api.py", "backend/pyproject.toml", "backend/uv.lock",
  "backend/package-lock.json", "ml/Dockerfile", "ml/Dockerfile.gpu", "ml/src/inference.py",
  "ml/requirements.lock", "ml/models/model.py", "ml/models/layers/encoder.py",
  "ml/models/manifest.json", "ml/models/manifest.example.json",
  "ml/tests/fixtures/example.json", "docs/fixtures/statement.pdf", "docs/fixtures/financial-report.pdf",
]) assert.equal(ignored(path), false, `${path} must be eligible for Git`);

const files = [...new Set(git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
  .split("\0").filter(Boolean))];
for (const path of files) {
  assert.equal(ignored(path), false, `${path} is tracked despite the ignore policy`);
}
for (const path of [
  "README.md", "THIRD_PARTY_NOTICES", "compose.yaml", "compose.integration.yaml", "compose.gpu.yaml",
  "frontend/package-lock.json", "frontend/Dockerfile", "backend/README.md", "ml/README.md",
  "backend/Dockerfile", "backend/uv.lock", "backend/app/main.py", "backend/tests/test_scoring.py",
  "compose.demo.yaml", "compose.ai.yaml", "ml/Dockerfile.ai", "ml/requirements.lock", "scripts/integration-smoke.mjs",
  "VERSION", "docs/requirements.md", "docs/case-source.json", "docs/product-research.md",
  "scripts/run.sh", "scripts/package-release.mjs", "scripts/verify-package.mjs",
  "compose.server.yaml", "deploy/Caddyfile", "deploy/README.md",
  "frontend/vite.config.js", "frontend/src/services/scoring.js", "ml/Dockerfile",
  "ml/server.py", "ml/demo.py", "ml/tests/test_scoring.py", "docs/scoring-openapi.json",
  "docs/architecture.md", "docs/openapi.json", "docs/requests.http", "docs/test-scenarios.md",
  "docs/fixtures/statement.pdf", "docs/fixtures/financial-report.pdf",
]) assert.ok(files.includes(path) && existsSync(resolve(root, path)), `${path} is missing from the submission`);

let linkCount = 0;
for (const path of files.filter((name) => name.endsWith(".md"))) {
  const document = readFileSync(resolve(root, path), "utf8");
  for (const [, link] of document.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if (/^[a-z][a-z\d+.-]*:/i.test(link)) continue;
    const [target, fragment] = link.split("#");
    const destination = target ? resolve(root, dirname(path), decodeURIComponent(target)) : resolve(root, path);
    assert.ok(existsSync(destination), `${path}: missing link ${link}`);
    if (fragment && destination.endsWith(".md")) {
      const headings = [...readFileSync(destination, "utf8").matchAll(/^#{1,6}\s+(.+)$/gm)];
      const anchors = headings.map(([, heading]) => heading.toLowerCase()
        .replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/\s/g, "-"));
      assert.ok(anchors.includes(decodeURIComponent(fragment)), `${path}: missing anchor ${link}`);
    }
    linkCount++;
  }
}

function verifyReferences(value, spec) {
  if (Array.isArray(value)) return value.forEach((item) => verifyReferences(item, spec));
  if (!value || typeof value !== "object") return;
  if (value.$ref) {
    assert.ok(value.$ref.startsWith("#/"), `Unsupported API reference ${value.$ref}`);
    let target = spec;
    for (const part of value.$ref.slice(2).split("/")) {
      target = target?.[part.replace(/~1/g, "/").replace(/~0/g, "~")];
    }
    assert.notEqual(target, undefined, `Missing API reference ${value.$ref}`);
  }
  Object.values(value).forEach((item) => verifyReferences(item, spec));
}
for (const path of ["docs/openapi.json", "docs/scoring-openapi.json"]) {
  const spec = JSON.parse(readFileSync(resolve(root, path), "utf8"));
  assert.equal(spec.openapi, "3.1.0");
  verifyReferences(spec, spec);
}
console.log(`Repository check passed: ${files.length} allowed files, ${linkCount} local links, ignore rules and OpenAPI references.`);
