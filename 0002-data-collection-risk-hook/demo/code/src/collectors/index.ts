import type { Prices, VenueQuote } from "../types.ts";
import { jupiterQuote } from "./jupiter.ts";
import { pythOnChain } from "./pyth.ts";
import { orcaPool } from "./orca.ts";

export function gapBps(a: number, b: number): number {
  return Math.round(((a - b) / b) * 10_000 * 10) / 10;
}

export function buildPrices(venues: VenueQuote[], mode: Prices["mode"], generatedAt: string): Prices {
  const get = (id: string) => venues.find((v) => v.id === id)!.price;
  return {
    generatedAt,
    mode,
    pair: "SOL/USDC",
    venues,
    gapBps: {
      jupiterVsPyth: gapBps(get("jupiter"), get("pyth")),
      orcaVsPyth: gapBps(get("orca"), get("pyth")),
      jupiterVsOrca: gapBps(get("jupiter"), get("orca")),
    },
  };
}

/** Collect all three venues once, in parallel. */
export async function collectAll(): Promise<Prices> {
  const venues = await Promise.all([jupiterQuote(), pythOnChain(), orcaPool()]);
  return buildPrices(venues, "live", new Date().toISOString());
}
