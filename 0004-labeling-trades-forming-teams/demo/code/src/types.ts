// Shared types. They mirror the JSON files in recorded/ and out/.

export type Side = "buy" | "sell"; // from the trader's view of SOL

/** One real Orca SOL/USDC swap (recorded in build night 2, 0003). */
export interface Swap {
  t: number; // block time, unix seconds
  slot: number;
  side: Side;
  solAmount: number;
  usdcAmount: number;
  price: number; // USDC per SOL (includes the pool fee)
  sig: string;
}

export interface Bar {
  tStart: number;
  tEnd: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
  count: number;
}

/** A venue price read, used by jupiter.ts (build night 1 collector, copied). */
export interface VenueQuote {
  id: "jupiter" | "pyth" | "orca";
  label: string;
  price: number; // USD per SOL
  ts?: number;
  source: string;
}

/** One 5-second sample of the three venues (recorded in build night 1, 0002). */
export interface SeriesPoint {
  t: number;
  jupiter: number;
  pyth: number;
  orca: number;
}

export interface Series {
  pair: "SOL/USDC";
  intervalSec: number;
  points: SeriesPoint[];
}

/** The price path that gets labelled: one price per step, plus the second-venue price for the gap feature (null when there is none). */
export interface PathPoint {
  t: number;
  price: number;
  other: number | null; // Orca pool price when the path is Pyth (gap = |other - price|); null for the swaps path
}

export type Source = "pyth" | "jupiter" | "orca" | "swaps";
