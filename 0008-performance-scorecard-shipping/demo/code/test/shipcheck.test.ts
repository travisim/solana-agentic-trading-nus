import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkProject, readFolder } from "../src/shipcheck.ts";
import { SAMPLE_PROJECTS } from "../src/shipSamples.ts";

const get = (id: string) => SAMPLE_PROJECTS.find((s) => s.id === id)!.project;
const status = (id: string, check: string) => checkProject(get(id)).results.find((r) => r.id === check)!.status;

test("tidy sample passes everything", () => {
  const r = checkProject(get("tidy"));
  assert.equal(r.verdict, "ready to ship", JSON.stringify(r.results.filter((x) => x.status !== "pass")));
  assert.equal(r.fails + r.warns, 0);
});
test("messy sample fails tests and run steps, warns about licence and junk", () => {
  const r = checkProject(get("messy"));
  assert.equal(r.verdict, "not ready");
  assert.equal(status("messy", "tests-exist"), "fail");
  assert.equal(status("messy", "readme-run"), "fail");
  assert.equal(status("messy", "test-script"), "warn"); // the npm default "no test specified" does not count
  assert.equal(status("messy", "license"), "warn");
  assert.equal(status("messy", "hygiene"), "warn");
});
test("leaky sample is caught by file name and by content, and never prints the secret", () => {
  const r = checkProject(get("leaky"));
  assert.equal(r.verdict, "not ready");
  const files = r.results.find((x) => x.id === "secret-files")!;
  assert.deepEqual(files.files, [".env", "wallet/id.json"]);
  const content = r.results.find((x) => x.id === "secret-content")!;
  assert.deepEqual(content.files, [".env", "wallet/id.json"]);
  assert.ok(!JSON.stringify(r).includes("EXAMPLEEXAMPLE"));
  assert.equal(status("leaky", "gitignore"), "warn");
  assert.equal(status("leaky", "hygiene"), "warn"); // node_modules is not ignored
});
test(".env.example is allowed", () => {
  const p = { skippedDirs: [], files: [{ path: ".env.example", size: 10, text: "RPC_URL=\n" }] };
  assert.equal(checkProject(p).results.find((x) => x.id === "secret-files")!.status, "pass");
});
test("readFolder reads a real folder, skips node_modules and .git", () => {
  const d = mkdtempSync(join(tmpdir(), "ship-"));
  mkdirSync(join(d, "node_modules/x"), { recursive: true });
  mkdirSync(join(d, ".git"));
  mkdirSync(join(d, "test"));
  writeFileSync(join(d, "node_modules/x/a.js"), "x");
  writeFileSync(join(d, "README.md"), "# t\n\n```\nnpm install\nnpm test\n```\nKnown limitation: none.\ndevnet only.\n");
  writeFileSync(join(d, "test/a.test.ts"), "//");
  writeFileSync(join(d, ".env"), "RPC=1\n");
  const p = readFolder(d);
  assert.deepEqual(p.files.map((f) => f.path).sort(), [".env", "README.md", "test/a.test.ts"]);
  assert.deepEqual(p.skippedDirs.sort(), [".git", "node_modules"]);
  const r = checkProject(p);
  assert.equal(r.results.find((x) => x.id === "secret-files")!.status, "fail");
  assert.equal(r.results.find((x) => x.id === "readme-run")!.status, "pass");
  assert.equal(r.results.find((x) => x.id === "tests-exist")!.status, "pass");
});
