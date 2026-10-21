// Runs the demo (recorded mode) into a temp folder and checks the shape and the invariants of every out/*.json file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cwd = new URL("../", import.meta.url).pathname;
const run = (dir: string, ...args: string[]) => execFileSync("node", ["src/demo.ts", "--recorded", "--out", dir + "/", ...args], { cwd, stdio: "pipe" }).toString();
const dir = mkdtempSync(join(tmpdir(), "labeler-"));
run(dir);
const read = (f: string, d = dir) => JSON.parse(readFileSync(join(d, f), "utf8"));
const num = (x: unknown, label: string) => assert.ok(typeof x === "number" && Number.isFinite(x), label);

test("labels.json: every label is one of three exits and is consistent with the path", () => {
  const L = read("labels.json");
  assert.equal(L.pair, "SOL/USDC");
  assert.equal(L.mode, "recorded");
  assert.ok(L.points.length >= 400);
  assert.equal(L.vol.length, L.points.length);
  assert.ok(L.labels.length >= 150);
  for (const l of L.labels) {
    for (const k of ["i", "t", "price", "volBps", "widthBps", "up", "dn", "exitI", "retBps"]) num(l[k], k);
    assert.ok([1, -1, 0].includes(l.label));
    assert.ok(l.exitI > l.i && l.exitI <= l.i + L.params.horizon);
    assert.ok(l.widthBps >= L.params.minWidthBps - 1e-9);
    const path = L.points.slice(l.i + 1, l.exitI);
    assert.ok(path.every((p: { price: number }) => p.price < l.up && p.price > l.dn), "no barrier touched before the exit");
    const end = L.points[l.exitI].price;
    if (l.touch === "up") assert.ok(end >= l.up);
    if (l.touch === "down") assert.ok(end <= l.dn);
    if (l.touch === "time") assert.equal(l.exitI, l.i + L.params.horizon);
  }
  const s = L.stats;
  assert.equal(s.up + s.down + s.time, s.decisions);
  assert.equal(s.decisions, L.labels.length);
});

test("agent.json: outcomes follow the labels; the checker catches every injected error and raises no false alarm", () => {
  const A = read("agent.json");
  const L = read("labels.json");
  const byI = new Map(L.labels.map((l: { i: number; label: number }) => [l.i, l.label]));
  for (const d of A.decisions) {
    assert.equal(d.label, byI.get(d.i));
    if (d.side === 0) assert.equal(d.outcome, "none");
    else assert.equal(d.outcome, d.label === 0 ? "timeout" : d.label === d.side ? "win" : "loss");
    assert.equal(d.check.ok, d.injected === "none", `decision ${d.i}: injected=${d.injected} ok=${d.check.ok}`);
    assert.ok(!/NaN|undefined/.test(d.reason));
  }
  const s = A.stats;
  assert.equal(s.trades, s.wins + s.losses + s.timeouts);
  assert.equal(s.caught, s.injected);
  assert.equal(s.missed + s.falseAlarms, 0);
});

test("overlap.json: leakage is real and purging removes it", () => {
  const O = read("overlap.json");
  const L = read("labels.json");
  assert.equal(O.conc.length, L.points.length);
  assert.ok(O.stats.meanConcurrency > 2, "labels overlap a lot");
  assert.ok(O.stats.effectiveN < O.stats.labels / 2, "far fewer independent observations than labels");
  assert.ok(O.uniq.every((u: number) => u > 0 && u <= 1));
  assert.ok(O.leak.leaking > 0);
  const manual = L.labels.filter((l: { i: number; exitI: number }) => l.i < O.leak.cutStep && l.exitI >= O.leak.cutStep).length;
  assert.equal(O.leak.leaking, manual);
  assert.equal(O.leak.curve[O.leak.cutStep], manual);
});

test("meta.json: purged trades never train the gate; counts add up; probabilities are probabilities", () => {
  const M = read("meta.json");
  const sets = (s: string) => M.rows.filter((r: { set: string }) => r.set === s).length;
  assert.equal(sets("train"), M.split.trainTrades);
  assert.equal(sets("purged"), M.split.purgedTrades);
  assert.equal(sets("test"), M.split.testTrades);
  assert.ok(M.split.purgedTrades > 0);
  for (const r of M.rows) { assert.ok(r.p > 0 && r.p < 1); assert.ok([0, 1].includes(r.win)); }
  const t = M.stats;
  assert.equal(t.testNoGate.trades, t.testWithGate.trades + t.blocked.trades);
  assert.equal(t.testNoGate.wins, t.testWithGate.wins + t.blocked.wouldHaveWon);
  assert.equal(M.model.w.length, M.features.length);
});

test("sources.json and lanes.json exist and have the expected shape", () => {
  const S = read("sources.json");
  assert.deepEqual(S.rows.map((r: { source: string }) => r.source), ["pyth", "jupiter", "orca"]);
  const Ln = read("lanes.json");
  assert.deepEqual(Ln.lanes.map((l: { id: string }) => l.id), ["agent", "exchange", "tooling"]);
  for (const l of Ln.lanes) for (const o of l.options) for (const k of ["id", "title", "level", "firstTest", "devnetEvidence", "from"]) assert.ok(o[k], `${l.id}/${o.id}/${k}`);
});

test("the run is repeatable: same inputs give byte-identical files", () => {
  const dir2 = mkdtempSync(join(tmpdir(), "labeler-"));
  run(dir2);
  for (const f of ["labels.json", "agent.json", "overlap.json", "meta.json", "sources.json"]) assert.equal(readFileSync(join(dir, f), "utf8"), readFileSync(join(dir2, f), "utf8"), f);
});

test("other settings and the swaps source also run (and --help-free errors are clear)", () => {
  const d3 = mkdtempSync(join(tmpdir(), "labeler-"));
  const out = run(d3, "--source", "swaps", "--threshold-usd", "10000", "--horizon", "10", "--mult", "1.5");
  assert.match(out, /dollar bars/);
  const L = read("labels.json", d3);
  assert.equal(L.source, "swaps");
  assert.ok(L.labels.length >= 10);
  assert.throws(() => run(mkdtempSync(join(tmpdir(), "labeler-")), "--horizon", "-3"), /horizon/);
});
