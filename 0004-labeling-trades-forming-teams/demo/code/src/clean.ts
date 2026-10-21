// Clean the recorded Orca swaps before use (same rules as build night 2, 0003 src/swaps.ts filterSwaps).
//  0. duplicates: the same transaction signature twice is kept once;
//  1. dust: swaps under 1 USDC are dropped (price = USDC / SOL is mostly rounding noise there);
//  2. outliers: a swap more than 1% away from the median of the 21 swaps around it is dropped
//     (a transaction that did more than one thing, so the vault change is not one clean swap).
// Input must be oldest first. Nothing is repaired or invented; swaps are only kept or dropped.
import type { Swap } from "./types.ts";

export const MIN_SWAP_USD = 1;
export const MAX_OUTLIER_PCT = 1;

export function filterSwaps(swaps: Swap[]): { kept: Swap[]; dust: number; outliers: number; duplicates: number } {
  const seen = new Set<string>();
  const unique = swaps.filter((s) => (seen.has(s.sig) ? false : (seen.add(s.sig), true)));
  const big = unique.filter((s) => s.usdcAmount >= MIN_SWAP_USD);
  const kept: Swap[] = [];
  big.forEach((s, i) => {
    const win = big.slice(Math.max(0, i - 10), i + 11).map((x) => x.price).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)]!;
    if (Math.abs(s.price / med - 1) * 100 <= MAX_OUTLIER_PCT) kept.push(s);
  });
  return { kept, dust: unique.length - big.length, outliers: big.length - kept.length, duplicates: swaps.length - unique.length };
}
