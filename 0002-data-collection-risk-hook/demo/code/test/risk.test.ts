import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOrder, DEFAULT_LIMITS } from "../src/risk.ts";

const ctx = { oraclePrice: 100, oracleAgeSec: 2 };
const buy = (sizeUsd: number, price = 100) => ({ side: "buy" as const, sizeUsd, price });

test("accepts an order inside every limit", () => {
  assert.deepEqual(checkOrder(buy(250), ctx, DEFAULT_LIMITS), { ok: true, rule: null, reason: "within all limits" });
});
test("max-notional: rejects above the limit, accepts exactly at it", () => {
  const r = checkOrder(buy(5000), ctx, DEFAULT_LIMITS);
  assert.equal(r.ok, false);
  assert.equal(r.rule, "max-notional");
  assert.match(r.reason, /5000 USD exceeds the 1000 USD limit/);
  assert.equal(checkOrder(buy(1000), ctx, DEFAULT_LIMITS).ok, true);
});
test("max-oracle-gap: 51 bps rejected, 50 bps accepted", () => {
  assert.equal(checkOrder(buy(100, 100.51), ctx, DEFAULT_LIMITS).rule, "max-oracle-gap");
  assert.equal(checkOrder(buy(100, 100.5), ctx, DEFAULT_LIMITS).ok, true);
  assert.equal(checkOrder(buy(100, 99.4), ctx, DEFAULT_LIMITS).rule, "max-oracle-gap"); // below oracle counts too
});
test("max-oracle-age: stale oracle is rejected", () => {
  const r = checkOrder(buy(100), { ...ctx, oracleAgeSec: 61 }, DEFAULT_LIMITS);
  assert.equal(r.rule, "max-oracle-age");
  assert.equal(checkOrder(buy(100), { ...ctx, oracleAgeSec: 60 }, DEFAULT_LIMITS).ok, true);
});
test("unit-sanity: cents, negative, zero, NaN and bad side are rejected", () => {
  assert.equal(checkOrder(buy(100, 10000), ctx, DEFAULT_LIMITS).rule, "unit-sanity");
  assert.equal(checkOrder(buy(-5), ctx, DEFAULT_LIMITS).rule, "unit-sanity");
  assert.equal(checkOrder(buy(0), ctx, DEFAULT_LIMITS).rule, "unit-sanity");
  assert.equal(checkOrder(buy(Number.NaN), ctx, DEFAULT_LIMITS).rule, "unit-sanity");
  assert.equal(checkOrder(buy(100, 0), ctx, DEFAULT_LIMITS).rule, "unit-sanity");
  assert.equal(checkOrder({ side: "hold" as never, sizeUsd: 1, price: 100 }, ctx, DEFAULT_LIMITS).rule, "unit-sanity");
});
test("limits are parameters: raising max notional lets the big order through", () => {
  assert.equal(checkOrder(buy(5000), ctx, { ...DEFAULT_LIMITS, maxNotionalUsd: 10_000 }).ok, true);
});
test("pure: same input gives same output and the input is not changed", () => {
  const order = buy(5000);
  const copy = { ...order };
  assert.deepEqual(checkOrder(order, ctx), checkOrder(order, ctx));
  assert.deepEqual(order, copy);
});
