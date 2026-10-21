// Overlapping bets: count how many are open at once and how much of each bet is "its own".
// Inspired by the overlapping-outcomes chapter of Advances in Financial Machine Learning.
import type { Bet } from "./types.ts";

/** Bets open at time t: tOpen <= t < tClose. */
export const activeAt = (bets: Bet[], t: number): Bet[] => bets.filter((b) => b.tOpen <= t && t < b.tClose);

/** Number of open bets at every tick time. */
export function concurrentCounts(bets: Bet[], times: number[]): number[] {
  return times.map((t) => activeAt(bets, t).length);
}

/**
 * Average uniqueness of each bet: over the ticks where it is open, the mean of 1 / (bets open at that tick).
 * A bet that never overlaps with another scores 1.0; two bets that overlap fully score 0.5 each.
 */
export function averageUniqueness(bets: Bet[], times: number[]): Map<number, number> {
  const counts = concurrentCounts(bets, times);
  const out = new Map<number, number>();
  for (const b of bets) {
    let sum = 0, n = 0;
    times.forEach((t, i) => {
      if (b.tOpen <= t && t < b.tClose && counts[i]! > 0) {
        sum += 1 / counts[i]!;
        n++;
      }
    });
    out.set(b.id, n ? sum / n : 1);
  }
  return out;
}
