// Two ways to cut a stream of swaps into bars (candles).
//   time bars   : a bar closes when the CLOCK says so (every `sec` seconds). Quiet minutes give thin bars, busy minutes give fat bars.
//   dollar bars : a bar closes when `thresholdUsd` has TRADED. Quiet periods give few bars, busy periods give many.
// A bar is open/high/low/close of the swap prices plus the dollars traded (volumeUsd = USDC moved) and the swap count.
import type { Bar, Swap } from "./types.ts";

function startBar(s: Swap, tStart: number): Bar {
  return { tStart, tEnd: s.t, open: s.price, high: s.price, low: s.price, close: s.price, volumeUsd: s.usdcAmount, count: 1 };
}

function addToBar(b: Bar, s: Swap): void {
  b.high = Math.max(b.high, s.price);
  b.low = Math.min(b.low, s.price);
  b.close = s.price;
  b.volumeUsd += s.usdcAmount;
  b.count += 1;
  b.tEnd = s.t;
}

/**
 * Time bars: bar k covers [k*sec, (k+1)*sec). tStart is the clock start, tEnd the clock end (tStart + sec).
 * Seconds with no swaps produce NO bar (they are counted by countEmptyTimeBars). Swaps must be oldest first.
 */
export function timeBars(swaps: Swap[], sec: number): Bar[] {
  if (!(sec > 0)) throw new Error("time bar length must be > 0 seconds");
  const bars: Bar[] = [];
  let cur: Bar | null = null;
  for (const s of swaps) {
    const start = Math.floor(s.t / sec) * sec;
    if (cur && cur.tStart === start) addToBar(cur, s);
    else {
      if (cur) cur.tEnd = cur.tStart + sec;
      cur = startBar(s, start);
      bars.push(cur);
    }
  }
  if (cur) cur.tEnd = cur.tStart + sec;
  return bars;
}

/** How many whole time slots between the first and last bar had no swaps at all. */
export function countEmptyTimeBars(bars: Bar[], sec: number): number {
  if (bars.length < 2) return 0;
  const slots = (bars.at(-1)!.tStart - bars[0]!.tStart) / sec + 1;
  return Math.round(slots) - bars.length;
}

/**
 * Dollar bars: keep adding swaps to the open bar; as soon as its volumeUsd reaches `thresholdUsd` it closes
 * (the swap that crosses the line stays in this bar, so a bar can be a bit bigger than the threshold).
 * tStart is the time of the bar's first swap, tEnd the time of its last. The final bar may be unfinished
 * (below the threshold); it is kept so that the volume of all bars adds up to the volume of all swaps.
 */
export function dollarBars(swaps: Swap[], thresholdUsd: number): Bar[] {
  if (!(thresholdUsd > 0)) throw new Error("dollar threshold must be > 0");
  const bars: Bar[] = [];
  let cur: Bar | null = null;
  for (const s of swaps) {
    if (!cur) {
      cur = startBar(s, s.t);
      bars.push(cur);
    } else addToBar(cur, s);
    if (cur.volumeUsd >= thresholdUsd) cur = null;
  }
  return bars;
}

/** True when the last dollar bar closed below the threshold (the data simply ended). */
export function lastBarIsPartial(bars: Bar[], thresholdUsd: number): boolean {
  return bars.length > 0 && bars.at(-1)!.volumeUsd < thresholdUsd;
}

export function totalVolumeUsd(swaps: Swap[]): number {
  return swaps.reduce((a, s) => a + s.usdcAmount, 0);
}

/** Seconds each dollar bar took to fill (last swap time minus first swap time; 0 when one second holds the whole bar). */
export function barDurations(bars: Bar[]): number[] {
  return bars.map((b) => b.tEnd - b.tStart);
}
