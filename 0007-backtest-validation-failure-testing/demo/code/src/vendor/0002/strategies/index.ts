import type { Costs, Series, StrategyResult } from "../types.ts";
import { crossVenueArb } from "./crossVenueArb.ts";
import { basis } from "./basis.ts";
import { trend } from "./trend.ts";
import { meanReversion } from "./meanReversion.ts";
import { marketMaker } from "./marketMaker.ts";

export function runAll(series: Series, costs: Costs): StrategyResult[] {
  return [crossVenueArb, basis, trend, meanReversion, marketMaker].map((s) => s(series, costs));
}
