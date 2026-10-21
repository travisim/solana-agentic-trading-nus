// npm run demo            -> uses bundled recorded data (default, no network)
// npm run demo -- --live  -> presenter option: also reads one live Pyth price and runs the risk hook on it
// Options: --seeds N (20)  --trials N (50)  --fee-bps N (5)  --slippage-bps N (2)  --out DIR
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { detectBreak, gapSeries } from "./breaks.ts";
import { FAULT_KINDS, defaultFault, replayFault, retryCalls, ORDER_EVERY, ORDER_SIZE_USD, BAD_FILL_BPS, SLIPPAGE_BUDGET_BPS, BREAKER_MAX_BREACHES, BASE_FEE_BPS } from "./faults.ts";
import { causalityTest, runTrend, trendSignal } from "./leaky.ts";
import { randomStrategies } from "./factory.ts";
import { bestOfFirst, runSeed, splitDetail, summarizeSeeds, type Split } from "./overfit.ts";
import { leakAccuracy } from "./splits.ts";
import { DEFAULT_LIMITS, checkOrder } from "./vendor/0002/risk.ts";
import { runAll } from "./vendor/0002/strategies/index.ts";
import type { Costs, Prices, Series } from "./vendor/0002/types.ts";
import { RateLimitError } from "./rpc.ts";
import { readPyth } from "./pyth.ts";
import { round } from "./stats.ts";

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
const nSeeds = num("seeds", 20), nTrials = num("trials", 50);
const costs: Costs = { feeBps: num("fee-bps", 5), slippageBps: num("slippage-bps", 2) };
const outDir = flag("out") ?? `${root}out/`;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(`${root}recorded/${file}`, "utf8")) as T;

const series = readJson<Series>("series.json");
const snapshot = readJson<Prices>("snapshot.json");
const pyth = snapshot.venues.find((v) => v.id === "pyth")!;
const refTime = snapshot.venues.find((v) => v.id === "jupiter")!.ts ?? Math.floor(Date.parse(snapshot.generatedAt) / 1000);
const baseAgeSec = Math.max(0, refTime - (pyth.publishTime ?? refTime));
const pts = series.points;
const n = pts.length;
const px = pts.map((p) => p.jupiter);
const hhmm = (t: number) => new Date((t + 8 * 3600) * 1000).toISOString().slice(11, 16);
const mode = process.argv.includes("--live") ? "live-check" : "recorded";
console.log(`Backtest validation lab (${mode}). Recorded series: ${n} samples every ${series.intervalSec}s, ${hhmm(pts[0]!.t)} to ${hhmm(pts[n - 1]!.t)} SGT (Wed 21 Oct 2026 UTC evening). Simulated, on recorded data; not advice.`);

mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data) + "\n");
const meta = { pair: "SOL/USDC", capturedAt: snapshot.generatedAt, mode: "recorded", note: "Simulated, on recorded data; not advice" };

// ---- 0. the build-night-1 strategies, unchanged, as the starting point ---------------------------------
const base = runAll(series, costs);
console.log(`\n0. Vendored build-night-1 strategies (fee ${costs.feeBps} + slippage ${costs.slippageBps} bps per leg, 1000 USD per trade)`);
for (const r of base) console.log(`   ${r.name.padEnd(26)} trades ${String(r.trades).padStart(3)}  gross ${r.pnlGrossUsd.toFixed(2).padStart(7)}  net ${r.pnlNetUsd.toFixed(2).padStart(7)}`);

