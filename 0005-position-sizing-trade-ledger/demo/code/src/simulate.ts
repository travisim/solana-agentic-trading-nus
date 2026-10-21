// The loop that ties it together, on recorded data:
//   signal -> bet (confidence -> size) -> average the open bets -> round to steps -> target exposure
//   -> order for the difference -> impact cap -> RISK HOOK (from build night 1) -> simulated fill -> ledger row.
// Simulated, on recorded data; not advice. No real orders are sent anywhere.
import { activeAt } from "./concurrency.ts";
import { impactBpsFor } from "./impact.ts";
import { Ledger } from "./ledger.ts";
import { checkOrder, DEFAULT_LIMITS } from "./risk.ts";
import { makeSignals, DEFAULT_SIGNAL, type SignalParams } from "./signals.ts";
import { capOrderByImpact, combineBets, discretize, DEFAULT_SIZING, probToSize, targetUsdOf } from "./sizing.ts";
import type { Bet, ImpactQuote, LedgerRow, RiskLimits, Series, SizingParams } from "./types.ts";

export interface RunConfig {
  id: string;
  label: string;
  sizing: SizingParams;
  signal: SignalParams;
  limits: RiskLimits;
  horizonSec: number; // how long each bet stays open
  combine: "average" | "sum";
  feeBps: number; // pool fee on every fill
  useImpact: boolean; // charge the price impact from the Jupiter curve
  injected: boolean; // add the two deliberate bad orders (fat finger, wrong unit)
}

export const DEFAULT_RUN: RunConfig = {
  id: "main",
  label: "With costs, averaged bets",
  sizing: DEFAULT_SIZING,
  signal: DEFAULT_SIGNAL,
  limits: DEFAULT_LIMITS,
  horizonSec: 300,
  combine: "average",
  feeBps: 4,
  useImpact: true,
  injected: true,
};

export interface EquityPoint {
  t: number;
  equityUsd: number;
  cashUsd: number;
  posSol: number;
  exposureUsd: number;
  mark: number;
}
export interface ExposurePoint {
  t: number;
  active: number;
  average: number; // mean of open bets' signed sizes (before rounding)
  sum: number; // naive sum, clipped to [-1, 1]
}
export interface RunResult {
  config: RunConfig;
  ledger: Ledger;
  bets: Bet[];
  equity: EquityPoint[];
  exposure: ExposurePoint[];
  stats: {
    signals: number;
    orders: number;
    filled: number;
    rejected: number;
    rejectedByRule: Record<string, number>;
    cappedByImpact: number;
    tooSmall: number;
    feesUsd: number;
    impactCostUsd: number;
    finalEquityUsd: number;
    returnPct: number;
    maxDrawdownPct: number;
    maxConcurrent: number;
    maxAbsExposureUsd: number;
  };
}

const round = (x: number, d = 6) => Math.round(x * 10 ** d) / 10 ** d;

/** Seconds since the oracle value last changed: a proxy for oracle age (the recorded series has no publish time). */
export function oracleAgeProxy(series: Series): number[] {
  const out: number[] = [];
  let lastChange = series.points[0]!.t;
  series.points.forEach((p, i) => {
    if (i > 0 && p.pyth !== series.points[i - 1]!.pyth) lastChange = p.t;
    out.push(p.t - lastChange);
  });
  return out;
}

