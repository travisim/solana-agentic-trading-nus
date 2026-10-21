import { test } from "node:test";
import assert from "node:assert/strict";
import { randomStrategies } from "../src/factory.ts";
import { bestOfFirst, evaluate, runSeed, splitDetail } from "../src/overfit.ts";
import { realSeries } from "./helpers.ts";

const free = { feeBps: 0, slippageBps: 0 };
const sp = { cut: 288, gap: 12 };
test("random strategies: same seed, same list; 50 of them from four families", () => {
  const a = randomStrategies(50, 1), b = randomStrategies(50, 1), c = randomStrategies(50, 2);
  assert.deepEqual(a.map((x) => x.label), b.map((x) => x.label));
  assert.notDeepEqual(a.map((x) => x.label), c.map((x) => x.label));
  assert.equal(new Set(a.map((x) => x.family)).size, 4);
});
test("time split with a gap: in-sample trades close before the cut, out-of-sample trades open after cut + gap, the rest are purged", () => {
  const r = randomStrategies(50, 3).flatMap((c) => c.run(realSeries(), free).detail ?? []);
  const { is, oos, purged } = splitDetail(r, sp);
  assert.ok(is.every((d) => d.i1 < sp.cut));
  assert.ok(oos.every((d) => d.i0 >= sp.cut + sp.gap));
  assert.equal(is.length + oos.length + purged, r.length);
  assert.ok(purged > 0, "some trade should straddle the cut");
});
test("best of the first N: never gets worse as N grows, and the luck benchmark grows", () => {
  const trials = evaluate(randomStrategies(50, 1), realSeries(), free, sp);
  let prevBest = -Infinity, prevBench = -1;
  for (const n of [2, 5, 10, 25, 50]) {
    const b = bestOfFirst(trials, n);
    assert.ok(b.bestScore! >= prevBest);
    assert.ok(b.benchmark >= prevBench - 0.5, "benchmark roughly grows");
    prevBest = b.bestScore!; prevBench = b.benchmark;
  }
  assert.equal(bestOfFirst(trials, 1).benchmark, 0);
});
test("the in-sample winner of 50 tries scores lower out-of-sample, on average over 20 draws (before costs)", () => {
  const runs = Array.from({ length: 20 }, (_, s) => runSeed(s + 1, 50, realSeries(), free, sp));
  const ok = runs.filter((r) => r.best && r.best.oosScore !== null);
  const isMean = ok.reduce((a, r) => a + (r.best!.isScore as number), 0) / ok.length;
  const oosMean = ok.reduce((a, r) => a + (r.best!.oosScore as number), 0) / ok.length;
  assert.ok(isMean > oosMean + 0.15, `in-sample ${isMean} vs out-of-sample ${oosMean}`);
});
test("with realistic costs no random strategy makes money on this calm window (honest result, not tuned)", () => {
  const trials = evaluate(randomStrategies(50, 1), realSeries(), { feeBps: 5, slippageBps: 2 }, sp);
  assert.ok(trials.every((t) => t.isNetUsd <= 0.5), "an in-sample winner after costs would need a second look");
});
