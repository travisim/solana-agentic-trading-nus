import { test } from "node:test";
import assert from "node:assert/strict";
import { buildImpactQuotes, execPriceOf, impactBpsFor, maxSizeForImpact } from "../src/impact.ts";
import type { ImpactFile } from "../src/types.ts";
import { recorded, toyQuotes } from "./helpers.ts";

test("impactBpsFor interpolates between real points and scales below the first", () => {
  const f = { quotes: toyQuotes };
  assert.equal(impactBpsFor(f, "buy", 1000), 2);
  assert.equal(impactBpsFor(f, "buy", 5500), 6); // halfway between 1000 (2) and 10000 (10): 2 + 8*(4500/9000)
  assert.equal(impactBpsFor(f, "sell", 50), 0);
  assert.equal(impactBpsFor(f, "buy", 0), 0);
  assert.ok(impactBpsFor(f, "buy", 200_000) > 50); // extrapolates upward
});
test("maxSizeForImpact inverts the curve", () => {
  const f = { quotes: toyQuotes };
  const s = maxSizeForImpact(f, "buy", 10);
  assert.ok(Math.abs(s - 10_000) < 1);
  assert.equal(maxSizeForImpact(f, "buy", 1e9, 500_000), 500_000);
});
test("execPriceOf: sell and buy directions", () => {
  assert.equal(execPriceOf("sell", "1000000000", "100000000", 9), 100); // 1 SOL in, 100 USDC out
  assert.equal(execPriceOf("buy", "100000000", "1000000000", 9), 100);
});
test("buildImpactQuotes converts Jupiter percent to bps", () => {
  const q = buildImpactQuotes([{ side: "buy", sizeUsd: 100, q: { inAmount: "100000000", outAmount: "1000000000", priceImpactPct: "0.25", routePlan: [{ swapInfo: { label: "A" } }, { swapInfo: { label: "A" } }] } }], 9);
  assert.equal(q[0]!.impactBps, 25);
  assert.deepEqual(q[0]!.routes, ["A"]);
});
test("recorded Jupiter file: two pairs, 16 real quotes each, impact grows with size", () => {
  const f = recorded<ImpactFile>("jupiter-impact.json");
  assert.deepEqual(f.pairs.map((p) => p.id), ["SOL/USDC", "ORCA/USDC"]);
  for (const pair of f.pairs) {
    assert.equal(pair.quotes.length, 16);
    for (const side of ["buy", "sell"] as const) {
      const qs = pair.quotes.filter((q) => q.side === side);
      assert.equal(qs.length, 8);
      assert.ok(qs.every((q) => Number.isFinite(q.impactBps) && q.impactBps >= 0 && q.execPrice > 0));
    }
  }
  const orca = f.pairs[1]!;
  assert.ok(impactBpsFor(orca, "buy", 1_000_000) > 10 * impactBpsFor(orca, "buy", 10_000) / 2);
});
