import { test } from "node:test";
import assert from "node:assert/strict";
import { causalityTest, runTrend, trendSignal } from "../src/leaky.ts";
import { realSeries, seriesOf } from "./helpers.ts";

const px = realSeries().points.map((p) => p.jupiter);
test("causality test flags the planted leak (the signal changes when the future is cut off)", () => {
  const r = causalityTest(px, (p, i) => trendSignal(p, i, { leak: true }));
  assert.ok(r.leaking > 10, `only ${r.leaking} leaking moments`);
  assert.equal(r.ok, false);
  assert.ok(r.firstLeakAt !== null);
});
test("causality test passes the fixed strategy on every moment", () => {
  const r = causalityTest(px, (p, i) => trendSignal(p, i, { leak: false }));
  assert.equal(r.leaking, 0);
  assert.equal(r.ok, true);
  assert.ok(r.checked > 400);
});
test("regression test for the leak: tomorrow's price cannot change today's decision", () => {
  const a = [...px.slice(0, 100)];
  const b = [...px.slice(0, 100), 1e6]; // a crazy future price
  assert.equal(trendSignal(a, 99, { leak: false }), trendSignal(b, 99, { leak: false }));
  assert.notEqual(trendSignal(seriesOf([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 1000]).points.map((p) => p.jupiter), 10, { leak: true }), trendSignal(seriesOf([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]).points.map((p) => p.jupiter), 10, { leak: true }));
});
test("the leaky version looks better than the fixed one on the same prices (that is what a leak does)", () => {
  const free = { feeBps: 0, slippageBps: 0 };
  const leaky = runTrend(realSeries(), free, { leak: true }), fixed = runTrend(realSeries(), free, { leak: false });
  assert.ok(leaky.pnlNetUsd > fixed.pnlNetUsd + 10, `${leaky.pnlNetUsd} vs ${fixed.pnlNetUsd}`);
  assert.ok(leaky.detail && leaky.detail.length === leaky.trades);
});
