// Triple-barrier labels. Every decision point gets three exits, and the first one the price touches is the label:
//   upper barrier  : price rises by `width` bps       -> label +1
//   lower barrier  : price falls by `width` bps       -> label -1
//   vertical barrier: `horizon` steps pass untouched  -> label 0 (time ran out)
// The width follows recent volatility: width = max(minWidthBps, mult * vol * sqrt(horizon)),
// where vol is the exponentially weighted standard deviation of one-step returns, in basis points (1 bp = 0.01%).
// Inspired by the triple-barrier method in Advances in Financial Machine Learning, Ch.3. Plain code, no libraries.

export interface LabelParams {
  mult: number; // barrier width in units of "noise over the horizon"
  horizon: number; // vertical barrier, in steps
  volSpan: number; // steps for the volatility estimate (also the warm-up before the first decision)
  every: number; // decide every N steps
  minWidthBps: number; // floor so a flat stretch cannot make the barrier zero
}

export const DEFAULT_PARAMS: LabelParams = { mult: 0.8, horizon: 24, volSpan: 20, every: 2, minWidthBps: 2 };

export interface Label {
  i: number; // index of the decision step
  t: number;
  price: number;
  volBps: number;
  widthBps: number;
  up: number; // upper barrier price
  dn: number; // lower barrier price
  exitI: number; // step where the label was decided
  touch: "up" | "down" | "time";
  label: 1 | -1 | 0;
  retBps: number; // return from decision to exit, in bps
  fixed: 1 | -1 | 0; // what a plain "sign of the return after `horizon` steps" label would say
}

/** One-step simple returns in bps, then an exponentially weighted standard deviation. vol[0] is null (no return yet). */
export function ewmVolBps(prices: number[], span: number): (number | null)[] {
  if (!(span >= 1)) throw new Error("volSpan must be at least 1");
  const a = 2 / (span + 1);
  let v: number | null = null;
  return prices.map((p, i) => {
    if (i === 0) return null;
    const r = (p / prices[i - 1]! - 1) * 10_000;
    v = v === null ? r * r : (1 - a) * v + a * r * r;
    return Math.sqrt(v);
  });
}

export function barrierWidthBps(volBps: number, p: LabelParams): number {
  return Math.max(p.minWidthBps, p.mult * volBps * Math.sqrt(p.horizon));
}

const sign = (x: number): 1 | -1 | 0 => (x > 0 ? 1 : x < 0 ? -1 : 0);

/** Label one decision at step i, or null if the horizon runs past the end of the data (its label is not known yet). */
export function labelAt(prices: number[], times: number[], vol: (number | null)[], i: number, p: LabelParams): Label | null {
  const v = vol[i];
  if (v === null || v === undefined) return null;
  const last = i + p.horizon;
  if (last > prices.length - 1) return null;
  const price = prices[i]!;
  const widthBps = barrierWidthBps(v, p);
  const up = price * (1 + widthBps / 10_000);
  const dn = price * (1 - widthBps / 10_000);
  let exitI = last;
  let touch: Label["touch"] = "time";
  for (let k = i + 1; k <= last; k++) {
    const x = prices[k]!;
    if (x >= up) { exitI = k; touch = "up"; break; }
    if (x <= dn) { exitI = k; touch = "down"; break; }
  }
  const retBps = (prices[exitI]! / price - 1) * 10_000;
  return {
    i, t: times[i]!, price, volBps: v, widthBps, up, dn, exitI, touch,
    label: touch === "up" ? 1 : touch === "down" ? -1 : 0,
    retBps,
    fixed: sign(prices[last]! / price - 1),
  };
}

/** Label every `every`-th step after the warm-up. Returns the labels and how many decision points were dropped at the end. */
export function tripleBarrier(prices: number[], times: number[], p: LabelParams): { vol: (number | null)[]; labels: Label[]; dropped: number } {
  if (!(p.horizon >= 1) || !(p.every >= 1) || !(p.mult > 0)) throw new Error("horizon and every must be >= 1 and mult > 0");
  const vol = ewmVolBps(prices, p.volSpan);
  const labels: Label[] = [];
  let dropped = 0;
  for (let i = p.volSpan; i < prices.length - 1; i += p.every) {
    const l = labelAt(prices, times, vol, i, p);
    if (l) labels.push(l);
    else dropped++;
  }
  return { vol, labels, dropped };
}
