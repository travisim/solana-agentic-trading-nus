// Runs the demo (recorded mode) into a temp folder and checks the shape of every out/*.json file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "validation-lab-"));
execFileSync("node", ["src/demo.ts", "--recorded", "--out", dir + "/"], { cwd: new URL("../", import.meta.url).pathname, stdio: "pipe" });
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const num = (x: unknown, label: string) => assert.equal(typeof x, "number", label);
const noNaN = (o: unknown, path = "") => {
  if (typeof o === "number") assert.ok(Number.isFinite(o), `${path} is not finite`);
  else if (Array.isArray(o)) o.forEach((v, i) => noNaN(v, `${path}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) noNaN(v, `${path}.${k}`);
};

test("every file is labelled recorded and simulated-not-advice, and has no NaN", () => {
  for (const f of ["splits.json", "leaky.json", "overfit.json", "faults.json", "breaks.json"]) {
    const d = read(f);
    assert.equal(d.mode, "recorded", f);
    assert.equal(d.pair, "SOL/USDC", f);
    assert.match(d.note, /not advice/, f);
    assert.ok(!Number.isNaN(Date.parse(d.capturedAt)), f);
    noNaN(d, f);
  }
});
test("splits.json: grid covers both modes, five horizons, purge on and off, embargo 0..30", () => {
  const s = read("splits.json");
  assert.equal(s.prices.length, s.t.length);
  assert.equal(s.grid.length, 2 * s.hList.length * 2 * (s.embargoMax + 1));
  for (const g of s.grid) {
    assert.ok(g.accuracy === null || (g.accuracy >= 0 && g.accuracy <= 1));
    for (const k of ["h", "embargo", "trainKept", "purged", "embargoed", "leaking", "testCount"]) num(g[k], k);
  }
  const at = (mode: string, h: number, purge: boolean, emb: number) => s.grid.find((g: Record<string, unknown>) => g.mode === mode && g.h === h && g.purge === purge && g.embargo === emb);
  assert.ok(at("shuffled", 24, false, 0).accuracy > at("contiguous", 24, true, 12).accuracy);
});
test("leaky.json: causality shows the leak and the fix", () => {
  const l = read("leaky.json");
  assert.ok(l.causality.leaky.leaking > 0);
  assert.equal(l.causality.fixed.leaking, 0);
  assert.ok(l.results.leakyBeforeCosts.pnlNetUsd > l.results.fixedBeforeCosts.pnlNetUsd);
  assert.equal(l.results.leaky.equity.length, l.results.leaky.trades);
  assert.match(l.bug, /shift/);
});
test("overfit.json: 20 draws of 50, curve of best-of-N, summary", () => {
  const o = read("overfit.json");
  assert.equal(o.seeds.length, 20);
  for (const s of o.seeds) {
    assert.equal(s.trials.length, 50);
    for (const t of s.trials) { assert.ok(Array.isArray(t.is) && Array.isArray(t.oos)); num(t.legs, "legs"); }
  }
  assert.equal(o.curveSeed1.length, 50);
  assert.equal(o.curveSeed1[0].benchmark, 0);
  assert.ok(o.summary.beforeCosts.meanBestInSampleScore > o.summary.beforeCosts.meanBestOutOfSampleScore);
  assert.ok(o.split.cut > 0 && o.split.gap >= 0);
});
test("faults.json: five faults, each with hook-only and extra-guard summaries; the hook is blind to slippage, fees and duplicates", () => {
  const f = read("faults.json");
  assert.deepEqual(f.scenarios.map((s: { kind: string }) => s.kind), ["stale-oracle", "rpc-outage", "slippage-shock", "fee-change", "duplicate-submission"]);
  for (const s of f.scenarios) {
    assert.equal(s.records.length, s.hookOnly.orders);
    assert.equal(s.hookOnly.accepted + s.hookOnly.rejected, s.hookOnly.orders);
    assert.equal(s.withFix.accepted + s.withFix.rejected, s.withFix.orders);
  }
  const by = Object.fromEntries(f.scenarios.map((s: { kind: string }) => [s.kind, s]));
  assert.equal(by["stale-oracle"].hookOnly.byRule["max-oracle-age"] > 0, true);
  for (const k of ["slippage-shock", "fee-change", "duplicate-submission"]) assert.equal(by[k].hookOnly.rejected, 0, k);
  assert.equal(f.series.length, 481);
  assert.equal(f.strategies.base.length, 5);
  assert.deepEqual(f.retry, { windowSec: 300, naive: 300, backoff: 14 });
});
test("breaks.json: no alarm on the healthy feed, alarm after the simulated freeze", () => {
  const b = read("breaks.json");
  assert.equal(b.healthy.alarmTick, null);
  assert.ok(b.frozen.alarmTick >= b.freezeAt);
  assert.equal(b.gapHealthyBps.length, b.gapFrozenBps.length);
});
