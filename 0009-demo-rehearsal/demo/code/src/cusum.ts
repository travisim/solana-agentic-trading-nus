// CUSUM change filter: a "bucket" for price moves.
//   every tick, add the price change (in basis points, 1 bp = 0.01%) to two running totals:
//     sPos collects UP moves (it never goes below 0), sNeg collects DOWN moves (it never goes above 0).
//   when a total crosses the threshold, fire ONE event ("up" or "down") and empty both buckets.
// Small wiggles that cancel out never fire. An agent that wakes only on events makes far fewer calls than one that wakes every tick.

export interface PricePoint { t: number; price: number }
export interface CusumPoint { t: number; price: number; sPos: number; sNeg: number }
export interface CusumEvent { t: number; direction: "up" | "down"; price: number }
export interface CusumResult {
  thresholdBps: number;
  series: CusumPoint[];
  events: CusumEvent[];
  stats: { ticks: number; events: number; agentCallsEveryTick: number; agentCallsOnEvents: number };
}

export function cusum(prices: PricePoint[], thresholdBps: number): CusumResult {
  if (!(thresholdBps > 0)) throw new Error("CUSUM threshold must be > 0 bps");
  const series: CusumPoint[] = [];
  const events: CusumEvent[] = [];
  let sPos = 0;
  let sNeg = 0;
  prices.forEach((p, i) => {
    if (i > 0) {
      const changeBps = (p.price / prices[i - 1]!.price - 1) * 10_000;
      sPos = Math.max(0, sPos + changeBps);
      sNeg = Math.min(0, sNeg + changeBps);
    }
    let fired: CusumEvent | null = null;
    if (sPos > thresholdBps) fired = { t: p.t, direction: "up", price: p.price };
    else if (sNeg < -thresholdBps) fired = { t: p.t, direction: "down", price: p.price };
    // the point records the buckets as they were when the check happened (so a chart can show them full), then empties them
    series.push({ t: p.t, price: p.price, sPos: round(sPos, 3), sNeg: round(sNeg, 3) });
    if (fired) {
      events.push(fired);
      sPos = 0;
      sNeg = 0;
    }
  });
  return {
    thresholdBps,
    series,
    events,
    stats: { ticks: prices.length, events: events.length, agentCallsEveryTick: prices.length, agentCallsOnEvents: events.length },
  };
}

/** One price per `tickSec` seconds (the last swap price in that window), oldest first. Windows with no swaps give no tick. */
export function toTicks(swaps: { t: number; price: number }[], tickSec: number): PricePoint[] {
  const out: PricePoint[] = [];
  for (const s of swaps) {
    const w = Math.floor(s.t / tickSec) * tickSec;
    const last = out.at(-1);
    if (last && last.t === w) last.price = s.price;
    else out.push({ t: w, price: s.price });
  }
  return out;
}

function round(x: number, d: number): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}
