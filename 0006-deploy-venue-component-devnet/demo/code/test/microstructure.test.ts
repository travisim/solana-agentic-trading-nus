import { test } from "node:test";
import assert from "node:assert/strict";
import { depthWithin, imbalance, microprice, ofiStep, rollSpread, tickRule, tickRuleAccuracy, topOfBook, tradeImbalance, walkBook } from "../src/microstructure.ts";

const bids = [{ price: 99, size: 5 }, { price: 98, size: 10 }, { price: 90, size: 100 }];
const asks = [{ price: 101, size: 2 }, { price: 102, size: 8 }, { price: 110, size: 50 }];

test("top of book: spread, mid and spread in bps", () => {
  const t = topOfBook(bids, asks);
  assert.equal(t.spread, 2);
  assert.equal(t.mid, 100);
  assert.equal(t.spreadBps, 200);
  assert.equal(t.crossed, false);
});
test("an empty side gives no spread and no mid", () => {
  const t = topOfBook([], asks);
  assert.equal(t.spread, null);
  assert.equal(t.mid, null);
  assert.equal(t.bestAsk, 101);
});
test("depth within a band counts only levels inside it", () => {
  assert.equal(depthWithin(bids, "bid", 100, 200), 15); // 98 is exactly 2% away, 90 is not
  assert.equal(depthWithin(asks, "ask", 100, 200), 10); // 102 yes, 110 no
  assert.equal(depthWithin(bids, "bid", 100, 50), 0);
});
test("imbalance runs from -1 to +1", () => {
  assert.equal(imbalance(15, 10), 0.2);
  assert.equal(imbalance(0, 5), -1);
  assert.equal(imbalance(0, 0), null);
});
test("microprice leans toward the thinner side", () => {
  const t = topOfBook(bids, asks); // bid size 5, ask size 2: more size on the bid, so the price is pulled toward the ask
  const mp = microprice(t)!;
  assert.ok(mp > 100 && mp < 101);
  assert.equal(mp, (99 * 2 + 101 * 5) / 7);
});
test("order flow imbalance: a bigger bid at the same price is buying pressure", () => {
  const a = topOfBook([{ price: 99, size: 5 }], [{ price: 101, size: 5 }]);
  const b = topOfBook([{ price: 99, size: 8 }], [{ price: 101, size: 5 }]);
  // bid: cur>=prev adds cur.size 8, cur<=prev subtracts prev.size 5 -> +3 ; ask: cur<=prev adds 5, cur>=prev subtracts 5 -> 0 ; ofi = 3 - 0
  assert.equal(ofiStep(a, b), 3);
  // the ask moves up (sellers back off): ofi rises
  const c = topOfBook([{ price: 99, size: 5 }], [{ price: 102, size: 5 }]);
  assert.equal(ofiStep(a, c), 0 - (0 - 5)); // bid part 0, ask part: cur<=prev false, cur>=prev true -> -prev.size -> -5 ; ofi = 0 - (-5)
  // the bid drops: ofi falls
  const d = topOfBook([{ price: 98, size: 5 }], [{ price: 101, size: 5 }]);
  assert.equal(ofiStep(a, d), -5);
});
test("walking the book: volume weighted price and slippage versus the best price", () => {
  const w = walkBook(asks, 5, "buy"); // 2 @ 101 + 3 @ 102
  assert.equal(w.complete, true);
  assert.equal(w.cost, 2 * 101 + 3 * 102);
  assert.ok(Math.abs(w.vwap! - 508 / 5) < 1e-12);
  assert.ok(Math.abs(w.slippageBps! - (508 / 5 / 101 - 1) * 1e4) < 1e-9);
  const big = walkBook(asks, 1000, "buy");
  assert.equal(big.complete, false);
  assert.equal(big.filled, 60);
  const sell = walkBook(bids, 6, "sell"); // 5 @ 99 + 1 @ 98
  assert.ok(sell.slippageBps! > 0);
});
test("tick rule: up is +1, down is -1, unchanged repeats the last sign", () => {
  assert.deepEqual(tickRule([10, 11, 11, 10, 10, 10, 12]), [0, 1, 1, -1, -1, -1, 1]);
});
test("tick rule accuracy against reported sides", () => {
  const r = tickRuleAccuracy([
    { t: 0, price: 10, size: 1, side: "buy" },
    { t: 1, price: 11, size: 1, side: "buy" },
    { t: 2, price: 10, size: 1, side: "sell" },
    { t: 3, price: 11, size: 1, side: "sell" },
  ]);
  assert.deepEqual([r.agree, r.total], [2, 3]); // the first trade has no sign and is skipped
});
test("Roll estimate recovers the spread of a bouncing price", () => {
  const p = Array.from({ length: 200 }, (_, i) => (i % 2 ? 100.5 : 100));
  assert.ok(Math.abs(rollSpread(p)! - 1) < 0.02);
  assert.equal(rollSpread([1, 2, 3, 4, 5, 6, 7]), null); // trending: covariance positive, no estimate
});
test("trade imbalance", () => {
  const r = tradeImbalance([{ t: 0, price: 1, size: 3, side: "buy" }, { t: 1, price: 1, size: 1, side: "sell" }]);
  assert.equal(r.imbalance, 0.5);
});
