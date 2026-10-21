// The scorecard: a handful of honest numbers computed from a trade ledger.
// One function in, one object out. No state, no network. Everything the demos show comes from here.
import type { Ledger, LedgerTrade } from "./types.ts";

export interface CostSettings {
  feeBps: number; // charged on every leg
  slippageBps: number; // charged on every leg of strategies that cross the spread
}

/** Net P&L of one trade after fees and slippage (USD). */
export function netUsd(t: LedgerTrade, c: CostSettings): number {
  const bps = c.feeBps + (t.paysSlippage ? c.slippageBps : 0);
  return t.grossUsd - t.legs * (bps / 10_000) * t.notionalUsd;
}

export function costUsd(t: LedgerTrade, c: CostSettings): number {
  return t.grossUsd - netUsd(t, c);
}

export interface EquityCurve {
  times: number[];
  equity: number[]; // USD, starts at capital
  drawdown: number[]; // USD below the running peak, >= 0
}

/** Equity at each grid time = capital + net P&L of every trade closed by then. */
export function equityCurve(trades: LedgerTrade[], c: CostSettings, capitalUsd: number, times: number[]): EquityCurve {
  const sorted = [...trades].sort((a, b) => a.closeT - b.closeT);
  const equity: number[] = [];
  const drawdown: number[] = [];
  let k = 0;
  let eq = capitalUsd;
  let peak = capitalUsd;
  for (const t of times) {
    while (k < sorted.length && sorted[k]!.closeT <= t) eq += netUsd(sorted[k++]!, c);
    peak = Math.max(peak, eq);
    equity.push(r(eq, 4));
    drawdown.push(r(peak - eq, 4));
  }
  return { times, equity, drawdown };
}

export interface Score {
  trades: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  avgWinUsd: number | null;
  avgLossUsd: number | null; // negative number
  payoffRatio: number | null; // average win divided by the size of the average loss
  breakEvenHitRate: number | null; // hit rate you need, given those payoffs, to break even
  expectancyUsd: number | null; // average net P&L per trade
  grossUsd: number;
  costsUsd: number;
  netUsd: number;
  costShareOfGross: number | null; // costs / gross profit (only when gross > 0)
  maxDrawdownUsd: number;
  maxDrawdownPct: number; // of the running peak equity
  longestUnderwaterSec: number;
  timeUnderwaterShare: number; // 0..1 of the window spent below a previous peak
  tradedUsd: number; // sum of notional x legs
  turnoverX: number; // tradedUsd / capital
  avgHoldSec: number | null;
  largestWinShare: number | null; // biggest single win as a share of all gross winnings
  perTradeSharpe: number | null; // mean / standard deviation of net P&L per trade (not annualised)
  probFailure: number | null; // chance the true hit rate is below break-even, given what we saw (normal approximation)
  enoughTrades: boolean; // false below 30 trades: read every number with care
}

