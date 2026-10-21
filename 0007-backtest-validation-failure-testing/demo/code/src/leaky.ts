// The planted leak. A trend strategy written two ways: `trendSignal(px, i, { leak: true })` has an off-by-one in its
// moving-average windows, so the decision at moment i quietly uses the price at i + 1. `leak: false` is the fix.
// A causality test finds it: the signal at moment i must not change when the future is cut off.
// The default settings (2 and 10 samples) are the ones the demo shows.
import { mean } from "./stats.ts";
import type { Costs, Series, StrategyResult } from "./vendor/0002/types.ts";
import { grossUsd, summarize, type RoundTrip } from "./vendor/0002/strategies/sim.ts";

export interface TrendOpts { fast?: number; slow?: number; leak?: boolean }

/** +1 long, -1 short, 0 not enough history. Decision made at moment i from prices px[0..i] (the leaky version also peeks at px[i + 1]). */
export function trendSignal(px: number[], i: number, o: TrendOpts = {}): 1 | -1 | 0 {
  const fast = o.fast ?? 2, slow = o.slow ?? 10;
  const shift = o.leak ? 1 : 0; // <-- the planted bug: windows end one step too late
  if (i - slow + 1 < 0) return 0;
  const end = i + 1 + shift; // slice end is exclusive
  const f = mean(px.slice(end - fast, end));
  const s = mean(px.slice(end - slow, end));
  return f > s ? 1 : -1;
}

export function runTrend(series: Series, costs: Costs, o: TrendOpts = {}): StrategyResult {
  const px = series.points.map((p) => p.jupiter);
  const trades: RoundTrip[] = [];
  let pos: { side: 1 | -1; entry: number; i0: number } | null = null;
  for (let i = 0; i < px.length; i++) {
    const side = trendSignal(px, i, o);
    if (side === 0) continue;
    if (pos === null) pos = { side, entry: px[i]!, i0: i };
    else if (side !== pos.side) {
      trades.push({ side: pos.side, entry: pos.entry, exit: px[i]!, i0: pos.i0, i1: i });
      pos = { side, entry: px[i]!, i0: i };
    }
  }
  const meta = { id: o.leak ? "leaky-trend" : "fixed-trend", name: o.leak ? "Trend with a leak" : "Trend, leak fixed", family: "Trend / momentum", dataNeeds: ["venue"] };
  return summarize(meta, trades.map((t) => grossUsd(t)), 2, costs, true, trades.map((t) => [t.i0!, t.i1!]));
}

export interface CausalityReport { checked: number; leaking: number; firstLeakAt: number | null; ok: boolean; flagged: number[] }

/**
 * Causality test for any signal function: for sampled moments, recompute the signal on a series cut off right after
 * that moment. If the answer changes, the signal used the future. Generic: works for your own strategy too.
 */
export function causalityTest(px: number[], signal: (px: number[], i: number) => number, step = 1): CausalityReport {
  let checked = 0, leaking = 0, first: number | null = null;
  const flagged: number[] = [];
  for (let i = 40; i < px.length - 1; i += step) {
    checked++;
    if (signal(px, i) !== signal(px.slice(0, i + 1), i)) { leaking++; flagged.push(i); if (first === null) first = i; }
  }
  return { checked, leaking, firstLeakAt: first, ok: leaking === 0, flagged };
}
