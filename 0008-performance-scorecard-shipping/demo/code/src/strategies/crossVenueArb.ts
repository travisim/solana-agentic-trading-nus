// Cross-venue arbitrage: buy where SOL is cheaper, sell where it is dearer, at the same moment.
// Uses: Jupiter quote vs Orca pool price. Two legs per trade (one buy, one sell).
// Idea: if the two prices differ by more than the costs, the gap is the profit.
import type { Costs, LedgerTrade, Series, StrategyResult } from "../types.ts";
import { summarize, toLedger, type RoundTrip } from "./sim.ts";

export const META = { id: "cross-venue-arb", name: "Cross-venue arbitrage", family: "Cross-venue arbitrage", dataNeeds: ["venue"] };

export function crossVenueArbTrades(series: Series, minGapBps = 8): LedgerTrade[] {
  const trips: RoundTrip[] = [];
  for (const p of series.points) {
    const gapBps = ((p.jupiter - p.orca) / p.orca) * 10_000;
    if (Math.abs(gapBps) < minGapBps) continue;
    // buy on the cheap venue, sell on the dear one: gain = the gap, as a fraction of the cheap price
    const cheap = Math.min(p.jupiter, p.orca);
    const dear = Math.max(p.jupiter, p.orca);
    trips.push({ side: 1, entry: cheap, exit: dear, openT: p.t, closeT: p.t });
  }
  return toLedger(META.id, trips, 2);
}

export function crossVenueArb(series: Series, costs: Costs, minGapBps = 8): StrategyResult {
  return summarize(META, crossVenueArbTrades(series, minGapBps).map((t) => t.grossUsd), 2, costs);
}
