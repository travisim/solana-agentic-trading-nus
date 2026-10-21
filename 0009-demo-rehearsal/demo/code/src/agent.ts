// The sample project for the walk-through: a tiny agent built only from earlier sessions' pieces.
//   swaps -> dollar bars (build night 2) -> CUSUM change alert (build night 2) -> the agent proposes one order per event
//   -> risk hook (build night 1) says yes or no with a reason -> accepted orders become ledger rows -> scorecard.
// The ledger and scorecard are small versions of the ideas from build night 3 and workshop 4. Everything is SIMULATED on
// recorded data: no order is sent anywhere. The scorecard is NOT what Demo Day judges look at.
import { dollarBars } from "./bars.ts";
import { filterSwaps } from "./clean.ts";
import { cusum } from "./cusum.ts";
import { DEFAULT_LIMITS, checkOrder } from "./risk.ts";
import type { Order, PythRead, RiskContext, RiskDecision, RiskLimits, Side, Swap } from "./types.ts";

export interface AgentParams {
  thresholdUsd: number; // dollar bar size
  cusumBps: number; // change alert threshold
  usdPerBps: number; // order size = bucket size in bps x this (a bigger move asks for a bigger order)
  feeBps: number; // fee charged on every fill (assumption, not measured)
  limits: RiskLimits;
}
export const DEFAULT_PARAMS: AgentParams = { thresholdUsd: 20_000, cusumBps: 8, usdPerBps: 100, feeBps: 4, limits: DEFAULT_LIMITS };

export interface Decision {
  n: number; // event number, 1-based
  t: number;
  direction: "up" | "down";
  bucketBps: number;
  order: Order;
  context: RiskContext;
  gapBps: number;
  decision: RiskDecision;
}

export interface LedgerRow {
  n: number;
  t: number;
  side: Side;
  sizeUsd: number;
  fillPrice: number;
  solQty: number;
  feeUsd: number;
  cashUsd: number; // cash after this row
  positionSol: number; // position after this row
  equityUsd: number; // cash + position marked at this fill price
}

export interface Scorecard {
  label: string;
  events: number;
  accepted: number;
  rejected: number;
  rejectedByRule: Record<string, number>;
  fills: number;
  skippedNoLaterSwap: number;
  pnlNetUsd: number;
  hitRate: number;
  maxDrawdownUsd: number;
  markPrice: number;
  positionSol: number;
}

export interface AgentRun {
  params: AgentParams;
  window: { fromT: number; toT: number; swaps: number; recordedSwaps: number; dropped: { duplicates: number; dust: number; outliers: number } };
  bars: number;
  events: number;
  decisions: Decision[];
  ledger: LedgerRow[];
  scorecard: Scorecard;
}

export const SIM_LABEL = "Simulated, on recorded data; not advice";

/** The swaps that fall inside the time span of the Pyth reads (the only span where we have both). */
export function overlapWindow(swaps: Swap[], reads: PythRead[]): Swap[] {
  const from = reads[0]!.t;
  const to = reads.at(-1)!.t;
  return swaps.filter((s) => s.t >= from && s.t <= to);
}

/** Latest oracle read taken at or before time t (reads are oldest first). */
export function oracleAt(reads: PythRead[], t: number): PythRead | null {
  let best: PythRead | null = null;
  for (const r of reads) {
    if (r.t <= t) best = r;
    else break;
  }
  return best;
}

