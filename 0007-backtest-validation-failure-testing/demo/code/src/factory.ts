// Random-strategy factory: draw many strategies from the four families the earlier sessions used, with random settings.
// Three families are the vendored build-night-1 strategies (trend, mean reversion, basis) run with random parameters.
// The fourth, "coin flip", opens trades at random in a random direction: it has NO skill by construction, so any profit it makes is luck.
import { rng } from "./stats.ts";
import type { Costs, Series, StrategyResult } from "./vendor/0002/types.ts";
import { grossUsd, summarize, type RoundTrip } from "./vendor/0002/strategies/sim.ts";
import { trend } from "./vendor/0002/strategies/trend.ts";
import { meanReversion } from "./vendor/0002/strategies/meanReversion.ts";
import { basis } from "./vendor/0002/strategies/basis.ts";

export interface Candidate {
  id: string;
  family: "trend" | "mean-reversion" | "basis" | "coin-flip";
  params: Record<string, number>;
  label: string;
  run: (series: Series, costs: Costs) => StrategyResult;
}

export function coinFlip(series: Series, costs: Costs, seed: number, entryProb: number, hold: number): StrategyResult {
  const rand = rng(seed);
  const px = series.points.map((p) => p.jupiter);
  const trades: RoundTrip[] = [];
  let i = 1;
  while (i + hold < px.length) {
    if (rand() < entryProb) {
      const side: 1 | -1 = rand() < 0.5 ? 1 : -1;
      trades.push({ side, entry: px[i]!, exit: px[i + hold]!, i0: i, i1: i + hold });
      i += hold + 1;
    } else i++;
  }
  const meta = { id: "coin-flip", name: "Coin flip (no skill)", family: "Random entries", dataNeeds: ["venue"] };
  return summarize(meta, trades.map((t) => grossUsd(t)), 2, costs, true, trades.map((t) => [t.i0!, t.i1!]));
}

const pick = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/** Draw `count` random strategies. Same seed, same list. */
export function randomStrategies(count: number, seed: number): Candidate[] {
  const r = rng(seed);
  const out: Candidate[] = [];
  for (let k = 0; k < count; k++) {
    const id = `s${String(k + 1).padStart(2, "0")}`;
    const fam = Math.floor(r() * 4);
    if (fam === 0) {
      const fast = pick(r, 2, 10), slow = pick(r, fast + 8, 50);
      out.push({ id, family: "trend", params: { fast, slow }, label: `trend ${fast}/${slow}`, run: (s, c) => trend(s, c, fast, slow) });
    } else if (fam === 1) {
      const window = pick(r, 12, 60), entryZ = pick(r, 8, 20) / 10, maxHold = pick(r, 6, 40);
      out.push({ id, family: "mean-reversion", params: { window, entryZ, maxHold }, label: `mean-rev w${window} z${entryZ} hold${maxHold}`, run: (s, c) => meanReversion(s, c, window, entryZ, maxHold) });
    } else if (fam === 2) {
      const entryBps = pick(r, 1, 5), exitBps = pick(r, 0, 2), maxHold = pick(r, 6, 36);
      out.push({ id, family: "basis", params: { entryBps, exitBps, maxHold }, label: `basis in${entryBps} out${exitBps} hold${maxHold}`, run: (s, c) => basis(s, c, entryBps, exitBps, maxHold) });
    } else {
      const cseed = pick(r, 1, 1_000_000), entryProb = pick(r, 5, 15) / 100, hold = pick(r, 4, 24);
      out.push({ id, family: "coin-flip", params: { seed: cseed, entryProbPct: entryProb * 100, hold }, label: `coin-flip #${cseed} hold${hold}`, run: (s, c) => coinFlip(s, c, cseed, entryProb, hold) });
    }
  }
  return out;
}