// ---- 1. split leakage -------------------------------------------------------------------------------
const K = 5;
const H_LIST = [6, 12, 24, 36, 48];
const EMB_MAX = 30;
const grid: Record<string, unknown>[] = [];
for (const mode of ["shuffled", "contiguous"] as const)
  for (const h of H_LIST)
    for (const purge of [false, true])
      for (let embargo = 0; embargo <= EMB_MAX; embargo++) {
        const r = leakAccuracy(px, { k: K, h, mode, purge, embargo });
        grid.push({ mode, h, purge, embargo, accuracy: r.accuracy === null ? null : round(r.accuracy, 4), rawAccuracy: r.rawAccuracy === null ? null : round(r.rawAccuracy, 4), baseline: r.baseline === null ? null : round(r.baseline, 4), testCount: r.testCount, scoredFolds: r.scoredFolds, trainKept: round(r.trainKept, 1), purged: round(r.purged, 1), embargoed: round(r.embargoed, 1), leaking: round(r.leaking, 1) });
      }
write("splits.json", { ...meta, folds: K, firstMoment: 24, hList: H_LIST, embargoMax: EMB_MAX, shuffleSeed: 12345, prices: px, t: pts.map((p) => p.t), grid });
const pc = (a: number | null) => (a === null ? "n/a" : (a * 100).toFixed(1) + "%");
const g = (mode: string, h: number, purge: boolean, embargo: number) => grid.find((x) => x.mode === mode && x.h === h && x.purge === purge && x.embargo === embargo) as { accuracy: number | null; baseline: number | null; trainKept: number };
console.log(`\n1. Split leakage: a memoriser guesses "does the price rise over the next h samples?" (${K} folds, ${leakAccuracy(px, { k: K, h: 24, mode: "shuffled", purge: false, embargo: 0 }).testCount} test moments; balanced accuracy, so a coin flip or always guessing one side is 50%)`);
console.log("   h    shuffled folds   contiguous folds   contiguous + purge + embargo 12   shuffled + purge (n/a = nothing left to train on)");
for (const h of H_LIST) console.log(`   ${String(h).padStart(2)}   ${pc(g("shuffled", h, false, 0).accuracy).padStart(10)}   ${pc(g("contiguous", h, false, 0).accuracy).padStart(13)}   ${pc(g("contiguous", h, true, 12).accuracy).padStart(22)}   ${pc(g("shuffled", h, true, 0).accuracy).padStart(14)}`);

// ---- 2. the planted leak and the causality test -----------------------------------------------------
const costsFree: Costs = { feeBps: 0, slippageBps: 0 };
const leakyRun = runTrend(series, costs, { leak: true }), fixedRun = runTrend(series, costs, { leak: false });
const leakyGross = runTrend(series, costsFree, { leak: true }), fixedGross = runTrend(series, costsFree, { leak: false });
const cLeaky = causalityTest(px, (p, i) => trendSignal(p, i, { leak: true }));
const cFixed = causalityTest(px, (p, i) => trendSignal(p, i, { leak: false }));
const cum = (r: typeof leakyRun) => { let c = 0; return (r.detail ?? []).map((d) => ({ i1: d.i1, cumUsd: round((c += d.netUsd), 2) })); };
write("leaky.json", {
  ...meta, costs, params: { fast: 2, slow: 10 },
  causality: { leaky: cLeaky, fixed: cFixed },
  results: { leaky: { ...leakyRun, equity: cum(leakyRun) }, fixed: { ...fixedRun, equity: cum(fixedRun) }, leakyBeforeCosts: { trades: leakyGross.trades, pnlNetUsd: leakyGross.pnlNetUsd, equity: cum(leakyGross) }, fixedBeforeCosts: { trades: fixedGross.trades, pnlNetUsd: fixedGross.pnlNetUsd, equity: cum(fixedGross) } },
  bug: "trendSignal: const shift = o.leak ? 1 : 0; windows end at i + 1 + shift, so the decision at moment i also sees the price at i + 1",
});
console.log(`\n2. Planted leak (src/leaky.ts): trend 2/10 written two ways`);
console.log(`   leaky : ${leakyGross.trades} trades, net ${leakyGross.pnlNetUsd.toFixed(2)} USD before costs, ${leakyRun.pnlNetUsd.toFixed(2)} after; causality test: ${cLeaky.leaking} of ${cLeaky.checked} moments change when the future is cut off (first at sample ${cLeaky.firstLeakAt})`);
console.log(`   fixed : ${fixedGross.trades} trades, net ${fixedGross.pnlNetUsd.toFixed(2)} USD before costs, ${fixedRun.pnlNetUsd.toFixed(2)} after; causality test: ${cFixed.leaking} of ${cFixed.checked} change`);

