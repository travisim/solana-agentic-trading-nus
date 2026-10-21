// Bet sizing: turn a confidence into a size, combine overlapping bets, round to steps, apply caps.
// Inspired by the bet-sizing chapter of Advances in Financial Machine Learning (see docs, not slides).
import { impactBpsFor, maxSizeForImpact } from "./impact.ts";
import type { ImpactQuote, Side, SizingParams } from "./types.ts";

export const DEFAULT_SIZING: SizingParams = {
  startUsd: 10_000,
  maxFraction: 0.25, // never hold more than 25 % of equity in SOL, long or short
  step: 0.1, // sizes move in tenths of the cap, so the agent does not trade for tiny changes
  maxImpactBps: 5, // never send an order that would move the price more than 5 bps
  minOrderUsd: 25, // do not send orders smaller than this
};

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, error below 1.5e-7). */
export function normCdf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return 0.5 * (1 + s * y);
}

/**
 * Confidence p (probability the call is right) to a size m in [0, 1).
 * z = (p - 1/2) / sqrt(p (1 - p)),  m = 2 Phi(z) - 1.   p = 0.5 gives 0, p near 1 gives near 1.
 */
export function probToSize(p: number): number {
  if (!Number.isFinite(p) || p <= 0.5) return 0;
  if (p >= 1) return 1;
  const z = (p - 0.5) / Math.sqrt(p * (1 - p));
  return 2 * normCdf(z) - 1;
}
export const zOfP = (p: number): number => (p <= 0 || p >= 1 ? 0 : (p - 0.5) / Math.sqrt(p * (1 - p)));

/** Round a signed size in [-1, 1] to the nearest step (0.1 means tenths). Never rounds past the cap. */
export function discretize(m: number, step: number): number {
  if (!(step > 0)) throw new Error("step must be > 0");
  const r = Math.round(m / step) * step;
  return Math.max(-1, Math.min(1, Math.round(r * 1e9) / 1e9));
}

/**
 * Combine the signed sizes of all bets that are open right now.
 *   average: the mean of the active bets (overlapping bets share one position instead of stacking)
 *   sum: add them up, then clip to [-1, 1] (the naive way: three 0.5 bets become a full-size bet)
 */
export function combineBets(ms: number[], mode: "average" | "sum" = "average"): number {
  if (!ms.length) return 0;
  const total = ms.reduce((a, b) => a + b, 0);
  return mode === "average" ? total / ms.length : Math.max(-1, Math.min(1, total));
}

/** Target exposure in USD (signed) for a combined size, as a share of the cap. */
export const targetUsdOf = (m: number, equityUsd: number, p: Pick<SizingParams, "maxFraction">): number => m * p.maxFraction * Math.max(0, equityUsd);

/** Reduce an order so its price impact stays at or under maxBps. Returns the allowed size and whether it was cut. */
export function capOrderByImpact(sizeUsd: number, side: Side, quotes: ImpactQuote[], maxBps: number): { sizeUsd: number; capped: boolean; impactBps: number } {
  const allowed = maxSizeForImpact({ quotes }, side, maxBps);
  const size = Math.min(sizeUsd, allowed);
  return { sizeUsd: size, capped: size < sizeUsd, impactBps: impactBpsFor({ quotes }, side, size) };
}
