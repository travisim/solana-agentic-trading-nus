// Meta-labeling: a second check ("the gate") decides whether to act on the first agent's idea.
// The first agent says buy or sell. The gate looks at features of that moment and estimates the chance the trade wins
// (its triple-barrier label agrees with the side). If the chance is below a threshold, the trade is blocked.
// The gate is a tiny logistic regression written out in full here: no libraries, repeatable.
// Inspired by meta-labeling in Advances in Financial Machine Learning, Ch.3.6-3.7. Whether it helps depends on the data: read the numbers.
import type { Decision } from "./agent.ts";
import type { Label } from "./labels.ts";

export const FEATURES = ["signal strength (move / noise)", "venue gap (bps)", "volatility (bps per step)"] as const;

export interface Model { mean: number[]; std: number[]; w: number[]; b: number }

export interface Row {
  i: number;
  side: 1 | -1;
  win: 0 | 1; // 1 only if the label agrees with the side (timeout counts as not a win)
  x: number[]; // raw features
  p: number; // gate's estimated chance of a win
  set: "train" | "test" | "purged";
}

export function featuresOf(d: Decision, l: Label): number[] {
  return [Math.abs(d.z), d.gapBps ?? 0, l.volBps];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function predict(m: Model, x: number[]): number {
  let z = m.b;
  for (let k = 0; k < x.length; k++) z += (m.w[k] as number) * (((x[k] as number) - (m.mean[k] as number)) / (m.std[k] as number));
  return sigmoid(z);
}

/** Fit by plain gradient descent on standardised features (fixed 2,000 steps, learning rate 0.1, small L2). Repeatable. */
export function fit(X: number[][], y: number[]): Model {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const mean = new Array<number>(d).fill(0);
  const std = new Array<number>(d).fill(1);
  for (let k = 0; k < d; k++) {
    mean[k] = X.reduce((a, r) => a + (r[k] as number), 0) / Math.max(1, n);
    const v = X.reduce((a, r) => a + ((r[k] as number) - (mean[k] as number)) ** 2, 0) / Math.max(1, n);
    std[k] = v > 1e-12 ? Math.sqrt(v) : 1;
  }
  const w = new Array<number>(d).fill(0);
  let b = 0;
  const Z = X.map((r) => r.map((v, k) => (v - (mean[k] as number)) / (std[k] as number)));
  for (let it = 0; it < 2000; it++) {
    const gw = new Array<number>(d).fill(0);
    let gb = 0;
    for (let r = 0; r < n; r++) {
      let z = b;
      for (let k = 0; k < d; k++) z += (w[k] as number) * (Z[r]![k] as number);
      const e = sigmoid(z) - (y[r] as number);
      gb += e;
      for (let k = 0; k < d; k++) gw[k] = (gw[k] as number) + e * (Z[r]![k] as number);
    }
    for (let k = 0; k < d; k++) w[k] = (w[k] as number) - 0.1 * ((gw[k] as number) / Math.max(1, n) + 0.01 * (w[k] as number));
    b -= (0.1 * gb) / Math.max(1, n);
  }
  return { mean, std, w, b };
}

export interface Split {
  cutI: number; // first step of the test period
  trainRows: number[]; // indices into rows
  testRows: number[];
  purged: number; // training trades dropped because their label reached into the test period
}

export interface Tally { trades: number; wins: number; hitRatePct: number | null; ci95Pct: number | null }

export function tally(rows: Row[]): Tally {
  const wins = rows.reduce((a, r) => a + r.win, 0);
  const n = rows.length;
  const p = n ? wins / n : 0;
  return {
    trades: n, wins,
    hitRatePct: n ? round(100 * p, 1) : null,
    ci95Pct: n ? round(100 * 1.96 * Math.sqrt((p * (1 - p)) / n), 1) : null, // rough +/- for the hit rate; wide when n is small
  };
}

export function round(x: number, d: number): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}
