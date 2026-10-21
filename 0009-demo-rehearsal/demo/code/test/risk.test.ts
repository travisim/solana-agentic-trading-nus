import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMITS, checkOrder } from "../src/risk.ts";

const ctx = { oraclePrice: 100, oracleAgeSec: 5 };
test("a normal order is accepted", () => assert.equal(checkOrder({ side: "buy", sizeUsd: 250, price: 100 }, ctx).ok, true));
test("each rule fires with its own name", () => {
  assert.equal(checkOrder({ side: "buy", sizeUsd: 5000, price: 100 }, ctx).rule, "max-notional");
  assert.equal(checkOrder({ side: "buy", sizeUsd: 250, price: 101 }, ctx).rule, "max-oracle-gap");
  assert.equal(checkOrder({ side: "buy", sizeUsd: 250, price: 100 }, { ...ctx, oracleAgeSec: 300 }).rule, "max-oracle-age");
  assert.equal(checkOrder({ side: "buy", sizeUsd: 250, price: 10000 }, ctx).rule, "unit-sanity");
  assert.equal(checkOrder({ side: "buy", sizeUsd: -5, price: 100 }, ctx).rule, "unit-sanity");
});
test("exactly at the limits is accepted", () => {
  assert.equal(checkOrder({ side: "sell", sizeUsd: DEFAULT_LIMITS.maxNotionalUsd, price: 100 }, ctx).ok, true);
});
