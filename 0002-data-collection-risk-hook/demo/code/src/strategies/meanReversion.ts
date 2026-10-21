// Mean reversion: a price far from its recent average tends to snap back (when it does not, you lose).
// Uses: venue price only (Jupiter). z-score over the last `window` samples; enter beyond +/-entryZ,
// exit when z is back near zero or after maxHold samples. Two legs per trade.
import type { Costs, Series, StrategyResult } from "../types.ts";
import { grossUsd, mean, std, summarize, type RoundTrip } from "./sim.ts";

export const META = { id: "mean-reversion", name: "Mean reversion (z-score)", family: "Mean reversion / stat arb", dataNeeds: ["venue"] };

export function meanReversion(series: Series, costs: Costs, window = 60, entryZ = 2, maxHold = 36): StrategyResult {
  const px = series.points.map((p) => p.jupiter);
  const trades: RoundTrip[] = [];
  let open: { i: number; side: 1 | -1; entry: number } | null = null;
  for (let i = window; i < px.length; i++) {
    const w = px.slice(i - window, i);
    const sd = std(w);
    if (sd === 0) continue;
    const z = (px[i]! - mean(w)) / sd;
    if (open === null) {
      if (z > entryZ) open = { i, side: -1, entry: px[i]! }; // above average: sell
      else if (z < -entryZ) open = { i, side: 1, entry: px[i]! }; // below average: buy
    } else if (Math.abs(z) < 0.5 || i - open.i >= maxHold) {
      trades.push({ side: open.side, entry: open.entry, exit: px[i]! });
      open = null;
    }
  }
  return summarize(META, trades.map((t) => grossUsd(t)), 2, costs);
}
