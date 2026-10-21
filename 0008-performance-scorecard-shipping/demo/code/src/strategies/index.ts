import type { Costs, LedgerTrade, Series, StrategyResult } from "../types.ts";
import { crossVenueArb, crossVenueArbTrades } from "./crossVenueArb.ts";
import { basis, basisTrades } from "./basis.ts";
import { trend, trendTrades } from "./trend.ts";
import { meanReversion, meanReversionTrades } from "./meanReversion.ts";
import { marketMaker, marketMakerTrades } from "./marketMaker.ts";

export function runAll(series: Series, costs: Costs): StrategyResult[] {
  return [crossVenueArb, basis, trend, meanReversion, marketMaker].map((s) => s(series, costs));
}

/** Every closed trade from the five sample strategies, merged into one ledger sorted by close time. */
export function allTrades(series: Series): LedgerTrade[] {
  const all = [
    ...crossVenueArbTrades(series),
    ...basisTrades(series),
    ...trendTrades(series),
    ...meanReversionTrades(series),
    ...marketMakerTrades(series),
  ];
  all.sort((a, b) => a.closeT - b.closeT || a.openT - b.openT || a.strategy.localeCompare(b.strategy));
  return all.map((t, i) => ({ ...t, id: i + 1 }));
}
