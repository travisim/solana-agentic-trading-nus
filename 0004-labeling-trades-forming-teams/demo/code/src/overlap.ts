// Overlapping labels and leakage.
// Two decisions 15 seconds apart with a 3-minute horizon both look at (almost) the same future prices, so their labels share
// information. Two things follow:
//   1. concurrency: how many labels are "alive" at each step; average uniqueness of a label = mean of 1/concurrency over its life.
//      The sum of uniqueness is the number of effectively independent labels (much smaller than the number of labels).
//   2. leakage: a label made before a train/test cut can still use prices AFTER the cut. Those labels must be purged from training.
// Inspired by sample uniqueness and purging in Advances in Financial Machine Learning, Ch.4 and Ch.7.
import type { Label } from "./labels.ts";

export interface Span { i: number; exitI: number }

/** concurrency[t] = number of labels whose life [i, exitI] includes step t. */
export function concurrency(spans: Span[], steps: number): number[] {
  const c = new Array<number>(steps).fill(0);
  for (const s of spans) for (let t = s.i; t <= s.exitI && t < steps; t++) c[t]!++;
  return c;
}

/** Average uniqueness of each label: mean over its life of 1 / concurrency. Between 1/(max overlap) and 1. */
export function uniqueness(spans: Span[], conc: number[]): number[] {
  return spans.map((s) => {
    let sum = 0;
    let n = 0;
    for (let t = s.i; t <= s.exitI && t < conc.length; t++) { sum += 1 / conc[t]!; n++; }
    return n ? sum / n : 1;
  });
}

/** Labels made before the cut (i < cut) whose life reaches the cut or later: they leak test-period prices into training. */
export function leaking(spans: Span[], cut: number): number {
  return spans.filter((s) => s.i < cut && s.exitI >= cut).length;
}

export interface OverlapStats {
  labels: number;
  meanConcurrency: number;
  maxConcurrency: number;
  meanUniqueness: number;
  effectiveN: number; // sum of uniqueness
}

export function overlapStats(labels: Label[], steps: number): { stats: OverlapStats; conc: number[]; uniq: number[] } {
  const conc = concurrency(labels, steps);
  const uniq = uniqueness(labels, conc);
  const covered = conc.filter((c) => c > 0);
  const sum = uniq.reduce((a, b) => a + b, 0);
  return {
    conc, uniq,
    stats: {
      labels: labels.length,
      meanConcurrency: round(covered.reduce((a, b) => a + b, 0) / Math.max(1, covered.length), 3),
      maxConcurrency: Math.max(0, ...conc),
      meanUniqueness: round(sum / Math.max(1, labels.length), 4),
      effectiveN: round(sum, 3),
    },
  };
}

function round(x: number, d: number): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}
