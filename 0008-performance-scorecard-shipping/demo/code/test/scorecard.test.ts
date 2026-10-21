import { test } from "node:test";
import assert from "node:assert/strict";
import { breakEvenHitRate, equityCurve, impliedHitRate, netUsd, normCdf, onChainSummary, score } from "../src/scorecard.ts";
import type { LedgerTrade } from "../src/types.ts";

const free = { feeBps: 0, slippageBps: 0 };
let id = 0;
const T = (closeT: number, grossUsd: number, extra: Partial<LedgerTrade> = {}): LedgerTrade => ({
  id: ++id, strategy: "t", side: "long", openT: closeT - 10, closeT, entry: 100, exit: 100, notionalUsd: 1000, grossUsd, legs: 2, paysSlippage: true, ...extra,
});
const times = Array.from({ length: 11 }, (_, i) => i * 10); // 0..100

test("net = gross - legs x (fee + slippage) x notional", () => {
  assert.equal(netUsd(T(10, 5), { feeBps: 5, slippageBps: 2 }), 5 - 2 * 0.0007 * 1000); // 3.6
  assert.equal(netUsd(T(10, 5, { paysSlippage: false, legs: 1 }), { feeBps: 5, slippageBps: 2 }), 5 - 0.5);
  assert.equal(netUsd(T(10, 5), free), 5);
});
test("hand-checked example: wins +10 +10 +10, losses -5 -5", () => {
  const trades = [T(10, 10), T(20, -5), T(30, 10), T(40, -5), T(50, 10)];
  const s = score(trades, free, 1000, times);
  assert.equal(s.trades, 5);
  assert.equal(s.hitRate, 0.6);
  assert.equal(s.avgWinUsd, 10);
  assert.equal(s.avgLossUsd, -5);
  assert.equal(s.payoffRatio, 2);
  assert.equal(s.breakEvenHitRate, 0.3333); // loss / (win + loss) = 5/15
  assert.equal(s.netUsd, 20);
  assert.equal(s.expectancyUsd, 4);
  assert.equal(s.tradedUsd, 10_000); // 5 trades x 2 legs x 1000
  assert.equal(s.turnoverX, 10);
  assert.equal(s.avgHoldSec, 10);
  assert.equal(s.largestWinShare, 0.3333);
  assert.equal(s.enoughTrades, false);
});
test("drawdown and time under water on a known path", () => {
  // equity: 1000, +10 at t=10 -> 1010 (peak), -30 at t=20 -> 980, +5 at t=60 -> 985, +40 at t=80 -> 1025 (new peak)
  const trades = [T(10, 10), T(20, -30), T(60, 5), T(80, 40)];
  const e = equityCurve(trades, free, 1000, times);
  assert.deepEqual(e.equity.slice(0, 3), [1000, 1010, 980]);
  assert.equal(e.drawdown[2], 30);
  assert.equal(e.drawdown[7], 25); // t=70: 985 vs peak 1010
  const s = score(trades, free, 1000, times);
  assert.equal(s.maxDrawdownUsd, 30);
  assert.equal(s.maxDrawdownPct, r(30 / 1010 * 100));
  // under water at t=20,30,40,50,60,70 (6 samples of 11); new peak at t=80
  assert.equal(s.timeUnderwaterShare, r(6 / 11));
  assert.equal(s.longestUnderwaterSec, 60);
});
test("costs can turn a winning ledger into a losing one", () => {
  const trades = [T(10, 1), T(20, 1), T(30, 1)];
  assert.ok(score(trades, free, 1000, times).netUsd > 0);
  const paid = score(trades, { feeBps: 5, slippageBps: 2 }, 1000, times);
  assert.ok(paid.netUsd < 0);
  assert.equal(paid.hitRate, 0);
  assert.ok(Math.abs(paid.costsUsd - 3 * 1.4) < 1e-9); // 3 trades x 1.4 USD
});
test("empty ledger gives nulls, never NaN", () => {
  const s = score([], free, 1000, times);
  assert.equal(s.trades, 0);
  for (const [k, v] of Object.entries(s)) assert.ok(v === null || typeof v === "number" || typeof v === "boolean", k + String(v));
  assert.ok(!JSON.stringify(s).includes("NaN"));
  assert.equal(s.hitRate, null);
  assert.equal(s.maxDrawdownUsd, 0);
});
test("probability of failure: more trades make the same hit rate more certain", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => T(i + 1, i % 5 < 3 ? 10 : -10)); // 60% hit, payoff 1: break-even 50%
  const small = score(mk(10), free, 1000, times).probFailure!;
  const big = score(mk(200), free, 1000, times).probFailure!;
  assert.ok(small > big, `${small} vs ${big}`);
  assert.ok(big < 0.01);
});
test("break-even and implied hit rate", () => {
  assert.equal(breakEvenHitRate(10, 10), 0.5);
  assert.equal(breakEvenHitRate(20, 10), 1 / 3);
  assert.ok(Math.abs(impliedHitRate(10, -10, 0)! - 0.5) < 1e-12);
  const p = impliedHitRate(10, -10, 0.5)!; // symmetric payoffs, per-trade Sharpe 0.5
  assert.ok(Math.abs(p - 0.5 * (1 + 0.5 / Math.sqrt(1.25))) < 1e-9, String(p)); // (2p-1)/(2 sqrt(p(1-p))) = 0.5
  assert.ok(impliedHitRate(10, -10, 0.5)! > 0.5);
});
test("normal CDF", () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-7);
  assert.ok(Math.abs(normCdf(1.96) - 0.975) < 1e-4);
  assert.ok(Math.abs(normCdf(-1.96) - 0.025) < 1e-4);
});
test("on-chain summary is null without on-chain fields, counts failures with them", () => {
  assert.equal(onChainSummary([T(1, 1)]), null);
  const s = onChainSummary([T(1, 1, { status: "confirmed", baseFeeLamports: 5000, priorityFeeLamports: 100, signature: "abc", cluster: "devnet" }), T(2, 1, { status: "failed", baseFeeLamports: 5000 })])!;
  assert.equal(s.failedRate, 0.5);
  assert.equal(s.baseFeeLamports, 10_000);
  assert.equal(s.priorityFeeLamports, 100);
  assert.deepEqual(s.explorerLinks, ["https://explorer.solana.com/tx/abc?cluster=devnet"]);
});
function r(x: number) { return Math.round(x * 1e4) / 1e4; }
