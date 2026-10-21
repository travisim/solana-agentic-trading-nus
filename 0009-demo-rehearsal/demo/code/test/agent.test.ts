import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARAMS, failureTests, oracleAt, overlapWindow, runAgent } from "../src/agent.ts";
import { readsOf, swapsOf } from "./helpers.ts";

// 40 swaps of 1,000 USD each. Price walks up 2 bps a swap for 20 swaps, then down 2 bps a swap.
function walk(n = 40, start = 100): ReturnType<typeof swapsOf> {
  let p = start;
  const rows: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    p *= i < n / 2 ? 1.0002 : 0.9998;
    rows.push([1000 + i * 2, p, 1000]);
  }
  return swapsOf(rows);
}
const small = { ...DEFAULT_PARAMS, thresholdUsd: 2000, cusumBps: 5, usdPerBps: 100, feeBps: 0 };

test("overlapWindow keeps only swaps between the first and last oracle read", () => {
  const sw = swapsOf([[90, 100, 10], [100, 100, 10], [150, 100, 10], [210, 100, 10]]);
  const w = overlapWindow(sw, readsOf(100, 200, 100));
  assert.deepEqual(w.map((s) => s.t), [100, 150]);
});

test("oracleAt returns the latest read at or before t", () => {
  const r = readsOf(0, 20, 100); // t = 0,5,10,15,20
  assert.equal(oracleAt(r, 12)!.t, 10);
  assert.equal(oracleAt(r, 20)!.t, 20);
  assert.equal(oracleAt(r, -1), null);
});

test("every change alert gets exactly one decision, in order", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100), small);
  assert.ok(run.events > 0);
  assert.equal(run.decisions.length, run.events);
  assert.deepEqual(run.decisions.map((d) => d.n), run.decisions.map((_, i) => i + 1));
  assert.equal(run.scorecard.accepted + run.scorecard.rejected, run.events);
});

test("an up alert proposes a buy, a down alert proposes a sell", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100), small);
  for (const d of run.decisions) assert.equal(d.order.side, d.direction === "up" ? "buy" : "sell");
  assert.ok(run.decisions.some((d) => d.direction === "up") && run.decisions.some((d) => d.direction === "down"));
});

test("order size is the bucket size in bps times usdPerBps", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100), small);
  for (const d of run.decisions) assert.equal(d.order.sizeUsd, Math.round(d.bucketBps * 100));
});

test("a small max-notional refuses orders and names the rule", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100), { ...small, limits: { ...small.limits, maxNotionalUsd: 1 } });
  assert.equal(run.scorecard.accepted, 0);
  assert.equal(run.scorecard.rejectedByRule["max-notional"], run.events);
  assert.equal(run.ledger.length, 0);
});

test("a stale oracle refuses every order with max-oracle-age", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100, 500), small);
  assert.equal(run.scorecard.accepted, 0);
  assert.equal(run.scorecard.rejectedByRule["max-oracle-age"], run.events);
});

test("ledger reconciles: cash + position at the last price equals the scorecard P&L", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100), { ...small, feeBps: 4, limits: { ...small.limits, maxNotionalUsd: 100000 } });
  assert.ok(run.ledger.length > 1);
  const last = run.ledger.at(-1)!;
  const sumSigned = run.ledger.reduce((a, r) => a + (r.side === "buy" ? -r.sizeUsd : r.sizeUsd) - r.feeUsd, 0);
  assert.ok(Math.abs(last.cashUsd - sumSigned) < 0.05, `cash ${last.cashUsd} vs ${sumSigned}`);
  const qty = run.ledger.reduce((a, r) => a + (r.side === "buy" ? r.solQty : -r.solQty), 0);
  assert.ok(Math.abs(last.positionSol - qty) < 1e-5);
  assert.ok(Math.abs(run.scorecard.pnlNetUsd - (last.cashUsd + last.positionSol * run.scorecard.markPrice)) < 0.05);
});

test("fills use the next swap price, never the alert's own price or an earlier one", () => {
  const sw = walk();
  const run = runAgent(sw, readsOf(1000, 1080, 100), small);
  for (const row of run.ledger) {
    const ev = run.decisions.find((d) => d.n === row.n)!;
    assert.ok(row.t > ev.t, "fill time is after the alert");
    assert.equal(sw.find((s) => s.t === row.t)!.price, row.fillPrice);
  }
});

test("no accepted order means an empty scorecard, not NaN", () => {
  const run = runAgent(walk(), readsOf(1000, 1080, 100), { ...small, limits: { ...small.limits, maxNotionalUsd: 1 } });
  assert.equal(run.scorecard.pnlNetUsd, 0);
  assert.equal(run.scorecard.hitRate, 0);
  assert.equal(run.scorecard.maxDrawdownUsd, 0);
});

test("the scorecard carries the simulated label", () => {
  assert.match(runAgent(walk(), readsOf(1000, 1080, 100), small).scorecard.label, /Simulated, on recorded data; not advice/);
});

test("too few swaps in the oracle window is a clear error", () => {
  assert.throws(() => runAgent(swapsOf([[5000, 100, 10]]), readsOf(0, 100, 100)), /not enough swaps/);
});

test("failure test: every injected bad order is refused, each by the rule it should hit", () => {
  const f = failureTests({ oraclePrice: 100, oracleAgeSec: 3 });
  assert.equal(f.length, 4);
  assert.ok(f.every((x) => !x.ok && x.injected));
  assert.deepEqual(f.map((x) => x.rule), ["max-notional", "max-oracle-age", "unit-sanity", "max-oracle-gap"]);
});