export function simulate(series: Series, solQuotes: ImpactQuote[], cfg: RunConfig = DEFAULT_RUN, ledgerFile: string | null = null): RunResult {
  const pts = series.points;
  const ages = oracleAgeProxy(series);
  const signals = makeSignals(series, cfg.signal);
  const sigByT = new Map(signals.map((s) => [s.t, s]));
  const ledger = new Ledger(ledgerFile);
  const bets: Bet[] = [];
  const equity: EquityPoint[] = [];
  const exposure: ExposurePoint[] = [];
  const rejectedByRule: Record<string, number> = {};
  let cash = cfg.sizing.startUsd, pos = 0;
  let orders = 0, filled = 0, rejected = 0, capped = 0, tooSmall = 0, fees = 0, impactCost = 0, maxConc = 0, maxExp = 0;
  // two deliberate bad orders, at fixed places in the recorded window (labelled "injected" in the ledger)
  const injectAt = cfg.injected ? new Set([Math.floor(pts.length * 0.35), Math.floor(pts.length * 0.7)]) : new Set<number>();
  let injectedCount = 0;

  const append = (i: number, trigger: LedgerRow["trigger"], note: string, active: number, frac: number, targetUsd: number, currentUsd: number,
    side: "buy" | "sell", sizeUsd: number, orderPrice: number): void => {
    const p = pts[i]!;
    orders++;
    const verdict = checkOrder({ side, sizeUsd, price: orderPrice }, { oraclePrice: p.pyth, oracleAgeSec: ages[i]! }, cfg.limits);
    let fill: LedgerRow["fill"] = null;
    if (verdict.ok) {
      const sign = side === "buy" ? 1 : -1;
      const impactBps = cfg.useImpact ? impactBpsFor({ quotes: solQuotes }, side, sizeUsd) : 0;
      const price = orderPrice * (1 + (sign * impactBps) / 1e4);
      const feeUsd = (cfg.feeBps / 1e4) * sizeUsd;
      // The fill is rounded BEFORE it touches the balances, so replaying the rounded numbers gives exactly the same cash.
      fill = { price: round(price), qtySol: round(sizeUsd / price, 9), impactBps: round(impactBps, 4), feeUsd: round(feeUsd) };
      cash -= sign * fill.qtySol * fill.price + fill.feeUsd;
      pos += sign * fill.qtySol;
      fees += fill.feeUsd;
      impactCost += (impactBps / 1e4) * sizeUsd;
      filled++;
    } else {
      rejected++;
      rejectedByRule[verdict.rule!] = (rejectedByRule[verdict.rule!] ?? 0) + 1;
    }
    ledger.append({
      t: p.t, trigger, note, activeBets: active, targetFraction: round(frac, 4), targetUsd: round(targetUsd, 2), currentUsd: round(currentUsd, 2),
      order: { side, sizeUsd: round(sizeUsd, 2), price: round(orderPrice) }, oraclePrice: p.pyth, oracleAgeSec: ages[i]!, verdict, fill,
      cashUsd: round(cash), posSol: round(pos, 9), equityUsd: round(cash + pos * p.pyth, 4),
    });
  };

  let lastKey = "";
  pts.forEach((p, i) => {
    // 1. open a bet if a signal fired on this tick
    const sig = sigByT.get(p.t);
    let trigger: LedgerRow["trigger"] | null = null;
    if (sig) {
      bets.push({ id: bets.length + 1, tOpen: p.t, tClose: p.t + cfg.horizonSec, side: sig.side, p: sig.p, m: sig.side * probToSize(sig.p) });
      trigger = "signal-open";
    }
    // 2. which bets are open now? (a bet that has just expired changes the set too)
    const act = activeAt(bets, p.t);
    maxConc = Math.max(maxConc, act.length);
    const key = act.map((b) => b.id).join(",");
    if (!trigger && key !== lastKey) trigger = "signal-expire";
    lastKey = key;
    const ms = act.map((b) => b.m);
    exposure.push({ t: p.t, active: act.length, average: round(combineBets(ms, "average"), 4), sum: round(combineBets(ms, "sum"), 4) });

    // 3. the set of open bets changed: work out the target and trade the difference
    if (trigger) {
      const equityNow = cash + pos * p.pyth;
      const frac = discretize(combineBets(ms, cfg.combine), cfg.sizing.step);
      const targetUsd = targetUsdOf(frac, equityNow, cfg.sizing);
      const currentUsd = pos * p.pyth;
      const delta = targetUsd - currentUsd;
      if (Math.abs(delta) < cfg.sizing.minOrderUsd) tooSmall++;
      else {
        const side = delta > 0 ? "buy" : "sell";
        const cap = capOrderByImpact(Math.abs(delta), side, solQuotes, cfg.sizing.maxImpactBps);
        if (cap.capped) capped++;
        append(i, trigger, cap.capped ? `${act.length} open; cut to ${round(cap.sizeUsd, 0)} USD by the impact cap` : `${act.length} open; target ${frac >= 0 ? "+" : ""}${frac.toFixed(1)} of the cap`,
          act.length, frac, targetUsd, currentUsd, side, cap.sizeUsd, p.orca);
      }
    }
    // 4. two deliberate bad orders: show the risk hook saying no, and why
    if (injectAt.has(i)) {
      injectedCount++;
      const bad = injectedCount === 1;
      append(i, "injected", bad ? "INJECTED test: oversized order (5000 USD)" : "INJECTED test: price typed in cents (wrong unit)", act.length, 0, 0, pos * p.pyth,
        "buy", bad ? 5000 : 100, bad ? p.orca : p.orca * 100);
    }
    const eq = cash + pos * p.pyth;
    maxExp = Math.max(maxExp, Math.abs(pos * p.pyth));
    equity.push({ t: p.t, equityUsd: round(eq, 4), cashUsd: round(cash), posSol: round(pos, 9), exposureUsd: round(pos * p.pyth, 2), mark: p.pyth });
  });

  let peak = -Infinity, mdd = 0;
  for (const e of equity) {
    peak = Math.max(peak, e.equityUsd);
    mdd = Math.max(mdd, (peak - e.equityUsd) / peak);
  }
  const finalEq = equity.at(-1)!.equityUsd;
  return {
    config: cfg, ledger, bets, equity, exposure,
    stats: {
      signals: signals.length, orders, filled, rejected, rejectedByRule, cappedByImpact: capped, tooSmall,
      feesUsd: round(fees, 4), impactCostUsd: round(impactCost, 4), finalEquityUsd: finalEq,
      returnPct: round(((finalEq - cfg.sizing.startUsd) / cfg.sizing.startUsd) * 100, 4), maxDrawdownPct: round(mdd * 100, 4), maxConcurrent: maxConc, maxAbsExposureUsd: round(maxExp, 2),
    },
  };
}
