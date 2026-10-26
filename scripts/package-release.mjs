// Maintainer tool: export only a clean, committed tree with an exact source ID.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
assert.equal(git("status", "--porcelain"), "", "Commit all changes before packaging a submission");
execFileSync(process.execPath, ["scripts/check-repository.mjs"], { cwd: root, stdio: "inherit" });
const commit = git("rev-parse", "HEAD");
const tree = git("rev-parse", "HEAD^{tree}");
const timestamp = git("show", "-s", "--format=%ct", "HEAD");
const version = readFileSync(join(root, "VERSION"), "utf8").trim();
const tag = git("tag", "--points-at", "HEAD").split("\n").find((value) => value.startsWith("submission-")) || null;
const output = resolve(root, process.argv[2] || ".local/submission");
mkdirSync(output, { recursive: true });
const temporary = mkdtempSync(join(tmpdir(), "milk-tower-release-"));
const stage = join(temporary, "source");
mkdirSync(stage);
const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${entry.name}`);
    return entry.isDirectory() ? files(path) : [path];
  });
}
try {
  execFileSync("git", ["archive", "--format=tar", "--output", join(temporary, "source.tar"), commit], { cwd: root });
  execFileSync("tar", ["-xf", join(temporary, "source.tar"), "-C", stage]);
  writeFileSync(join(stage, "SOURCE_COMMIT"), `${commit}\n`);
  const metadata = {
    name: "Milk Tower", version, commit, tree, tag,
    repository: "https://github.com/Churachok/milktower_523",
    committedAt: new Date(Number(timestamp) * 1000).toISOString(),
    start: "./scripts/run.sh", url: "http://localhost:8080",
    accounts: { client: "volkov", employee: "smirnova", otherClient: "ivanova" },
    mode: "synthetic-demo", externalApisRequired: false,
    case: JSON.parse(readFileSync(join(stage, "docs/case-source.json"), "utf8")),
  };
  writeFileSync(join(stage, "SUBMISSION.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(join(stage, "START-HERE.md"), `# Milk Tower ${version}\n\nSource commit: ${commit}\nTag: ${tag || "not set"}\n\n1. Run \`sha256sum -c MANIFEST.sha256\` to verify the unpacked files.\n2. Start Docker, then run \`./scripts/run.sh\` (Git Bash on Windows).\n3. Open http://localhost:8080 and choose a synthetic role on the login page.\n\nNo API keys required. See README.md, docs/submission.md and docs/requirements.md.\n\nThe first build downloads public images and packages. The built application runs offline.\n`);
  const manifest = files(stage).map((file) => relative(stage, file).replaceAll("\\", "/")).sort()
    .map((name) => `${sha256(join(stage, name))}  ${name}`).join("\n");
  writeFileSync(join(stage, "MANIFEST.sha256"), `${manifest}\n`);
  const archive = join(output, `milk-tower-${version}-${commit.slice(0, 12)}.tar.gz`);
  // GNU tar normalizes metadata; the same commit creates the same archive.
  execFileSync("tar", ["--sort=name", `--mtime=@${timestamp}`, "--owner=0", "--group=0", "--numeric-owner", "-czf", archive, "-C", stage, "."]);
  writeFileSync(`${archive}.sha256`, `${sha256(archive)}  ${archive.split("/").at(-1)}\n`);
  writeFileSync(join(output, "SUBMISSION.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify({ archive, checksum: `${archive}.sha256`, commit, tag, files: files(stage).length }, null, 2));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
