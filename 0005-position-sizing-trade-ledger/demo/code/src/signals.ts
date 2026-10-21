// A deliberately simple signal so the sizing has something to size: short-term momentum.
// z = price change over the lookback / (typical 5 s move * sqrt(lookback)).  Confidence p is a stand-in
// for what your own model would output ("how likely is this call to be right"). It is NOT calibrated.
import type { Series, Signal } from "./types.ts";

export interface SignalParams {
  lookback: number; // samples (5 s each)
  volWindow: number; // samples used for the typical move
  minZ: number; // fire only when |z| is at least this
  cooldownSec: number; // at most one signal per cooldown
}
export const DEFAULT_SIGNAL: SignalParams = { lookback: 12, volWindow: 60, minZ: 1.0, cooldownSec: 30 };

/** Stand-in confidence: 0.5 at z = 0, rising toward 0.95 as |z| grows. */
export const confidenceOf = (absZ: number): number => 0.5 + 0.45 * (1 - Math.exp(-absZ / 2));

export function makeSignals(series: Series, sp: SignalParams = DEFAULT_SIGNAL): Signal[] {
  const px = series.points.map((p) => p.pyth);
  const out: Signal[] = [];
  let last = -Infinity;
  for (let i = Math.max(sp.lookback, 10); i < px.length; i++) {
    const t = series.points[i]!.t;
    const from = Math.max(1, i - sp.volWindow + 1);
    let ss = 0, n = 0;
    for (let j = from; j <= i; j++) {
      const r = Math.log(px[j]! / px[j - 1]!);
      ss += r * r;
      n++;
    }
    const sigma = Math.sqrt(ss / Math.max(1, n));
    if (!(sigma > 0)) continue;
    const move = Math.log(px[i]! / px[i - sp.lookback]!);
    const z = move / (sigma * Math.sqrt(sp.lookback));
    if (Math.abs(z) < sp.minZ || t - last < sp.cooldownSec) continue;
    last = t;
    out.push({ t, side: z > 0 ? 1 : -1, z: Math.round(z * 1000) / 1000, p: Math.round(confidenceOf(Math.abs(z)) * 10000) / 10000 });
  }
  return out;
}
