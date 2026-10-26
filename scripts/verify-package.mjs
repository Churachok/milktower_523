// Verify a release after extraction: node scripts/verify-package.mjs [directory].
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
const root = resolve(process.argv[2] || ".");
const lines = readFileSync(resolve(root, "MANIFEST.sha256"), "utf8").trim().split("\n");
for (const line of lines) {
  const [, expected, name] = line.match(/^([a-f0-9]{64})  (.+)$/) || [];
  assert.ok(expected && name, "Malformed checksum entry");
  const path = resolve(root, name);
  assert.ok(path.startsWith(root + sep), `Invalid archive path: ${name}`);
  const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
  assert.equal(actual, expected, `Checksum mismatch: ${name}`);
}
const metadata = JSON.parse(readFileSync(resolve(root, "SUBMISSION.json"), "utf8"));
assert.equal(readFileSync(resolve(root, "SOURCE_COMMIT"), "utf8").trim(), metadata.commit);
console.log(`Verified ${lines.length} files from commit ${metadata.commit}`);
