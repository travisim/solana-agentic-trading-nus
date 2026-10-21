import { test } from "node:test";
import assert from "node:assert/strict";
import { crossVenueArb } from "../src/strategies/crossVenueArb.ts";
import { basis } from "../src/strategies/basis.ts";
import { trend } from "../src/strategies/trend.ts";
import { meanReversion } from "../src/strategies/meanReversion.ts";
import { marketMaker } from "../src/strategies/marketMaker.ts";
import { runAll } from "../src/strategies/index.ts";
import { seriesOf } from "./helpers.ts";

const free = { feeBps: 0, slippageBps: 0 };
const costs = { feeBps: 5, slippageBps: 2 };

test("cross-venue arb: constant 20 bps gap, 10 samples", () => {
  const s = seriesOf(Array.from({ length: 10 }, () => [100.2, 100.1, 100] as [number, number, number]));
  const free_ = crossVenueArb(s, free);
  assert.equal(free_.trades, 10);
  assert.equal(free_.pnlGrossUsd, 20); // 10 trades x 1000 USD x 0.2% (rounded to cents)
  assert.equal(free_.pnlNetUsd, 20);
  const paid = crossVenueArb(s, costs);
  assert.equal(paid.pnlNetUsd, 6); // 20 - 10 trades x 2 legs x 7 bps x 1000 USD = 20 - 14
  assert.equal(paid.hitRate, 1);
});
test("cross-venue arb: a gap smaller than the threshold makes no trade", () => {
  const s = seriesOf(Array.from({ length: 10 }, () => [100.05, 100, 100] as [number, number, number]));
  assert.equal(crossVenueArb(s, free).trades, 0);
});
test("basis: pool rich vs oracle then converges -> one winning short", () => {
  const rows: [number, number, number][] = [[100, 100, 100], [100, 100, 100.1], [100, 100, 100.05], [100, 100, 100], [100, 100, 100]];
  const r = basis(seriesOf(rows), free);
  assert.equal(r.trades, 1);
  assert.equal(r.pnlGrossUsd, 1); // sold at 100.10, bought back at 100.00 -> about 1 USD per 1000
});
test("accounting identity holds for every strategy: net = gross - trades x legs x cost", () => {
  const rows: [number, number, number][] = [];
  let p = 100;
  for (let i = 0; i < 400; i++) {
    p += Math.sin(i / 7) * 0.05 + (i % 5 === 0 ? 0.03 : -0.01);
    rows.push([p + 0.02 * Math.sin(i), p, p - 0.02 * Math.cos(i / 3)]);
  }
  const s = seriesOf(rows);
  for (const r of runAll(s, costs)) {
    const slip = r.paysSlippage ? costs.slippageBps : 0;
    const expected = r.pnlGrossUsd - r.trades * r.legsPerTrade * ((costs.feeBps + slip) / 10_000) * r.notionalUsd;
    assert.ok(Math.abs(r.pnlNetUsd - expected) < 0.05 * Math.max(1, r.trades), `${r.id}: ${r.pnlNetUsd} vs ${expected}`);
    assert.ok(r.hitRate >= 0 && r.hitRate <= 1);
  }
});
test("costs never improve a result; zero costs give net = gross", () => {
  const rows: [number, number, number][] = [];
  for (let i = 0; i < 300; i++) rows.push([100 + Math.sin(i / 5), 100 + Math.sin(i / 5 + 0.3), 100 + Math.sin(i / 5 + 0.1)]);
  const s = seriesOf(rows);
  for (const fn of [crossVenueArb, basis, trend, meanReversion, marketMaker]) {
    const a = fn(s, free);
    const b = fn(s, costs);
    assert.equal(a.pnlNetUsd, a.pnlGrossUsd, a.id);
    assert.ok(b.pnlNetUsd <= a.pnlNetUsd, a.id);
    assert.equal(a.pnlGrossUsd, b.pnlGrossUsd, a.id);
  }
});
test("trend and mean reversion: flat prices make no trades", () => {
  const s = seriesOf(Array.from({ length: 200 }, () => [100, 100, 100] as [number, number, number]));
  assert.equal(meanReversion(s, costs).trades, 0);
  assert.equal(marketMaker(s, costs).trades, 0);
});
test("trend: a rise then a fall closes at least one trade", () => {
  const rows: [number, number, number][] = [];
  for (let i = 0; i < 300; i++) { const p = i < 150 ? 100 + i * 0.05 : 107.5 - (i - 150) * 0.05; rows.push([p, p, p]); }
  assert.ok(trend(seriesOf(rows), free).trades >= 1);
});
test("market maker: bid gets filled, price recovers -> positive gross", () => {
  const rows: [number, number, number][] = [[100, 100, 100], [100, 100, 99.9]];
  for (let i = 0; i < 20; i++) rows.push([100, 100.2, 100]);
  const r = marketMaker(seriesOf(rows), free);
  assert.ok(r.trades >= 1 && r.pnlGrossUsd > 0);
});