// ---- 3. many tries ----------------------------------------------------------------------------------
const split: Split = { cut: Math.floor(n * 0.6), gap: 12 };
const runsFree = Array.from({ length: nSeeds }, (_, s) => runSeed(s + 1, nTrials, series, costsFree, split));
const runsCost = Array.from({ length: nSeeds }, (_, s) => runSeed(s + 1, nTrials, series, costs, split));
// raw gross P&L per trade, in and out of sample, so the lab can recompute every score at any cost
const seedsOut = runsFree.map((run) => {
  const cands = randomStrategies(nTrials, run.seed);
  return {
    seed: run.seed,
    trials: cands.map((c) => {
      const r = c.run(series, costsFree);
      const { is, oos } = splitDetail(r.detail ?? [], split);
      return { id: c.id, family: c.family, label: c.label, legs: r.legsPerTrade, paysSlippage: r.paysSlippage, is: is.map((d) => d.grossUsd), oos: oos.map((d) => d.grossUsd) };
    }),
    beforeCosts: { bestId: run.best?.id ?? null, bestIsScore: run.best?.isScore ?? null, bestOosScore: run.best?.oosScore ?? null, benchmark: run.benchmark, deflated: run.deflated, oosRankOfBest: run.oosRankOfBest, oosScoredCount: run.oosScoredCount },
  };
});
const curve = Array.from({ length: nTrials }, (_, i) => {
  const b = bestOfFirst(runsFree[0]!.trials, i + 1);
  return { n: i + 1, best: b.best?.id ?? null, bestScore: b.bestScore === null ? null : round(b.bestScore, 4), benchmark: b.benchmark, deflated: b.deflated, bestOosScore: b.best?.oosScore === null || !b.best ? null : round(b.best.oosScore as number, 4) };
});
const sumFree = summarizeSeeds(runsFree), sumCost = summarizeSeeds(runsCost);
write("overfit.json", { ...meta, trials: nTrials, split, costsDefault: costsFree, costsRealistic: costs, minTrades: 4, seeds: seedsOut, curveSeed1: curve, summary: { beforeCosts: sumFree, withCosts: sumCost } });
const r1 = runsFree[0]!;
console.log(`\n3. Best of many tries (${nTrials} random strategies per draw, ${nSeeds} draws; in-sample = first ${split.cut} samples, out-of-sample = after a ${split.gap}-sample gap; score = mean/std of trade P&L)`);
console.log(`   draw 1: best in-sample is ${r1.best?.label} (score ${r1.best?.isScore?.toFixed(2)}, ${r1.best?.isTrades} trades) -> out-of-sample score ${r1.best?.oosScore === null ? "n/a (too few trades)" : r1.best?.oosScore?.toFixed(2)}; luck benchmark for ${nTrials} tries ${r1.benchmark.toFixed(2)}; deflated ${r1.deflated?.toFixed(2)}; out-of-sample rank ${r1.oosRankOfBest} of ${r1.oosScoredCount}`);
console.log(`   all ${nSeeds} draws before costs: mean best in-sample score ${sumFree.meanBestInSampleScore}, same strategy out-of-sample ${sumFree.meanBestOutOfSampleScore}; best beats its luck benchmark in ${sumFree.bestBeatsLuckBenchmark} draws; median out-of-sample rank of the in-sample winner ${sumFree.medianOosRankOfBest}`);
console.log(`   with ${costs.feeBps}+${costs.slippageBps} bps costs: mean best in-sample score ${sumCost.meanBestInSampleScore}, out-of-sample ${sumCost.meanBestOutOfSampleScore}; the winner is still positive after costs out-of-sample in ${sumCost.bestStillPositiveOutOfSample} of ${nSeeds} draws`);

