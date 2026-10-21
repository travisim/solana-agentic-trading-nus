import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProjects } from "../src/validate.ts";
import { good, template } from "./helpers.ts";

const file = (projects: unknown[], extra: object = {}) => ({ event: "Demo Day", projects, ...extra });

test("the shipped template is valid and has exactly three EXAMPLE entries, one per lane", () => {
  const t = template();
  const v = validateProjects(t);
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(t.projects.length, 3);
  assert.ok(t.projects.every((p) => p.example === true && p.name.startsWith("EXAMPLE") && p.repo.startsWith("https://example.com/")));
  assert.deepEqual(t.projects.map((p) => p.lane).sort(), ["agent", "exchange", "tooling"]);
  assert.ok(t.projects.every((p) => p.team.every((h) => h.startsWith("@example-handle"))));
});

test("a good project passes with no warnings", () => {
  const v = validateProjects(file([good()]));
  assert.equal(v.ok, true);
  assert.deepEqual(v.warnings, []);
  assert.equal(v.counts.tooling, 1);
});

test("bad lane, bad id, duplicate id and bad handles are errors", () => {
  const v = validateProjects(file([good({ lane: "trading" as never }), good({ id: "Bad Id" }), good({ id: "dup" }), good({ id: "dup" }), good({ id: "h", team: ["no spaces allowed"] })]));
  const fields = v.errors.map((e) => e.field);
  assert.ok(fields.includes("lane") && fields.includes("id") && fields.includes("team"));
  assert.ok(v.errors.some((e) => e.message === "duplicate id"));
  assert.equal(v.ok, false);
});

test("repo must be https and, for real entries, github.com", () => {
  assert.equal(validateProjects(file([good({ repo: "http://github.com/a/b" })])).ok, false);
  assert.equal(validateProjects(file([good({ repo: "https://evil.example.org/a/b" })])).ok, false);
  assert.equal(validateProjects(file([good({ repo: "javascript:alert(1)" })])).ok, false);
  assert.equal(validateProjects(file([good({ repo: "https://example.com/EXAMPLE", example: true })])).ok, true);
});

test("signature, program id and test counts are checked", () => {
  assert.equal(validateProjects(file([good({ devnetSignature: "too-short" })])).ok, false);
  assert.equal(validateProjects(file([good({ devnetSignature: "0".repeat(88) })])).ok, false); // 0 is not base58
  assert.equal(validateProjects(file([good({ programId: "abc" })])).ok, false);
  assert.equal(validateProjects(file([good({ tests: { command: "npm test", passing: 5, total: 3 } })])).ok, false);
  assert.equal(validateProjects(file([good({ tests: { command: "", passing: 1, total: 1 } })])).ok, false);
});

test("missing evidence is a warning, not an error", () => {
  const p = good();
  delete (p as Partial<typeof p>).tests;
  delete (p as Partial<typeof p>).devnetSignature;
  const v = validateProjects(file([p]));
  assert.equal(v.ok, true);
  assert.deepEqual(v.warnings.map((w) => w.field).sort(), ["devnetSignature", "tests"]);
});

test("returns and profit claims are flagged, because judging ignores them", () => {
  const v = validateProjects(file([good({ summary: "Shows 40% returns and a big profit on a backtest chart." })]));
  assert.ok(v.warnings.some((w) => w.field === "summary" && /returns or profit/.test(w.message)));
});

test("secret-looking fields are errors", () => {
  const v = validateProjects(file([{ ...good(), seedPhrase: "word word word" }]));
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.field === "seedPhrase"));
});

test("more than seven projects warns about the slots", () => {
  const many = Array.from({ length: 8 }, (_, i) => good({ id: `p-${i}` }));
  const v = validateProjects(file(many));
  assert.ok(v.warnings.some((w) => /7 five-minute slots/.test(w.message)));
});

test("garbage input does not throw", () => {
  for (const x of [null, 5, "x", [], {}, { event: "e" }, { event: "e", projects: [] }, { event: "e", projects: [null, 4] }]) {
    assert.equal(validateProjects(x).ok, false);
  }
});

test("an EXAMPLE entry left in a non-template file is a warning", () => {
  const v = validateProjects(file([good({ example: true })], { template: false }));
  assert.ok(v.warnings.some((w) => w.field === "example"));
});
