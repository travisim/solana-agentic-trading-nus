// Backtest overfitting: try many strategies, keep the best in-sample, and see what happens on data it never saw.
// Split by TIME with a purge: in-sample = trades that closed before the cut; out-of-sample = trades that opened after the cut plus a gap.
import { luckBenchmark, mean, round, sd, sharpeLike } from "./stats.ts";
import { randomStrategies, type Candidate } from "./factory.ts";
import type { Costs, Series, TradeDetail } from "./vendor/0002/types.ts";

export interface Trial {
  id: string;
  label: string;
  family: string;
  isTrades: number;
  oosTrades: number;
  isScore: number | null; // Sharpe-like, in-sample
  oosScore: number | null; // Sharpe-like, out-of-sample
  isNetUsd: number;
  oosNetUsd: number;
}

export interface Split { cut: number; gap: number } // in-sample: closed before cut; out-of-sample: opened at or after cut + gap

export function splitDetail(detail: TradeDetail[], sp: Split): { is: TradeDetail[]; oos: TradeDetail[]; purged: number } {
  const is = detail.filter((d) => d.i1 < sp.cut);
  const oos = detail.filter((d) => d.i0 >= sp.cut + sp.gap);
  return { is, oos, purged: detail.length - is.length - oos.length };
}

export function evaluate(cands: Candidate[], series: Series, costs: Costs, sp: Split): Trial[] {
  return cands.map((c) => {
    const r = c.run(series, costs);
    const { is, oos } = splitDetail(r.detail ?? [], sp);
    const isNets = is.map((d) => d.netUsd), oosNets = oos.map((d) => d.netUsd);
    return {
      id: c.id, label: c.label, family: c.family,
      isTrades: is.length, oosTrades: oos.length,
      isScore: sharpeLike(isNets), oosScore: sharpeLike(oosNets),
      isNetUsd: round(isNets.reduce((a, b) => a + b, 0), 2), oosNetUsd: round(oosNets.reduce((a, b) => a + b, 0), 2),
    };
  });
}

/** Best in-sample score among the first n trials, the luck benchmark for n tries, and the deflated gap. */
export function bestOfFirst(trials: Trial[], n: number) {
  const first = trials.slice(0, n);
  const ranked = first.filter((t) => t.isScore !== null);
  const scores = ranked.map((t) => t.isScore as number);
  if (!ranked.length) return { n, best: null as Trial | null, bestScore: null as number | null, benchmark: 0, deflated: null as number | null, scoredCount: 0 };
  let best = ranked[0]!;
  for (const t of ranked) if ((t.isScore as number) > (best.isScore as number)) best = t;
  const bench = luckBenchmark(n, scores.length > 1 ? sd(scores) ** 2 : 0);
  return { n, best, bestScore: best.isScore as number, benchmark: round(bench, 4), deflated: round((best.isScore as number) - bench, 4), scoredCount: scores.length };
}

export interface SeedRun {
  seed: number;
  trials: Trial[];
  best: Trial | null; // best in-sample among all
  oosRankOfBest: number | null; // 1 = best out-of-sample too
  oosScoredCount: number;
  benchmark: number;
  deflated: number | null;
}

export function runSeed(seed: number, count: number, series: Series, costs: Costs, sp: Split): SeedRun {
  const trials = evaluate(randomStrategies(count, seed), series, costs, sp);
  const b = bestOfFirst(trials, count);
  const oosRanked = trials.filter((t) => t.oosScore !== null).sort((a, c) => (c.oosScore as number) - (a.oosScore as number));
  const idx = b.best ? oosRanked.findIndex((t) => t.id === b.best!.id) : -1;
  return { seed, trials, best: b.best, oosRankOfBest: idx >= 0 ? idx + 1 : null, oosScoredCount: oosRanked.length, benchmark: b.benchmark, deflated: b.deflated };
}

export function summarizeSeeds(runs: SeedRun[]) {
  const withBest = runs.filter((r) => r.best);
  const bestIs = withBest.map((r) => r.best!.isScore as number);
  const bestOos = withBest.filter((r) => r.best!.oosScore !== null).map((r) => r.best!.oosScore as number);
  return {
    seeds: runs.length,
    meanBestInSampleScore: round(mean(bestIs), 3),
    meanBestOutOfSampleScore: round(mean(bestOos), 3),
    bestBeatsLuckBenchmark: withBest.filter((r) => (r.deflated ?? -1) > 0).length,
    bestStillPositiveOutOfSample: withBest.filter((r) => (r.best!.oosNetUsd ?? 0) > 0).length,
    bestOutOfSampleScoreBelowInSample: withBest.filter((r) => r.best!.oosScore !== null && (r.best!.oosScore as number) < (r.best!.isScore as number)).length,
    medianOosRankOfBest: (() => {
      const ranks = withBest.map((r) => r.oosRankOfBest).filter((x): x is number => x !== null).sort((a, b) => a - b);
      return ranks.length ? ranks[Math.floor(ranks.length / 2)]! : null;
    })(),
  };
}
