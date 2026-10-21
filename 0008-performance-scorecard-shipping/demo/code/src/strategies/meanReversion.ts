// Mean reversion: a price far from its recent average tends to snap back (when it does not, you lose).
// Uses: venue price only (Jupiter). z-score over the last `window` samples; enter beyond +/-entryZ,
// exit when z is back near zero or after maxHold samples. Two legs per trade.
import type { Costs, LedgerTrade, Series, StrategyResult } from "../types.ts";
import { mean, std, summarize, toLedger, type RoundTrip } from "./sim.ts";

export const META = { id: "mean-reversion", name: "Mean reversion (z-score)", family: "Mean reversion / stat arb", dataNeeds: ["venue"] };

export function meanReversionTrades(series: Series, window = 60, entryZ = 2, maxHold = 36): LedgerTrade[] {
  const px = series.points.map((p) => p.jupiter);
  const ts = series.points.map((p) => p.t);
  const trades: RoundTrip[] = [];
  let open: { i: number; side: 1 | -1; entry: number; t: number } | null = null;
  for (let i = window; i < px.length; i++) {
    const w = px.slice(i - window, i);
    const sd = std(w);
    if (sd === 0) continue;
    const z = (px[i]! - mean(w)) / sd;
    if (open === null) {
      if (z > entryZ) open = { i, side: -1, entry: px[i]!, t: ts[i]! }; // above average: sell
      else if (z < -entryZ) open = { i, side: 1, entry: px[i]!, t: ts[i]! }; // below average: buy
    } else if (Math.abs(z) < 0.5 || i - open.i >= maxHold) {
      trades.push({ side: open.side, entry: open.entry, exit: px[i]!, openT: open.t, closeT: ts[i]! });
      open = null;
    }
  }
  return toLedger(META.id, trades, 2);
}

export function meanReversion(series: Series, costs: Costs, window = 60, entryZ = 2, maxHold = 36): StrategyResult {
  return summarize(META, meanReversionTrades(series, window, entryZ, maxHold).map((t) => t.grossUsd), 2, costs);
}
