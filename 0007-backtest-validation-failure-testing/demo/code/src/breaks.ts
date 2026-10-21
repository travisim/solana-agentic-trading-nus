// Feed-health alarm: a structural-break test on the gap between the venue price and the oracle price.
// While the oracle is healthy, the gap wobbles around zero by a few bps. If the oracle freezes, the gap drifts away.
// A CUSUM on the standardised gap raises an alarm when the drift adds up. Inspired by the CUSUM family of structural-break tests.
import { mean, round, sd } from "./stats.ts";
import type { Series } from "./vendor/0002/types.ts";

export interface BreakInput { warmup: number; k: number; h: number } // k = slack in standard deviations, h = alarm level
export interface BreakResult {
  mean: number; sd: number; // gap statistics over the warm-up window
  s: { up: number; down: number }[]; // running sums per tick (0 during warm-up)
  alarmTick: number | null;
}

/** Gap in bps between the venue (Jupiter) price and the oracle the agent can see. After freezeAt the agent still sees the last oracle value. */
export function gapSeries(series: Series, freezeAt: number | null, extraMoveBpsPerMin = 0): number[] {
  const pts = series.points;
  return pts.map((p, i) => {
    const frozen = freezeAt !== null && i >= freezeAt;
    const oracle = frozen ? pts[Math.max(0, freezeAt! - 1)]!.pyth : p.pyth;
    const drift = frozen ? 1 + (extraMoveBpsPerMin * ((i - freezeAt! + 1) * 5 / 60)) / 10_000 : 1;
    return ((p.jupiter * drift) / oracle - 1) * 10_000;
  });
}

export function detectBreak(gap: number[], o: BreakInput): BreakResult {
  const base = gap.slice(0, o.warmup);
  const m = mean(base), s0 = Math.max(sd(base), 0.5); // floor: do not divide by a tiny wobble
  let up = 0, down = 0, alarm: number | null = null;
  const s = gap.map((g, i) => {
    if (i < o.warmup) return { up: 0, down: 0 };
    const z = (g - m) / s0;
    up = Math.max(0, up + z - o.k);
    down = Math.max(0, down - z - o.k);
    if (alarm === null && (up > o.h || down > o.h)) alarm = i;
    return { up: round(up, 3), down: round(down, 3) };
  });
  return { mean: round(m, 3), sd: round(s0, 3), s, alarmTick: alarm };
}