// ---- 4. failure injection -----------------------------------------------------------------------------
const FAULT_NOTES: Record<string, string> = {
  "stale-oracle": "The oracle stops updating (frozen at its last value) while the market moves 80 bps. The agent quotes off the oracle.",
  "rpc-outage": "RPC returns HTTP 429 for 5 minutes. The agent keeps its last good prices while the market moves 80 bps.",
  "slippage-shock": "Every fill is 40 bps worse than expected for 5 minutes (thin pool, congestion).",
  "fee-change": "Fee per leg jumps from 5 to 30 bps for 5 minutes.",
  "duplicate-submission": "A timeout makes the agent send every order twice for 5 minutes.",
};
const scenarios = FAULT_KINDS.map((kind) => {
  const p = defaultFault(kind, n);
  const hookOnly = replayFault(series, p, baseAgeSec, { dedupe: false, breaker: false });
  const withFix = replayFault(series, p, baseAgeSec, { dedupe: true, breaker: true });
  return { kind, note: FAULT_NOTES[kind], params: p, hookOnly: hookOnly.inWindow, withFix: withFix.inWindow, records: hookOnly.records.filter((r) => r.inWindow) };
});
const defaultSlipCosts: Costs = { feeBps: costs.feeBps, slippageBps: 40 }, defaultFeeCosts: Costs = { feeBps: 30, slippageBps: costs.slippageBps };
const repriced = (c: Costs) => runAll(series, c).map((r) => ({ id: r.id, name: r.name, trades: r.trades, pnlGrossUsd: r.pnlGrossUsd, pnlNetUsd: r.pnlNetUsd }));
const strategies = {
  base: base.map((r) => ({ ...r, detail: undefined })),
  baseCosts: costs,
  slippageShock: { costs: defaultSlipCosts, results: repriced(defaultSlipCosts) },
  feeChange: { costs: defaultFeeCosts, results: repriced(defaultFeeCosts) },
  breakEvenCostBpsPerLeg: base.map((r) => ({ id: r.id, bps: r.trades ? round((r.pnlGrossUsd / (r.trades * r.legsPerTrade * r.notionalUsd)) * 10_000, 2) : null })),
};
write("faults.json", {
  ...meta, baseAgeSec, orderEveryTicks: ORDER_EVERY, orderSizeUsd: ORDER_SIZE_USD, baseFeeBps: BASE_FEE_BPS, badFillBps: BAD_FILL_BPS, slippageBudgetBps: SLIPPAGE_BUDGET_BPS, breakerMaxBreaches: BREAKER_MAX_BREACHES,
  limits: DEFAULT_LIMITS, series: pts.map((p) => ({ t: p.t, jupiter: p.jupiter, pyth: p.pyth })), scenarios, strategies, retry: { windowSec: 300, ...retryCalls(300) },
});
console.log(`\n4. Failure injection (fault starts at ${hhmm(pts[defaultFault("none", n).startTick]!.t)} SGT, lasts 5 minutes; one ${ORDER_SIZE_USD} USD order every ${ORDER_EVERY * series.intervalSec} s; risk hook limits ${DEFAULT_LIMITS.maxNotionalUsd} USD, ${DEFAULT_LIMITS.maxOracleGapBps} bps, ${DEFAULT_LIMITS.maxOracleAgeSec} s)`);
console.log("   fault                   orders accepted rejected  rule(s)                        loss with hook   loss with no hook   with extra guards");
for (const s of scenarios) {
  const rules = Object.entries(s.hookOnly.byRule).map(([k, v]) => `${k} x${v}`).join(", ") || "none (the hook is blind to this)";
  console.log(`   ${s.kind.padEnd(22)} ${String(s.hookOnly.orders).padStart(6)} ${String(s.hookOnly.accepted).padStart(8)} ${String(s.hookOnly.rejected).padStart(8)}  ${rules.padEnd(30)} ${("$" + s.hookOnly.lossUsd.toFixed(2)).padStart(10)} ${("$" + s.hookOnly.lossIfNoHookUsd.toFixed(2)).padStart(18)}   accepted ${s.withFix.accepted}, loss $${s.withFix.lossUsd.toFixed(2)}`);
}
const sl = strategies.slippageShock.results, fc = strategies.feeChange.results;
console.log(`   strategies re-priced: slippage 40 bps -> net ${sl.map((r) => `${r.id} ${r.pnlNetUsd.toFixed(1)}`).join(", ")}`);
console.log(`   strategies re-priced: fee 30 bps -> net ${fc.map((r) => `${r.id} ${r.pnlNetUsd.toFixed(1)}`).join(", ")}`);
console.log(`   HTTP 429 for 300 s: a client retrying every second makes ${retryCalls(300).naive} calls; with back-off (1, 2, 4 ... 30 s) it makes ${retryCalls(300).backoff}`);

