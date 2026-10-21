import { test } from "node:test";
import assert from "node:assert/strict";
import { runAll } from "../src/vendor/0002/strategies/index.ts";
import { realSeries, recorded } from "./helpers.ts";

test("vendored build-night-1 strategies still give exactly the build-night-1 numbers", () => {
  const ref = recorded<{ feeBps: number; slippageBps: number; strategies: Record<string, unknown>[] }>("0002-strategies.json");
  const mine = runAll(realSeries(), { feeBps: ref.feeBps, slippageBps: ref.slippageBps });
  assert.equal(mine.length, ref.strategies.length);
  for (let i = 0; i < mine.length; i++) {
    const { detail, ...rest } = mine[i]!;
    void detail;
    assert.deepEqual(rest, ref.strategies[i]);
  }
});
test("the per-trade detail added in 0007 adds up to the totals and spans are ordered", () => {
  for (const r of runAll(realSeries(), { feeBps: 5, slippageBps: 2 })) {
    assert.ok(r.detail, r.id);
    assert.equal(r.detail!.length, r.trades);
    const net = r.detail!.reduce((a, d) => a + d.netUsd, 0);
    assert.ok(Math.abs(net - r.pnlNetUsd) < 0.05, `${r.id}: ${net} vs ${r.pnlNetUsd}`);
    for (const d of r.detail!) assert.ok(d.i0 <= d.i1, `${r.id} span ${d.i0}-${d.i1}`);
  }
});
