import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePythPrice, PYTH_RECEIVER_PROGRAM, SOL_USD_ACCOUNT, SOL_USD_FEED_ID } from "../src/collectors/pyth.ts";
import { decodeWhirlpool, priceFromSqrtPrice, SOL_USDC_POOL, WHIRLPOOL_PROGRAM, base58 } from "../src/collectors/orca.ts";
import { priceFromQuote } from "../src/collectors/jupiter.ts";
import { gapBps } from "../src/collectors/index.ts";
import { fixtureBytes } from "./helpers.ts";

test("Pyth: decodes a real captured PriceUpdateV2 account", () => {
  const acc = fixtureBytes(SOL_USD_ACCOUNT);
  assert.equal(acc.owner, PYTH_RECEIVER_PROGRAM);
  const p = decodePythPrice(acc.bytes);
  assert.equal(p.feedId, SOL_USD_FEED_ID);
  assert.ok(Math.abs(p.price - 107.95396609) < 1e-9); // raw 10795396609 * 10^-8
  assert.equal(p.publishTime, 1792602786);
  assert.equal(p.postedSlot, 459709268);
  assert.ok(p.confBps > 0 && p.confBps < 20);
});
test("Pyth: rejects a wrong account", () => {
  assert.throws(() => decodePythPrice(new Uint8Array(200)), /not a Pyth/);
  assert.throws(() => decodePythPrice(new Uint8Array(10)), /too short/);
});
test("Orca: price from sqrtPrice for a known value", () => {
  // price 100 USDC/SOL in raw units = 100 * 10^6 / 10^9 = 0.1 ; sqrt(0.1) in Q64.64
  const sqrt = BigInt(Math.round(Math.sqrt(0.1) * 2 ** 40)) << 24n;
  assert.ok(Math.abs(priceFromSqrtPrice(sqrt) - 100) < 1e-4);
});
test("Orca: decodes a real captured whirlpool account, and it agrees with Pyth within 0.5%", () => {
  const acc = fixtureBytes(SOL_USDC_POOL);
  assert.equal(acc.owner, WHIRLPOOL_PROGRAM);
  const pool = decodeWhirlpool(acc.bytes);
  assert.equal(pool.mintA, "So11111111111111111111111111111111111111112");
  assert.equal(pool.mintB, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  assert.equal(pool.feeRate, 400); // 0.04%
  assert.ok(pool.sqrtPrice > 0n);
  const pyth = decodePythPrice(fixtureBytes(SOL_USD_ACCOUNT).bytes).price;
  assert.ok(Math.abs(pool.price - pyth) / pyth < 0.005, `orca ${pool.price} vs pyth ${pyth}`);
});
test("base58 encodes the SOL mint", () => {
  const bytes = Uint8Array.from([6, 155, 136, 87, 254, 171, 129, 132, 251, 104, 127, 99, 70, 24, 192, 53, 218, 196, 57, 220, 26, 235, 59, 85, 152, 160, 240, 0, 0, 0, 0, 1]);
  assert.equal(base58(bytes), "So11111111111111111111111111111111111111112");
});
test("Jupiter: outAmount (USDC, 6 decimals) becomes a USD price for 1 SOL", () => {
  assert.equal(priceFromQuote({ outAmount: "107911505" }), 107.911505);
});
test("gap in bps", () => {
  assert.equal(gapBps(100.1, 100), 10);
  assert.equal(gapBps(99.9, 100), -10);
});
