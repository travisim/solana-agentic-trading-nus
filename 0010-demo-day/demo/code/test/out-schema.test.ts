// Runs the demo (recorded mode) into a temp folder and checks the shape of every out/*.json file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { root } from "./helpers.ts";

const dir = mkdtempSync(join(tmpdir(), "demo-day-"));
const stdout = execFileSync("node", ["src/demo.ts", "--recorded", "--out", dir + "/"], { cwd: root, encoding: "utf8" });
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

test("demo prints its five steps and the safety sentence", () => {
  for (const n of [1, 2, 3, 4, 5]) assert.match(stdout, new RegExp(`^${n}\\. `, "m"));
  assert.match(stdout, /every write is devnet only; no real funds/);
});

test("validation.json", () => {
  const v = read("validation.json");
  assert.equal(v.ok, true);
  assert.deepEqual(v.counts, { projects: 3, agent: 1, exchange: 1, tooling: 1 });
});

test("gallery.json: recorded mode, EXAMPLE projects, real network read", () => {
  const g = read("gallery.json");
  assert.equal(g.mode, "recorded");
  assert.equal(g.template, true);
  assert.equal(g.projects.length, 3);
  assert.ok(g.projects.every((p: { example: boolean; name: string }) => p.example === true && p.name.startsWith("EXAMPLE")));
  assert.equal(typeof g.network.slot, "number");
  assert.ok(g.network.slot > 400_000_000);
  assert.ok(!Number.isNaN(Date.parse(g.network.capturedAt)));
  assert.ok(g.network.slotsPerSecond > 1 && g.network.slotsPerSecond < 10);
});

test("gallery.html exists and is escaped", () => {
  const html = readFileSync(join(dir, "gallery.html"), "utf8");
  assert.match(html, /<title>Demo Day gallery<\/title>/);
  assert.ok(!/undefined|NaN/.test(html));
});

test("rubric.json and schedule.json", () => {
  const r = read("rubric.json");
  assert.equal(r.total, 100);
  assert.deepEqual(r.criteria.map((c: { weight: number }) => c.weight), [30, 25, 25, 10, 10]);
  const s = read("schedule.json");
  assert.equal(s.slots.length, 7);
  assert.equal(s.window, "18:20-18:55");
  assert.deepEqual(s.slots.slice(0, 3).map((x: { projectId: string }) => x.projectId), ["example-agent", "example-exchange", "example-tooling"]);
});

test("ship.json: the ready example is ready, the gaps example is not, both list every check", () => {
  const s = read("ship.json");
  assert.equal(s.checks.length, 11);
  const [a, b] = s.repos;
  assert.equal(a.name, "ready-example");
  assert.equal(a.ready, true);
  assert.equal(b.name, "gaps-example");
  assert.equal(b.ready, false);
  assert.equal(b.results.find((x: { id: string }) => x.id === "secrets").ok, false);
  assert.equal(a.results.length, 11);
});

test("recorded signature checks are real devnet answers for the sample signatures", () => {
  const c = JSON.parse(readFileSync(`${root}recorded/signature-checks.json`, "utf8")).checks;
  assert.equal(c.length, 2);
  for (const x of c) {
    assert.match(x.signature, /^[1-9A-HJ-NP-Za-km-z]{86,88}$/);
    assert.equal(x.status, "finalized");
    assert.ok(x.slot > 100_000_000);
  }
});

test("the demo stops with a clear message on an invalid projects file", () => {
  const bad = join(dir, "bad.json");
  execFileSync("node", ["-e", `require("fs").writeFileSync(${JSON.stringify(bad)}, JSON.stringify({event:"e",projects:[{id:"x"}]}))`]);
  let code = 0, msg = "";
  try {
    execFileSync("node", ["src/demo.ts", "--recorded", "--projects", bad, "--out", dir + "/bad/"], { cwd: root, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    const err = e as { status: number; stderr: string; stdout: string };
    code = err.status; msg = err.stdout + err.stderr;
  }
  assert.equal(code, 1);
  assert.match(msg, /ERROR/);
  assert.match(msg, /Fix the errors above/);
});