export function runAgent(allSwaps: Swap[], reads: PythRead[], params: AgentParams = DEFAULT_PARAMS): AgentRun {
  const cleaned = filterSwaps(allSwaps);
  const swaps = overlapWindow(cleaned.kept, reads);
  if (swaps.length < 2) throw new Error("not enough swaps inside the oracle window");
  const bars = dollarBars(swaps, params.thresholdUsd);
  const closes = bars.map((b) => ({ t: b.tEnd, price: b.close }));
  const cs = cusum(closes, params.cusumBps);
  // A fired point is one where a bucket is past the threshold; the series records it before the buckets empty.
  const fired = cs.series.filter((p) => p.sPos > params.cusumBps || p.sNeg < -params.cusumBps);
  if (fired.length !== cs.events.length) throw new Error("internal check failed: fired points differ from events");

  const decisions: Decision[] = [];
  const ledger: LedgerRow[] = [];
  const skipped = { n: 0 };
  let cash = 0;
  let pos = 0;
  let peak = 0;
  let maxDd = 0;
  const fillMarks: { fill: number; side: Side; fee: number; size: number }[] = [];
  cs.events.forEach((ev, i) => {
    const p = fired[i]!;
    const bucketBps = ev.direction === "up" ? p.sPos : -p.sNeg;
    const read = oracleAt(reads, ev.t)!;
    const side: Side = ev.direction === "up" ? "buy" : "sell";
    const sizeUsd = Math.round(bucketBps * params.usdPerBps);
    const order: Order = { side, sizeUsd, price: ev.price };
    const oracleAgeSec = Math.max(0, ev.t - read.publishTime);
    const context: RiskContext = { oraclePrice: read.price, oracleAgeSec };
    const decision = checkOrder(order, context, params.limits);
    const gapBps = Math.round((Math.abs(order.price - context.oraclePrice) / context.oraclePrice) * 10_000 * 10) / 10;
    decisions.push({ n: i + 1, t: ev.t, direction: ev.direction, bucketBps: Math.round(bucketBps * 100) / 100, order, context, gapBps, decision });
    if (!decision.ok) return;
    const next = swaps.find((s) => s.t > ev.t);
    if (!next) { skipped.n++; return; }
    const qty = order.sizeUsd / next.price;
    const fee = (order.sizeUsd * params.feeBps) / 10_000;
    if (order.side === "buy") { cash -= order.sizeUsd + fee; pos += qty; } else { cash += order.sizeUsd - fee; pos -= qty; }
    const equity = cash + pos * next.price;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
    fillMarks.push({ fill: next.price, side: order.side, fee, size: order.sizeUsd });
    ledger.push({ n: i + 1, t: next.t, side: order.side, sizeUsd: order.sizeUsd, fillPrice: next.price, solQty: r6(qty), feeUsd: r2(fee), cashUsd: r2(cash), positionSol: r6(pos), equityUsd: r2(equity) });
  });

  const mark = swaps.at(-1)!.price;
  const byRule: Record<string, number> = {};
  for (const d of decisions) if (!d.decision.ok) byRule[d.decision.rule!] = (byRule[d.decision.rule!] ?? 0) + 1;
  const wins = fillMarks.filter((f) => ((mark - f.fill) * (f.side === "buy" ? 1 : -1)) / f.fill * f.size - f.fee > 0).length;
  const scorecard: Scorecard = {
    label: SIM_LABEL,
    events: decisions.length,
    accepted: decisions.filter((d) => d.decision.ok).length,
    rejected: decisions.filter((d) => !d.decision.ok).length,
    rejectedByRule: byRule,
    fills: ledger.length,
    skippedNoLaterSwap: skipped.n,
    pnlNetUsd: r2(cash + pos * mark),
    hitRate: fillMarks.length ? Math.round((wins / fillMarks.length) * 1000) / 1000 : 0,
    maxDrawdownUsd: r2(maxDd),
    markPrice: mark,
    positionSol: r6(pos),
  };
  return {
    params,
    window: { fromT: swaps[0]!.t, toT: swaps.at(-1)!.t, swaps: swaps.length, recordedSwaps: allSwaps.length, dropped: { duplicates: cleaned.duplicates, dust: cleaned.dust, outliers: cleaned.outliers } },
    bars: bars.length,
    events: cs.events.length,
    decisions,
    ledger,
    scorecard,
  };
}

/** The failure test for the pitch: deliberately bad orders the risk hook must refuse. Injected, and labelled as such. */
export function failureTests(ctx: RiskContext, limits: RiskLimits = DEFAULT_LIMITS) {
  const px = (m: number) => Math.round(ctx.oraclePrice * m * 100) / 100;
  const cases: { label: string; order: Order; oracleAgeSec?: number }[] = [
    { label: "oversized order", order: { side: "buy", sizeUsd: 5000, price: px(1) } },
    { label: "stale oracle (300 s old)", order: { side: "buy", sizeUsd: 250, price: px(1) }, oracleAgeSec: 300 },
    { label: "price in cents, not dollars", order: { side: "buy", sizeUsd: 250, price: px(100) } },
    { label: "100 bps above the oracle", order: { side: "buy", sizeUsd: 250, price: px(1.01) } },
  ];
  return cases.map((c) => {
    const context = { ...ctx, oracleAgeSec: c.oracleAgeSec ?? ctx.oracleAgeSec };
    return { label: c.label, injected: true, order: c.order, oracleAgeSec: context.oracleAgeSec, ...checkOrder(c.order, context, limits) };
  });
}

const r2 = (x: number) => Math.round(x * 100) / 100;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
