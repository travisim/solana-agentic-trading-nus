import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_TRAIN, leakAccuracy, purgedKFold } from "../src/splits.ts";
import { realSeries } from "./helpers.ts";

const n = 481;
test("contiguous folds: test sets are consecutive blocks that do not overlap and cover every moment once", () => {
  const folds = purgedKFold(n, { k: 5, h: 12, mode: "contiguous", purge: false, embargo: 0 });
  const all = folds.flatMap((f) => f.test);
  assert.equal(new Set(all).size, all.length);
  assert.equal(all.length, n - 24 - 12);
  for (const f of folds) assert.equal(f.test.at(-1)! - f.test[0]! + 1, f.test.length, "block is consecutive");
});
test("purge: no kept training moment has a label that overlaps a test label", () => {
  for (const mode of ["contiguous", "shuffled"] as const) {
    for (const f of purgedKFold(n, { k: 5, h: 12, mode, purge: true, embargo: 0 })) {
      const test = new Set(f.test);
      for (const j of f.train) for (let d = -12; d <= 12; d++) assert.ok(!test.has(j + d), `train ${j} is within 12 of test ${j + d} (${mode})`);
    }
  }
});
test("without purge the same neighbours are kept (that is the leak), and the counts add up", () => {
  const leaky = purgedKFold(n, { k: 5, h: 12, mode: "contiguous", purge: false, embargo: 0 });
  const clean = purgedKFold(n, { k: 5, h: 12, mode: "contiguous", purge: true, embargo: 0 });
  for (let i = 0; i < leaky.length; i++) {
    assert.equal(leaky[i]!.train.length - clean[i]!.train.length, clean[i]!.purged);
    assert.equal(clean[i]!.purged, leaky[i]!.leaking);
  }
  // middle fold: 12 before and 12 after the block are leaking
  assert.equal(clean[2]!.purged, 24);
});
test("embargo removes extra moments after the test block", () => {
  const a = purgedKFold(n, { k: 5, h: 12, mode: "contiguous", purge: true, embargo: 0 });
  const b = purgedKFold(n, { k: 5, h: 12, mode: "contiguous", purge: true, embargo: 10 });
  assert.equal(b[2]!.embargoed, 10);
  assert.equal(a[2]!.train.length - b[2]!.train.length, 10);
  assert.equal(b[4]!.embargoed, 0, "nothing after the last block");
});
test("shuffled folds have the same number of moments but they are scattered", () => {
  const f = purgedKFold(n, { k: 5, h: 12, mode: "shuffled", purge: false, embargo: 0 });
  assert.equal(f.flatMap((x) => x.test).length, n - 24 - 12);
  assert.ok(f[0]!.test.at(-1)! - f[0]!.test[0]! > 300, "spread over the whole series");
});
test("leakAccuracy on the recorded series: shuffled folds look better than contiguous folds; purged shuffled has nothing to train on", () => {
  const px = realSeries().points.map((p) => p.jupiter);
  const shuf = leakAccuracy(px, { k: 5, h: 24, mode: "shuffled", purge: false, embargo: 0 });
  const cont = leakAccuracy(px, { k: 5, h: 24, mode: "contiguous", purge: true, embargo: 12 });
  assert.ok(shuf.accuracy! > cont.accuracy!, `${shuf.accuracy} vs ${cont.accuracy}`);
  const none = leakAccuracy(px, { k: 5, h: 24, mode: "shuffled", purge: true, embargo: 12 });
  assert.equal(none.accuracy, null);
  assert.ok(none.trainKept < MIN_TRAIN);
});
test("leakAccuracy is deterministic", () => {
  const px = realSeries().points.map((p) => p.jupiter);
  const o = { k: 5, h: 12, mode: "shuffled" as const, purge: false, embargo: 0 };
  assert.deepEqual(leakAccuracy(px, o), leakAccuracy(px, o));
});
