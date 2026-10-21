import { test } from "node:test";
import assert from "node:assert/strict";
import { capOrderByImpact, combineBets, discretize, normCdf, probToSize, targetUsdOf, DEFAULT_SIZING } from "../src/sizing.ts";
import { toyQuotes } from "./helpers.ts";

test("normCdf matches known values", () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normCdf(1) - 0.8413447) < 1e-6);
  assert.ok(Math.abs(normCdf(-1.96) - 0.0249979) < 1e-6);
});
test("probToSize: 0.5 and below give 0, grows smoothly with confidence, stays below 1", () => {
  assert.equal(probToSize(0.5), 0);
  assert.equal(probToSize(0.4), 0);
  assert.equal(probToSize(NaN), 0);
  let prev = 0;
  for (let p = 0.51; p < 1; p += 0.01) {
    const m = probToSize(p);
    assert.ok(m > prev, `size must rise with p (p=${p.toFixed(2)})`);
    assert.ok(m < 1);
    prev = m;
  }
  assert.ok(Math.abs(probToSize(0.7) - 0.3382) < 0.001); // z = 0.4364, 2*Phi(z)-1
  assert.ok(Math.abs(probToSize(0.9) - 0.8176) < 0.001);
});
test("discretize rounds to the step and never passes the cap", () => {
  assert.equal(discretize(0.34, 0.1), 0.3);
  assert.equal(discretize(0.36, 0.1), 0.4);
  assert.equal(discretize(-0.36, 0.1), -0.4);
  assert.equal(discretize(1.2, 0.1), 1);
  assert.equal(discretize(-3, 0.25), -1);
  assert.equal(discretize(0.01, 0.1), 0);
  assert.throws(() => discretize(0.3, 0));
});
test("combineBets: average shares one position, sum stacks and is clipped", () => {
  assert.equal(combineBets([], "average"), 0);
  assert.ok(Math.abs(combineBets([0.5, 0.5, 0.5], "average") - 0.5) < 1e-12);
  assert.equal(combineBets([0.5, 0.5, 0.5], "sum"), 1);
  assert.ok(Math.abs(combineBets([0.6, -0.2], "average") - 0.2) < 1e-12);
  assert.ok(Math.abs(combineBets([0.6, -0.2], "sum") - 0.4) < 1e-12);
  assert.equal(combineBets([-0.9, -0.9], "sum"), -1);
});
test("targetUsdOf scales with equity and the cap, and ignores negative equity", () => {
  assert.equal(targetUsdOf(0.5, 10_000, { maxFraction: 0.2 }), 1000);
  assert.equal(targetUsdOf(-1, 10_000, { maxFraction: 0.2 }), -2000);
  assert.equal(targetUsdOf(1, -5, { maxFraction: 0.2 }), 0);
  assert.equal(DEFAULT_SIZING.maxFraction, 0.25);
});
test("capOrderByImpact cuts an order to the largest size under the impact limit", () => {
  const small = capOrderByImpact(500, "buy", toyQuotes, 5);
  assert.equal(small.capped, false);
  assert.equal(small.sizeUsd, 500);
  const big = capOrderByImpact(50_000, "buy", toyQuotes, 5);
  assert.equal(big.capped, true);
  assert.ok(big.sizeUsd > 1000 && big.sizeUsd < 10_000); // between the 2 bps and 10 bps points
  assert.ok(big.impactBps <= 5.0001);
});
