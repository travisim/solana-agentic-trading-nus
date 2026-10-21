// Turn recorded data into the price path that gets labelled: one price per step.
//   pyth / jupiter / orca : the 5-second samples of build night 1 (481 points, 40 minutes). The "other" price is a second
//                           venue (Orca for Pyth, Pyth for the others); the agent uses the gap between the two.
//   swaps                 : real Orca swaps of build night 2 turned into dollar bars; one step = one bar close. No second venue.
import { dollarBars } from "./bars.ts";
import { filterSwaps } from "./clean.ts";
import type { PathPoint, Series, Source, Swap } from "./types.ts";

export interface PathResult {
  source: Source;
  points: PathPoint[];
  stepSec: number | null; // seconds per step (null for dollar bars, where steps are uneven)
  note: string;
}

export function pathFromSeries(series: Series, source: Exclude<Source, "swaps">): PathResult {
  const other: Record<typeof source, "orca" | "pyth"> = { pyth: "orca", jupiter: "pyth", orca: "pyth" };
  const points = series.points.map((p) => ({ t: p.t, price: p[source], other: p[other[source]] }));
  return {
    source,
    points,
    stepSec: series.intervalSec,
    note: `${source} price every ${series.intervalSec} s; second venue for the gap check: ${other[source]}`,
  };
}

export function pathFromSwaps(swaps: Swap[], thresholdUsd: number): PathResult & { kept: number; dropped: { duplicates: number; dust: number; outliers: number } } {
  const cleaned = filterSwaps(swaps);
  const bars = dollarBars(cleaned.kept, thresholdUsd);
  // the last bar may be unfinished (below the threshold); leave it out, a label needs a closed bar
  const closed = bars.filter((b) => b.volumeUsd >= thresholdUsd);
  return {
    source: "swaps",
    points: closed.map((b) => ({ t: b.tEnd, price: b.close, other: null })),
    stepSec: null,
    note: `Orca SOL/USDC dollar bars of $${thresholdUsd.toLocaleString("en-US")}; one step = one bar close`,
    kept: cleaned.kept.length,
    dropped: { duplicates: cleaned.duplicates, dust: cleaned.dust, outliers: cleaned.outliers },
  };
}
