// Oracle/venue basis: the pool price drifts away from the oracle price, then comes back.
// Uses: Orca pool price vs Pyth oracle. Enter when the pool is rich/cheap versus Pyth,
// leave when the gap closes (or after maxHold samples). Two legs per trade.
import type { Costs, LedgerTrade, Series, StrategyResult } from "../types.ts";
import { summarize, toLedger, type RoundTrip } from "./sim.ts";

export const META = { id: "basis", name: "Pool vs oracle basis", family: "Oracle/venue basis", dataNeeds: ["venue", "oracle"] };

export function basisTrades(series: Series, entryBps = 4, exitBps = 1, maxHold = 24): LedgerTrade[] {
  const pts = series.points;
  const trades: RoundTrip[] = [];
  let open: { i: number; side: 1 | -1; entry: number; t: number } | null = null;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const gap = ((p.orca - p.pyth) / p.pyth) * 10_000;
    if (open === null) {
      if (gap > entryBps) open = { i, side: -1, entry: p.orca, t: p.t }; // pool rich: sell it
      else if (gap < -entryBps) open = { i, side: 1, entry: p.orca, t: p.t }; // pool cheap: buy it
    } else if (Math.abs(gap) <= exitBps || i - open.i >= maxHold) {
      trades.push({ side: open.side, entry: open.entry, exit: p.orca, openT: open.t, closeT: p.t });
      open = null;
    }
  }
  return toLedger(META.id, trades, 2);
}

export function basis(series: Series, costs: Costs, entryBps = 4, exitBps = 1, maxHold = 24): StrategyResult {
  return summarize(META, basisTrades(series, entryBps, exitBps, maxHold).map((t) => t.grossUsd), 2, costs);
}
