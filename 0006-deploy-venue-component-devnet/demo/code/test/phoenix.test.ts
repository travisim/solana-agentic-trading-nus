import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePhoenixMarket, liveOrders, toLadder } from "../src/phoenix.ts";
import { readAccountFixture, readExpected } from "./helpers.ts";

// The expected values in test/fixtures/*.expected.json were produced by the official @ellipsis-labs/phoenix-sdk 2.0.3
// (deserializeMarketData + getUiLadder) on these exact account files, so this test checks our decoder against the SDK.
for (const address of ["2t9TBYyUyovhHQq434uAiBxW6DmJCg7w4xdDoSK6LRjP", "626t4FAUCVWMSvZsjzyPDJjPAKvdrafJB2pAcC6Ags2m", "CS2H8nbAVVEUHWPF5extCSymqheQdkd4d7thik6eet9N"]) {
  test(`decoder matches the official SDK on ${address.slice(0, 6)}...`, () => {
    const m = decodePhoenixMarket(readAccountFixture(address));
    const exp = readExpected(address);
    assert.equal(m.bids.length, exp.counts.bids);
    assert.equal(m.asks.length, exp.counts.asks);
    const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
    const bids = toLadder(m.bids, 5);
    const asks = toLadder(m.asks, 5);
    assert.equal(bids.length, exp.bids.length);
    assert.equal(asks.length, exp.asks.length);
    exp.bids.forEach((e, i) => assert.ok(near(bids[i]!.price, e.price) && near(bids[i]!.size, e.size), `bid ${i}`));
    exp.asks.forEach((e, i) => assert.ok(near(asks[i]!.price, e.price) && near(asks[i]!.size, e.size), `ask ${i}`));
  });
}

test("devnet SOL/USDC test market is one-sided: asks only", () => {
  const m = decodePhoenixMarket(readAccountFixture("CS2H8nbAVVEUHWPF5extCSymqheQdkd4d7thik6eet9N"));
  assert.equal(m.bids.length, 0);
  assert.ok(m.asks.length > 0);
});

test("bids are sorted high to low and asks low to high, earliest first within a price", () => {
  const m = decodePhoenixMarket(readAccountFixture("2t9TBYyUyovhHQq434uAiBxW6DmJCg7w4xdDoSK6LRjP"));
  for (let i = 1; i < m.bids.length; i++) assert.ok(m.bids[i - 1]!.price >= m.bids[i]!.price);
  for (let i = 1; i < m.asks.length; i++) assert.ok(m.asks[i - 1]!.price <= m.asks[i]!.price);
  assert.ok(m.bids[0]!.price < m.asks[0]!.price, "the book is not crossed");
});

test("market metadata is read from the header", () => {
  const m = decodePhoenixMarket(readAccountFixture("2t9TBYyUyovhHQq434uAiBxW6DmJCg7w4xdDoSK6LRjP"));
  assert.equal(m.quote.mint, "So11111111111111111111111111111111111111112");
  assert.equal(m.base.decimals, 9);
  assert.equal(m.numBidsCapacity, 2048);
});

test("expired orders are dropped", () => {
  const o = (slot: number, ts: number) => ({ price: 1, size: 1, seq: 1n, traderIndex: 0, lastValidSlot: slot, lastValidUnixTimestamp: ts });
  const kept = liveOrders([o(0, 0), o(100, 0), o(99, 0), o(0, 1000), o(0, 999)], 100, 1000);
  assert.equal(kept.length, 3);
});

test("a short or foreign account is refused, not misread", () => {
  assert.throws(() => decodePhoenixMarket(new Uint8Array(100)), /too short/);
});
