// Honest versus misleading dashboard: the SAME ledger, two ways to show it.
// Every "trick" below is a real thing people do by accident. Each one is computed, not made up.
import { score, type CostSettings, type Score } from "./scorecard.ts";
import type { LedgerTrade } from "./types.ts";

export interface Trick {
  id: string;
  name: string;
  shown: string; // what the misleading dashboard prints
  hidden: string; // what it leaves out
  honest: string; // what the honest dashboard prints instead
}

export interface Dashboards {
  strategy: string; // the strategy both dashboards describe
  windowMinutes: number;
  trades: number;
  misleading: { headline: string; hitRate: number; grossUsd: number; annualisedGrossUsd: number; longestWinStreak: number; strategiesShown: number; strategiesRun: number };
  honest: Score;
  tricks: Trick[];
}

const usd = (x: number) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
const usdWhole = (x: number) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD`;

export function longestWinStreak(trades: LedgerTrade[]): number {
  let best = 0;
  let run = 0;
  for (const t of [...trades].sort((a, b) => a.closeT - b.closeT)) {
    run = t.grossUsd > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export function buildDashboards(
  byStrategy: Record<string, LedgerTrade[]>,
  c: CostSettings,
  capitalUsd: number,
  times: number[],
): Dashboards {
  const ids = Object.keys(byStrategy);
  const scores = Object.fromEntries(ids.map((id) => [id, score(byStrategy[id]!, c, capitalUsd, times)])) as Record<string, Score>;
  // The misleading dashboard picks the strategy with the best GROSS result and hides the other four.
  const pick = ids.reduce((a, b) => (scores[b]!.grossUsd > scores[a]!.grossUsd ? b : a));
  const trades = byStrategy[pick]!;
  const honest = scores[pick]!;
  const windowSec = (times[times.length - 1]! - times[0]!) || 1;
  const gross = honest.grossUsd;
  const grossWinners = trades.filter((t) => t.grossUsd > 0).length;
  const grossHit = trades.length ? grossWinners / trades.length : 0;
  const yearSec = 365 * 24 * 3600;
  const annual = gross * (yearSec / windowSec);
  const streak = longestWinStreak(trades);
  const othersNet = ids.filter((id) => id !== pick).reduce((a, id) => a + scores[id]!.netUsd, 0);
  const tricks: Trick[] = [
    { id: "gross", name: "Gross, not net", shown: `P&L ${usd(gross)}`, hidden: `costs ${usd(-honest.costsUsd)}`, honest: `net ${usd(honest.netUsd)}` },
    { id: "hit", name: "Hit rate on gross", shown: `${(grossHit * 100).toFixed(0)}% of trades won`, hidden: "a win that costs more than it earns is a loss", honest: `${((honest.hitRate ?? 0) * 100).toFixed(0)}% win after costs` },
    { id: "annual", name: "Annualised short window", shown: `${usdWhole(annual)} per year`, hidden: `only ${(windowSec / 60).toFixed(0)} minutes of data`, honest: `${honest.trades} trades in ${(windowSec / 60).toFixed(0)} minutes` },
    { id: "pick", name: "Show the best strategy only", shown: `${pick}`, hidden: `${ids.length - 1} other strateg${ids.length - 1 === 1 ? "y" : "ies"}, together ${usd(othersNet)} net`, honest: `all ${ids.length} reported` },
    { id: "risk", name: "No drawdown", shown: `win streak of ${streak}`, hidden: `drawdown and time under water`, honest: `max drawdown ${honest.maxDrawdownUsd.toFixed(2)} USD, ${Math.round(honest.timeUnderwaterShare * 100)}% of the window under water` },
  ];
  return {
    strategy: pick,
    windowMinutes: Math.round(windowSec / 60),
    trades: honest.trades,
    misleading: {
      headline: `${usd(gross)} gross, ${(grossHit * 100).toFixed(0)}% win rate`,
      hitRate: Math.round(grossHit * 1e4) / 1e4,
      grossUsd: gross,
      annualisedGrossUsd: Math.round(annual * 100) / 100,
      longestWinStreak: streak,
      strategiesShown: 1,
      strategiesRun: ids.length,
    },
    honest,
    tricks,
  };
}
