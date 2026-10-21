// Trend / momentum: follow the direction of a moving-average crossover.
// Uses: venue price only (Jupiter). Long when the fast average is above the slow one, short when below.
// Each flip closes one trade and opens the next. Two legs per trade.
import type { Costs, Series, StrategyResult } from "../types.ts";
import { grossUsd, mean, summarize, type RoundTrip } from "./sim.ts";

export const META = { id: "trend", name: "Moving-average trend", family: "Trend / momentum", dataNeeds: ["venue"] };

export function trend(series: Series, costs: Costs, fast = 12, slow = 60): StrategyResult {
  const px = series.points.map((p) => p.jupiter);
  const trades: RoundTrip[] = [];
  let pos: { side: 1 | -1; entry: number } | null = null;
  for (let i = slow; i < px.length; i++) {
    const f = mean(px.slice(i - fast + 1, i + 1));
    const s = mean(px.slice(i - slow + 1, i + 1));
    const side: 1 | -1 = f > s ? 1 : -1;
    if (pos === null) pos = { side, entry: px[i]! };
    else if (side !== pos.side) {
      trades.push({ ...pos, exit: px[i]! });
      pos = { side, entry: px[i]! };
    }
  }
  return summarize(META, trades.map((t) => grossUsd(t)), 2, costs);
}
