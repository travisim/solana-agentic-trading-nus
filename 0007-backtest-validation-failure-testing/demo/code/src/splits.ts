// Train/test splits that do not leak. The sample is a series of moments i = 0..n-1; the label of moment i looks
// `h` steps ahead (did the price rise over the next h samples?), so its label "lives" from i to i + h.
// Two labels leak into each other whenever those lives overlap. A purge removes such training moments; an embargo
// removes a few more after each test block (because the market stays correlated after the test ends).

/** A fold needs at least this many training moments to be scored at all. */
export const MIN_TRAIN = 30;

export type FoldMode = "shuffled" | "contiguous";

export interface Fold {
  fold: number;
  test: number[]; // moment indexes in the test set
  train: number[]; // moment indexes kept for training (after purge and embargo)
  purged: number; // training moments dropped because their label overlaps a test label
  embargoed: number; // training moments dropped by the embargo
  leaking: number; // training moments whose label overlaps a test label (what a purge would remove)
}

/** Deterministic fold assignment. "contiguous": folds are consecutive blocks. "shuffled": random assignment (the planted bug). */
export function assignFolds(moments: number[], k: number, mode: FoldMode, seed = 12345): number[] {
  if (mode === "contiguous") return moments.map((_, j) => Math.min(k - 1, Math.floor((j * k) / moments.length)));
  let a = seed >>> 0; // same mulberry32 as stats.rng, inlined so the demo can mirror it without imports
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return moments.map(() => Math.min(k - 1, Math.floor(next() * k)));
}

/**
 * Purged (and embargoed) k-fold. purge = true removes every training moment j whose label life [j, j+h]
 * touches the life [i, i+h] of any test moment i, i.e. |j - i| <= h. embargo = e removes e more moments after each test life.
 */
export function purgedKFold(n: number, opts: { k: number; h: number; mode: FoldMode; purge: boolean; embargo: number; first?: number; seed?: number }): Fold[] {
  const first = opts.first ?? 24; // moments need 24 samples of history for their features
  const moments: number[] = [];
  for (let i = first; i + opts.h < n; i++) moments.push(i);
  const fold = assignFolds(moments, opts.k, opts.mode, opts.seed);
  const out: Fold[] = [];
  for (let f = 0; f < opts.k; f++) {
    const test = moments.filter((_, j) => fold[j] === f);
    if (!test.length) continue;
    const leakMark = new Uint8Array(n + 1); // overlaps a test label
    const embMark = new Uint8Array(n + 1);
    for (const i of test) {
      for (let j = Math.max(0, i - opts.h); j <= Math.min(n - 1, i + opts.h); j++) leakMark[j] = 1;
      if (opts.embargo > 0) for (let j = i + opts.h + 1; j <= Math.min(n - 1, i + opts.h + opts.embargo); j++) embMark[j] = 1;
    }
    const isTest = new Uint8Array(n + 1);
    for (const i of test) isTest[i] = 1;
    const train: number[] = [];
    let purged = 0, embargoed = 0, leaking = 0;
    for (const j of moments) {
      if (isTest[j]) continue;
      if (leakMark[j]) leaking++;
      if (opts.purge && leakMark[j]) purged++;
      else if (embMark[j]) embargoed++;
      else train.push(j);
    }
    out.push({ fold: f, test, train, purged, embargoed, leaking });
  }
  return out;
}

export interface LeakResult {
  accuracy: number | null; // BALANCED accuracy: average of the hit rate on rising moments and on falling moments, so always guessing one side scores 50%. null when no fold has enough training moments left (MIN_TRAIN)
  rawAccuracy: number | null; // share of test moments guessed right (this window drifts up, so always guessing "up" already scores about 60%) // share of test moments whose direction was guessed right
  baseline: number | null; // raw accuracy of always guessing the majority direction of the training moments
  testCount: number; // test moments in the folds that were scored
  scoredFolds: number;
  trainKept: number; // average training moments per fold
  purged: number; // average per fold
  embargoed: number; // average per fold
  leaking: number; // average per fold
}

/**
 * The deliberately leaky "sample strategy" is a 1-nearest-neighbour memoriser: to guess where the price goes after moment i,
 * find the training moment with the most similar recent returns (last 6 and last 24 samples) and copy its label.
 * It has no idea about markets; it just remembers. With overlapping labels, the neighbours it remembers are the answers.
 */
export function leakAccuracy(px: number[], opts: { k: number; h: number; mode: FoldMode; purge: boolean; embargo: number; seed?: number }): LeakResult {
  const n = px.length;
  const feats = (i: number): [number, number] => [px[i]! / px[i - 6]! - 1, px[i]! / px[i - 24]! - 1];
  const label = (i: number): number => (px[i + opts.h]! > px[i]! ? 1 : 0);
  const folds = purgedKFold(n, opts);
  let right = 0, total = 0, baseRight = 0, scoredFolds = 0;
  const hit = [0, 0], seen = [0, 0]; // per true class: hits and moments
  let trainKept = 0, purged = 0, embargoed = 0, leaking = 0;
  for (const f of folds) {
    trainKept += f.train.length; purged += f.purged; embargoed += f.embargoed; leaking += f.leaking;
    if (f.train.length < MIN_TRAIN) continue; // not enough left to learn from: this fold is not scored
    scoredFolds++;
    const F = f.train.map(feats);
    const m = [0, 1].map((d) => F.reduce((a, v) => a + v[d]!, 0) / F.length);
    const s = [0, 1].map((d) => Math.sqrt(F.reduce((a, v) => a + (v[d]! - m[d]!) ** 2, 0) / F.length) || 1);
    const z = (v: [number, number]) => [(v[0] - m[0]!) / s[0]!, (v[1] - m[1]!) / s[1]!] as const;
    const Z = F.map(z);
    const Y = f.train.map(label);
    const majority = Y.reduce((a, y) => a + y, 0) * 2 >= Y.length ? 1 : 0;
    for (const i of f.test) {
      const q = z(feats(i));
      let best = Infinity, guess = 0;
      for (let k = 0; k < Z.length; k++) {
        const d = (Z[k]![0] - q[0]) ** 2 + (Z[k]![1] - q[1]) ** 2;
        if (d < best) { best = d; guess = Y[k]!; }
      }
      const y = label(i);
      seen[y]!++;
      if (guess === y) { right++; hit[y]!++; }
      if (majority === y) baseRight++;
      total++;
    }
  }
  const nf = Math.max(1, folds.length);
  return {
    accuracy: total && seen[0]! > 0 && seen[1]! > 0 ? (hit[0]! / seen[0]! + hit[1]! / seen[1]!) / 2 : null,
    rawAccuracy: total ? right / total : null,
    baseline: total ? baseRight / total : null,
    testCount: total,
    scoredFolds,
    trainKept: trainKept / nf, purged: purged / nf, embargoed: embargoed / nf, leaking: leaking / nf,
  };
}
