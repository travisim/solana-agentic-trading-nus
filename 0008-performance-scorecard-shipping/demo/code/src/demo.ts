// npm run demo -- --recorded     -> scorecard for the sample ledger, bundled recorded data, no network (default)
// npm run demo -- --live         -> same, plus one live Jupiter vs Orca gap read against your cost line
// Options: --fee-bps N  --slippage-bps N  --capital N  --out DIR  --ledger FILE (score your own ledger)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { collectAll } from "./collectors/index.ts";
import { RateLimitError } from "./rpc.ts";
import { allTrades, runAll } from "./strategies/index.ts";
import { byStrategy, validateLedger } from "./ledger.ts";
import { equityCurve, failureProbability, gridOf, onChainSummary, score, type Score } from "./scorecard.ts";
import { buildDashboards } from "./dashboards.ts";
import { dashboardHtml } from "./dashboardHtml.ts";
import { checkProject } from "./shipcheck.ts";
import { SAMPLE_PROJECTS } from "./shipSamples.ts";
import type { Ledger, Series } from "./types.ts";

const root = new URL("../", import.meta.url).pathname;
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const num = (name: string, dflt: number): number => {
  const v = flag(name);
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} needs a number >= 0, got "${v}"`);
  return n;
};
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

const feeBps = num("fee-bps", 5);
const slippageBps = num("slippage-bps", 2);
const capitalUsd = num("capital", 10_000);
const outDir = flag("out") ?? `${root}out/`;
const costs = { feeBps, slippageBps };

// ---- 1. the ledger: your own file, or the five sample strategies on recorded data ---------------
let ledger: Ledger;
let series: Series | null = null;
const ledgerFile = flag("ledger");
if (ledgerFile) {
  ledger = validateLedger(readJson(ledgerFile));
  console.log(`Your ledger: ${ledgerFile}  (${ledger.trades.length} trades)\n`);
} else {
  series = readJson<Series>(`${root}recorded/series.json`);
  ledger = {
    note: "Sample ledger: every closed trade of the five sample strategies, simulated on recorded SOL/USDC data. Not advice.",
    pair: "SOL/USDC",
    capitalUsd,
    windowStartT: series.points[0]!.t,
    windowEndT: series.points.at(-1)!.t,
    intervalSec: series.intervalSec,
    trades: allTrades(series),
  };
}
const times = gridOf(ledger);
const groups = byStrategy(ledger.trades);
const ids = Object.keys(groups);
const windowMin = (ledger.windowEndT - ledger.windowStartT) / 60;

// ---- 2. the scorecard ----------------------------------------------------------------------------
const overall = score(ledger.trades, costs, ledger.capitalUsd, times);
const per: Record<string, Score> = Object.fromEntries(ids.map((id) => [id, score(groups[id]!, costs, ledger.capitalUsd, times)]));

const p = (x: number | null, f: (v: number) => string) => (x === null ? "n/a" : f(x));
const usd = (x: number | null) => p(x, (v) => (v >= 0 ? "+" : "") + v.toFixed(2));
const pc = (x: number | null) => p(x, (v) => `${(v * 100).toFixed(0)}%`);
console.log(`Scorecard, simulated on recorded data; not advice. fee ${feeBps} bps + slippage ${slippageBps} bps per leg, capital ${ledger.capitalUsd} USD, window ${windowMin.toFixed(0)} min\n`);
console.log("Strategy".padEnd(24) + ["Trades", "Hit", "AvgWin", "AvgLoss", "Payoff", "NetUSD", "MaxDD", "Under%", "Turn x", "PFail"].map((h) => h.padStart(8)).join(""));
const row = (name: string, s: Score) =>
  name.padEnd(24) +
  [String(s.trades), pc(s.hitRate), usd(s.avgWinUsd), usd(s.avgLossUsd), p(s.payoffRatio, (v) => v.toFixed(2)), usd(s.netUsd), s.maxDrawdownUsd.toFixed(2), `${(s.timeUnderwaterShare * 100).toFixed(0)}%`, s.turnoverX.toFixed(1), pc(s.probFailure)]
    .map((c) => c.padStart(8)).join("");
for (const id of ids) console.log(row(id, per[id]!));
console.log("-".repeat(104));
console.log(row("ALL (one ledger)", overall));

console.log(`\nOne ledger, in words`);
console.log(`  ${overall.trades} trades; ${p(overall.hitRate, (v) => `${(v * 100).toFixed(1)}%`)} won after costs; the break-even hit rate for these payoffs is ${p(overall.breakEvenHitRate, (v) => `${(v * 100).toFixed(1)}%`)}.`);
console.log(`  Gross ${usd(overall.grossUsd)} USD, costs -${overall.costsUsd.toFixed(2)}, net ${usd(overall.netUsd)}.` + (overall.costShareOfGross !== null ? ` Costs ate ${(overall.costShareOfGross * 100).toFixed(0)}% of the gross profit.` : ""));
console.log(`  Max drawdown ${overall.maxDrawdownUsd.toFixed(2)} USD (${overall.maxDrawdownPct.toFixed(2)}%); under water ${(overall.timeUnderwaterShare * 100).toFixed(0)}% of the window, longest stretch ${Math.round(overall.longestUnderwaterSec / 60)} min.`);
console.log(`  Turnover ${overall.turnoverX.toFixed(1)}x capital in ${windowMin.toFixed(0)} minutes (${overall.tradedUsd.toFixed(0)} USD traded).`);
const chain = onChainSummary(ledger.trades);
console.log(chain ? `  On-chain: ${chain.transactions} transactions, ${(chain.failedRate * 100).toFixed(0)}% failed, base fees ${chain.baseFeeLamports} lamports, priority ${chain.priorityFeeLamports}, Jito tips ${chain.jitoTipLamports}.` : "  On-chain fees, tips and failed-transaction rate: n/a (this ledger has no real transactions; we do not guess them).");
console.log(`  What this cannot say: ${overall.enoughTrades ? "" : `only ${overall.trades} trades; `}${windowMin.toFixed(0)} minutes of one quiet night is one path, not a distribution. A good number here is a reason to test more, never a result.`);

// ---- 3. honest versus misleading dashboard (sample ledger only) -------------------------------------
const dash = buildDashboards(groups, costs, ledger.capitalUsd, times);
console.log(`\nSame ledger, two dashboards (strategy shown: ${dash.strategy})`);
console.log(`  misleading: ${dash.misleading.headline}; ${dash.misleading.annualisedGrossUsd >= 0 ? "+" : ""}${Math.round(dash.misleading.annualisedGrossUsd).toLocaleString("en-US")} USD "per year"`);
for (const t of dash.tricks) console.log(`  - ${t.name.padEnd(30)} shows ${t.shown}  | hides ${t.hidden}  | honest: ${t.honest}`);

// ---- 4. ship-readiness check on the three sample projects ---------------------------------------------
const ship = SAMPLE_PROJECTS.map((s) => ({ id: s.id, label: s.label, blurb: s.blurb, files: s.project.files, skippedDirs: s.project.skippedDirs, report: checkProject(s.project) }));
console.log(`\nShip check on the sample projects (run it on yours: npm run ship-check -- <folder>)`);
for (const s of ship) console.log(`  ${s.label.padEnd(16)} ${s.report.verdict.padEnd(14)} ${s.report.passed}/${s.report.applicable} checks pass, ${s.report.fails} fail, ${s.report.warns} warn`);

// ---- 5. optional live read ---------------------------------------------------------------------------------
if (process.argv.includes("--live")) {
  try {
    const live = await collectAll();
    const g = Math.abs(live.gapBps.jupiterVsOrca);
    const line = 2 * (feeBps + slippageBps);
    console.log(`\nLive: Jupiter vs Orca gap ${g.toFixed(1)} bps against a round-trip cost line of ${line} bps -> ${g >= line ? "above" : "below"} the line. One quote is not a trade.`);
  } catch (e) {
    console.log(`\n!! live read failed: ${e instanceof RateLimitError ? e.message : (e as Error).message}\n!! Recorded data is unaffected.`);
  }
}

// ---- 6. write out/*.json and out/dashboard.html (the files the lab demos read) ----------------------------------
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data, null, 1) + "\n");
const curves: Record<string, { equity: number[]; drawdown: number[] }> = {};
for (const [k, tr] of [["all", ledger.trades] as const, ...ids.map((id) => [id, groups[id]!] as const)]) {
  const { equity, drawdown } = equityCurve(tr, costs, ledger.capitalUsd, times);
  curves[k] = { equity, drawdown };
}
write("ledger.json", ledger);
write("scorecard.json", { note: "simulated on recorded data; not advice", feeBps, slippageBps, capitalUsd: ledger.capitalUsd, windowStartT: ledger.windowStartT, windowEndT: ledger.windowEndT, overall, byStrategy: per });
write("equity.json", { times, capitalUsd: ledger.capitalUsd, feeBps, slippageBps, curves });
if (!ledgerFile) {
  write("prices.json", { ...readJson<object>(`${root}recorded/snapshot.json`), mode: "recorded" });
  // What a given hit rate is worth at different trade counts (hit 45%, wins pay 1x losses: break-even 50%). Used on the "probability of failure" slide.
  write("failure-table.json", { hitRate: 0.45, payoffRatio: 1, breakEvenHitRate: 0.5, rows: [10, 30, 100, 200, 500].map((n) => ({ trades: n, probFailure: Math.round(failureProbability(0.45, 0.5, n) * 1e4) / 1e4 })) });
  // The same ledger at three cost settings: the "break one number on purpose" exercise, and the cost slides.
  write("cost-scenarios.json", { note: "same trades, three cost settings; simulated on recorded data; not advice", scenarios: [[0, 0], [5, 2], [12, 5]].map(([f, s]) => ({ feeBps: f, slippageBps: s, overall: score(ledger.trades, { feeBps: f!, slippageBps: s! }, ledger.capitalUsd, times) })) });
  write("dashboards.json", dash);
  write("shipcheck.json", { checks: ship[0]!.report.results.map(({ id, label, severity }) => ({ id, label, severity })), samples: ship });
  write("strategies.json", { feeBps, slippageBps, note: "simulated on recorded data; not advice", strategies: runAll(series!, costs) });
  write("solana-costs.json", readJson(`${root}recorded/solana-costs.json`));
}
writeFileSync(`${outDir}dashboard.html`, dashboardHtml(ledgerFile ? "My scorecard" : "Sample ledger scorecard", overall, { times, ...curves["all"]! }, ledger.capitalUsd, costs, ledger.note));
console.log(`\nWrote ledger, scorecard, equity${ledgerFile ? "" : ", prices, failure-table, cost-scenarios, dashboards, shipcheck, strategies, solana-costs"} (.json) and dashboard.html to ${outDir}`);
