// Market making (simulated): quote a bid and an ask around the oracle price and earn the spread
// when other traders hit them. Uses: Pyth oracle for the quote centre, Orca pool price as "the market".
// A fill happens if the next pool price crosses our quote. We carry inventory (it can lose money!)
// and mark it to the final oracle price. One leg per fill. Resting orders pay fees but no slippage here.
import type { Costs, Series, StrategyResult } from "../types.ts";
import { NOTIONAL_USD, summarize } from "./sim.ts";

export const META = { id: "market-maker", name: "Market maker around Pyth", family: "Market making", dataNeeds: ["oracle", "venue", "inventory"] };

export function marketMaker(series: Series, costs: Costs, halfSpreadBps = 4, maxInventoryUsd = 5000, horizon = 12): StrategyResult {
  const pts = series.points;
  const fills: { side: 1 | -1; price: number; i: number }[] = [];
  let inventoryUsd = 0; // positive = long SOL
  for (let i = 0; i + 1 < pts.length; i++) {
    const bid = pts[i]!.pyth * (1 - halfSpreadBps / 10_000);
    const ask = pts[i]!.pyth * (1 + halfSpreadBps / 10_000);
    const next = pts[i + 1]!.orca;
    if (next <= bid && inventoryUsd < maxInventoryUsd) {
      fills.push({ side: 1, price: bid, i });
      inventoryUsd += NOTIONAL_USD;
    } else if (next >= ask && inventoryUsd > -maxInventoryUsd) {
      fills.push({ side: -1, price: ask, i });
      inventoryUsd -= NOTIONAL_USD;
    }
  }
  // "Gross" per fill = value of that fill against the oracle price `horizon` samples later.
  // (Marking each fill to a later oracle price keeps the accounting simple: no open inventory is left unvalued.)
  const grosses = fills.map((f) => {
    const later = pts[Math.min(f.i + 1 + horizon, pts.length - 1)]!.pyth;
    return (f.side * (later - f.price)) / f.price * NOTIONAL_USD;
  });
  return summarize(META, grosses, 1, { feeBps: costs.feeBps, slippageBps: 0 }, false);
}