// ---- 5. feed-break alarm ---------------------------------------------------------------------------------
const freezeAt = defaultFault("none", n).startTick;
const BREAK = { warmup: 60, k: 0.5, h: 5 };
const gapHealthy = gapSeries(series, null), gapFrozen = gapSeries(series, freezeAt, 0);
const dHealthy = detectBreak(gapHealthy, BREAK), dFrozen = detectBreak(gapFrozen, BREAK);
write("breaks.json", { ...meta, params: BREAK, freezeAt, t: pts.map((p) => p.t), gapHealthyBps: gapHealthy.map((x) => round(x, 3)), gapFrozenBps: gapFrozen.map((x) => round(x, 3)), healthy: { mean: dHealthy.mean, sd: dHealthy.sd, alarmTick: dHealthy.alarmTick }, frozen: { mean: dFrozen.mean, sd: dFrozen.sd, alarmTick: dFrozen.alarmTick }, freezeNote: "The freeze is SIMULATED (the oracle value is repeated); the venue price and the gap before it are real." });
console.log(`\n5. Feed-break alarm on the venue-minus-oracle gap (warm-up ${BREAK.warmup} samples: mean ${dHealthy.mean} bps, sd ${dHealthy.sd} bps; slack k ${BREAK.k}, alarm level h ${BREAK.h})`);
console.log(`   healthy feed: ${dHealthy.alarmTick === null ? "no alarm" : "ALARM at sample " + dHealthy.alarmTick}   |   simulated freeze at sample ${freezeAt}: ${dFrozen.alarmTick === null ? "no alarm" : `ALARM at sample ${dFrozen.alarmTick}, ${(dFrozen.alarmTick - freezeAt) * series.intervalSec} s after the freeze`}`);

// ---- 6. optional live check --------------------------------------------------------------------------------
if (process.argv.includes("--live")) {
  console.log("\n6. Live check (one read of the Pyth SOL/USD account, then the risk hook)");
  try {
    const p = await readPyth();
    const age = Math.max(0, Math.floor(Date.now() / 1000) - p.publishTime);
    const d = checkOrder({ side: "buy", sizeUsd: ORDER_SIZE_USD, price: round(p.price, 2) }, { oraclePrice: p.price, oracleAgeSec: age });
    console.log(`   Pyth SOL/USD ${p.price.toFixed(4)}, published ${age} s ago, ${p.currentSlot - p.postedSlot} slots behind -> hook says ${d.ok ? "ACCEPT" : "REJECT [" + d.rule + "] " + d.reason}`);
  } catch (e) {
    const why = e instanceof RateLimitError ? e.message : `live read failed: ${(e as Error).message}`;
    console.log(`   !! ${why}\n   !! Staying on recorded data.`);
  }
}
console.log(`\nWrote splits.json, leaky.json, overfit.json, faults.json, breaks.json to ${outDir}`);
