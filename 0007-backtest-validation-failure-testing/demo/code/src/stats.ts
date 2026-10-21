// Small statistics helpers. No dependencies. Everything here is mirrored in lab/shared/calc.js and checked by lab/verify.mjs.

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Sample standard deviation (n - 1). */
export const sd = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
export const round = (x: number, d = 4): number => Math.round(x * 10 ** d) / 10 ** d;

/** Small seeded random number generator (mulberry32): same seed, same numbers, on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse of the standard normal CDF (Acklam's rational approximation, error below 1.2e-9). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let q: number, r: number;
  if (p < lo) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > 1 - lo) return -normInv(1 - p);
  q = p - 0.5;
  r = q * q;
  return ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

export const MIN_TRADES = 4;

/** Sharpe-like score: mean net P&L per trade divided by its standard deviation. null when there are too few trades to say anything. */
export function sharpeLike(tradeNets: number[], minTrades = MIN_TRADES): number | null {
  if (tradeNets.length < minTrades) return null;
  const s = sd(tradeNets);
  if (s === 0) return null;
  return mean(tradeNets) / s;
}

const EULER_GAMMA = 0.5772156649015329;

/**
 * Score you would expect from the BEST of N strategies that all have zero true skill:
 * sqrt(variance of the scores) * ((1 - g) * z(1 - 1/N) + g * z(1 - 1/(N e))), g = Euler-Mascheroni constant.
 * (The expected-maximum formula behind the "deflated Sharpe ratio" idea. N = 1 gives 0.)
 */
export function luckBenchmark(nTrials: number, scoreVariance: number): number {
  if (nTrials < 2 || scoreVariance <= 0) return 0;
  return Math.sqrt(scoreVariance) * ((1 - EULER_GAMMA) * normInv(1 - 1 / nTrials) + EULER_GAMMA * normInv(1 - 1 / (nTrials * Math.E)));
}