export function normCdf(z: number): number {
  // Abramowitz and Stegun 7.1.26 via erf; accurate to about 1e-7
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Chance that the TRUE hit rate is below break-even, given the hit rate we observed over n trades (normal approximation). */
export function failureProbability(hit: number, breakEven: number, n: number): number {
  const se = Math.sqrt((hit * (1 - hit)) / n);
  return se === 0 ? (hit < breakEven ? 1 : 0) : normCdf((breakEven - hit) / se);
}

/** Hit rate needed to break even when wins pay `win` and losses cost `loss` (loss is a positive size). */
export function breakEvenHitRate(win: number, loss: number): number {
  return loss / (win + loss);
}

/** Hit rate needed for a per-trade Sharpe ratio `s`, given average win and (negative) average loss. Returns null if impossible. */
export function impliedHitRate(win: number, lossNeg: number, s: number): number | null {
  const d = win - lossNeg;
  const A = (1 + s * s) * d * d;
  const B = 2 * d * lossNeg - s * s * d * d;
  const C = lossNeg * lossNeg;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const p = (-B + Math.sqrt(disc)) / (2 * A);
  return p >= 0 && p <= 1 ? p : null;
}

export function score(trades: LedgerTrade[], c: CostSettings, capitalUsd: number, times: number[]): Score {
  const nets = trades.map((t) => netUsd(t, c));
  const n = trades.length;
  const winsArr = nets.filter((x) => x > 0);
  const lossArr = nets.filter((x) => x < 0);
  const gross = trades.reduce((a, t) => a + t.grossUsd, 0);
  const net = nets.reduce((a, b) => a + b, 0);
  const costs = gross - net;
  const avgWin = winsArr.length ? mean(winsArr) : null;
  const avgLoss = lossArr.length ? mean(lossArr) : null;
  const eq = equityCurve(trades, c, capitalUsd, times);
  let peak = capitalUsd;
  let maxDd = 0;
  let maxDdPct = 0;
  let under = 0;
  let run = 0;
  let longest = 0;
  eq.equity.forEach((e, i) => {
    peak = Math.max(peak, e);
    const dd = eq.drawdown[i]!;
    maxDd = Math.max(maxDd, dd);
    maxDdPct = Math.max(maxDdPct, (dd / peak) * 100);
    if (dd > 1e-9) { under++; run++; longest = Math.max(longest, run); } else run = 0;
  });
  const step = times.length > 1 ? (times[times.length - 1]! - times[0]!) / (times.length - 1) : 0;
  const traded = trades.reduce((a, t) => a + t.notionalUsd * t.legs, 0);
  const grossWins = trades.filter((t) => t.grossUsd > 0).map((t) => t.grossUsd);
  const be = avgWin !== null && avgLoss !== null ? breakEvenHitRate(avgWin, -avgLoss) : null;
  const hit = n ? winsArr.length / n : null;
  let probFail: number | null = null;
  if (be !== null && hit !== null && n >= 2) {
    probFail = failureProbability(hit, be, n);
  }
  const sd = n > 1 ? std(nets) : 0;
  return {
    trades: n,
    wins: winsArr.length,
    losses: lossArr.length,
    hitRate: hit === null ? null : r(hit, 4),
    avgWinUsd: avgWin === null ? null : r(avgWin, 4),
    avgLossUsd: avgLoss === null ? null : r(avgLoss, 4),
    payoffRatio: avgWin !== null && avgLoss !== null ? r(avgWin / -avgLoss, 4) : null,
    breakEvenHitRate: be === null ? null : r(be, 4),
    expectancyUsd: n ? r(net / n, 4) : null,
    grossUsd: r(gross, 4),
    costsUsd: r(costs, 4),
    netUsd: r(net, 4),
    costShareOfGross: gross > 0 ? r(costs / gross, 4) : null,
    maxDrawdownUsd: r(maxDd, 4),
    maxDrawdownPct: r(maxDdPct, 4),
    longestUnderwaterSec: Math.round(longest * step),
    timeUnderwaterShare: times.length ? r(under / times.length, 4) : 0,
    tradedUsd: r(traded, 2),
    turnoverX: capitalUsd ? r(traded / capitalUsd, 4) : 0,
    avgHoldSec: n ? Math.round(mean(trades.map((t) => t.closeT - t.openT))) : null,
    largestWinShare: grossWins.length ? r(Math.max(...grossWins) / grossWins.reduce((a, b) => a + b, 0), 4) : null,
    perTradeSharpe: sd > 0 ? r(net / n / sd, 4) : null,
    probFailure: probFail === null ? null : r(probFail, 4),
    enoughTrades: n >= 30,
  };
}

/** Optional on-chain cost fields. Returns null when the ledger has none (we never invent them). */
export interface OnChainSummary {
  transactions: number;
  failed: number;
  failedRate: number;
  baseFeeLamports: number;
  priorityFeeLamports: number;
  jitoTipLamports: number;
  explorerLinks: string[];
}
export function onChainSummary(trades: LedgerTrade[]): OnChainSummary | null {
  const withChain = trades.filter((t) => t.status !== undefined);
  if (!withChain.length) return null;
  const failed = withChain.filter((t) => t.status === "failed").length;
  const sum = (f: (t: LedgerTrade) => number | undefined) => withChain.reduce((a, t) => a + (f(t) ?? 0), 0);
  return {
    transactions: withChain.length,
    failed,
    failedRate: r(failed / withChain.length, 4),
    baseFeeLamports: sum((t) => t.baseFeeLamports),
    priorityFeeLamports: sum((t) => t.priorityFeeLamports),
    jitoTipLamports: sum((t) => t.jitoTipLamports),
    explorerLinks: withChain.filter((t) => t.signature).map((t) => `https://explorer.solana.com/tx/${t.signature}${t.cluster === "devnet" ? "?cluster=devnet" : ""}`),
  };
}

/** Time grid for a ledger: `steps+1` evenly spaced points from window start to end. */
export function gridOf(ledger: Pick<Ledger, "windowStartT" | "windowEndT" | "intervalSec">): number[] {
  const out: number[] = [];
  for (let t = ledger.windowStartT; t <= ledger.windowEndT; t += ledger.intervalSec) out.push(t);
  return out;
}

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
export const std = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
function r(x: number, d: number): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}
