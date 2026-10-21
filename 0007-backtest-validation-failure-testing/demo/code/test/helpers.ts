import { readFileSync } from "node:fs";
import type { Series } from "../src/vendor/0002/types.ts";

export const recorded = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../recorded/${file}`, import.meta.url), "utf8")) as T;
export const realSeries = (): Series => recorded<Series>("series.json");

/** A constructed series for tests: jupiter = the given prices, pyth and orca equal to it. */
export function seriesOf(prices: number[], t0 = 1_000_000): Series {
  return { pair: "SOL/USDC", intervalSec: 5, points: prices.map((p, i) => ({ t: t0 + i * 5, jupiter: p, pyth: p, orca: p })) };
}
