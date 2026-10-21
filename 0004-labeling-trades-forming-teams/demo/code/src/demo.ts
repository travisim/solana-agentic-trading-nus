// npm run demo                   -> recorded data (default, no network)
// npm run demo -- --live         -> presenter option: records a few minutes of live prices first (short horizon), falls back to recorded on any failure
// Options: --source pyth|jupiter|orca|swaps  --mult N  --horizon STEPS  --vol-span STEPS  --every STEPS  --min-width-bps N
//          --lookback STEPS  --z-min N  --error-rate PCT  --seed N  --train-frac F  --threshold-usd N (swaps source)  --live-minutes N  --out DIR
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { collectSeries } from "./collect.ts";
import { answersMarkdown, pickTen, sheetMarkdown } from "./minilab.ts";
import { pathFromSeries, pathFromSwaps, type PathResult } from "./path.ts";
import { DEFAULT_OPTIONS, runPipeline } from "./pipeline.ts";
import type { Series, Source, Swap } from "./types.ts";

const root = new URL("../", import.meta.url).pathname;
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (name: string) => process.argv.includes(`--${name}`);
const num = (name: string, dflt: number, min = 0): number => {
  const v = flag(name);
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Error(`--${name} needs a number >= ${min}, got "${v}"`);
  return n;
};
const readJson = <T>(file: string): T => JSON.parse(readFileSync(`${root}recorded/${file}`, "utf8")) as T;
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const hhmmss = (t: number) => new Date(t * 1000).toISOString().slice(11, 19);

const source = (flag("source") ?? "orca") as Source;
if (!["pyth", "jupiter", "orca", "swaps"].includes(source)) throw new Error(`--source must be pyth, jupiter, orca or swaps, got "${source}"`);
const D = DEFAULT_OPTIONS;
let live = has("live");
const opts = {
  labels: {
    mult: num("mult", D.labels.mult, 0.01),
    horizon: Math.round(num("horizon", D.labels.horizon, 1)),
    volSpan: Math.round(num("vol-span", D.labels.volSpan, 1)),
    every: Math.round(num("every", D.labels.every, 1)),
    minWidthBps: num("min-width-bps", D.labels.minWidthBps, 0),
  },
  agent: { lookback: Math.round(num("lookback", D.agent.lookback, 1)), zMin: num("z-min", D.agent.zMin, 0), errorRatePct: num("error-rate", D.agent.errorRatePct, 0), seed: Math.round(num("seed", D.agent.seed, 0)) },
  trainFrac: num("train-frac", D.trainFrac, 0.2),
};

// ---- 1. data -----------------------------------------------------------------------------------------
let series = readJson<Series>("series.json");
let mode: "recorded" | "live" = "recorded";
let capturedAt = "2026-10-21T17:53:59.000Z"; // end of the build night 1 recording (recorded/SOURCES.md)
if (live && source !== "swaps") {
  try {
    const minutes = num("live-minutes", 6, 1);
    console.log(`Recording ${minutes} minutes of live Jupiter, Pyth and Orca prices (one sample every 5 s)...`);
    const got = await collectSeries(minutes, 5);
    // a short recording needs a short horizon, otherwise no decision has a known label yet
    const live_ = { horizon: flag("horizon") === undefined ? 12 : opts.labels.horizon, volSpan: flag("vol-span") === undefined ? 8 : opts.labels.volSpan };
    const needed = live_.volSpan + live_.horizon + 2 * opts.labels.every * 10; // room for about 10 labelled decisions
    if (got.series.points.length < needed) throw new Error(`only ${got.series.points.length} samples recorded, need at least ${needed} (try --live-minutes ${Math.ceil((needed * 5) / 60) + 1})`);
    series = got.series;
    mode = "live";
    capturedAt = new Date().toISOString();
    opts.labels.horizon = live_.horizon;
    opts.labels.volSpan = live_.volSpan;
    if (flag("lookback") === undefined) opts.agent.lookback = 6;
    console.log(`Got ${series.points.length} samples (${got.failures} failed). Using a short horizon: ${opts.labels.horizon} steps.\n`);
  } catch (e) {
    console.log(`!! live recording failed: ${(e as Error).message}\n!! Falling back to --recorded data so you can keep going.\n`);
    live = false;
  }
} else if (live) {
  console.log("!! --live is not available for --source swaps (recorded Orca swaps); using recorded data.\n");
}

let path: PathResult;
let header: string;
if (source === "swaps") {
  const sw = readJson<{ swaps: Swap[]; capturedAt: string }>("swaps.json");
  const thr = num("threshold-usd", 10_000, 1);
  const p = pathFromSwaps(sw.swaps, thr);
  path = p;
  capturedAt = sw.capturedAt;
  header = `${fmt(sw.swaps.length)} real Orca swaps (${fmt(p.kept)} kept after cleaning: ${p.dropped.duplicates} duplicates, ${p.dropped.dust} dust, ${p.dropped.outliers} outliers dropped) -> ${p.points.length} dollar bars of $${fmt(thr)}`;
} else {
  path = pathFromSeries(series, source);
  header = `${series.points.length} samples, one every ${series.intervalSec} s`;
}
const pts = path.points;
console.log(`Labeling data (${mode}) ${capturedAt}   SOL/USDC, ${path.note}`);
console.log(`${header}; ${hhmmss(pts[0]!.t)} to ${hhmmss(pts.at(-1)!.t)} UTC, price ${Math.min(...pts.map((p) => p.price)).toFixed(2)} to ${Math.max(...pts.map((p) => p.price)).toFixed(2)}\n`);

const outDir = flag("out") ?? `${root}${mode === "live" ? "out-live" : "out"}/`; // a live run never overwrites the recorded out/ that the lab demos read
const cross: Record<string, number[]> = {};
if (source !== "swaps") for (const other of ["pyth", "jupiter", "orca"] as const) if (other !== source) cross[other] = series.points.map((p) => p[other]);
const R = runPipeline(path, opts, cross);

// ---- 2. print ------------------------------------------------------------------------------------------
const L = R.labels.stats as Record<string, any>;
const A = R.agent.stats;
const O = R.overlap.stats;
const M = R.meta;
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "n/a");
console.log(`Triple-barrier labels: width = ${opts.labels.mult} x noise over ${opts.labels.horizon} steps (floor ${opts.labels.minWidthBps} bps), a decision every ${opts.labels.every} steps`);
console.log(`  ${L.decisions} decisions labelled (${L.droppedAtEnd} dropped at the end: their horizon runs past the data)`);
console.log(`  upper barrier ${L.up} (${pct(L.up, L.decisions)}), lower barrier ${L.down} (${pct(L.down, L.decisions)}), time ran out ${L.time} (${pct(L.time, L.decisions)})`);
console.log(`  average barrier width ${L.meanWidthBps} bps, average hold ${L.meanHoldSteps} steps`);
console.log(`  a plain "sign after ${opts.labels.horizon} steps" label disagrees with the triple barrier on ${L.fixedDisagree} of ${L.decisions} decisions (${L.fixedDisagreePct}%)`);
for (const c of L.crossCheck as { against: string; n: number; agreePct: number }[]) console.log(`  the same labels computed on the ${c.against} price agree on ${c.agreePct}% of ${c.n} decisions`);

console.log(`\nWhy labels leak: each label looks ${opts.labels.horizon} steps ahead, and a decision comes every ${opts.labels.every}`);
console.log(`  on average ${O.meanConcurrency} labels are alive at the same moment (at most ${O.maxConcurrency}); average uniqueness ${O.meanUniqueness}`);
console.log(`  ${O.labels} labels carry about ${O.effectiveN} independent observations`);
console.log(`  cut train/test at step ${R.overlap.leak.cutStep}: ${R.overlap.leak.leaking} training labels reach into the test period (purged before fitting the gate)`);

console.log(`\nPretend agent (momentum rule, ${opts.agent.lookback}-step look-back, acts at ${opts.agent.zMin}x noise), reasons graded by the checker`);
console.log(`  ${A.decisions} decisions: ${A.trades} trades, ${A.holds} holds. Trades: ${A.wins} wins, ${A.losses} losses, ${A.timeouts} timed out -> hit rate ${A.hitRatePct}%`);
console.log(`  ${A.injected} reasons were given one SIMULATED wrong claim on purpose; the checker flagged ${A.flagged} (${A.caught} caught, ${A.missed} missed, ${A.falseAlarms} false alarms)`);
console.log(`  these are gross results: a round trip costs about ${A.roundTripCostBps} bps in pool fees alone, and only ${A.winsThatCoverCost} of the ${A.wins} wins had a barrier at least that wide`);
console.log(`  hit rate of trades whose reason was true: ${A.hitRateWhenReasonOkPct}% (${A.reasonsOkTrades}); whose reason had a wrong claim: ${A.hitRateWhenReasonBadPct}% (${A.reasonsBadTrades})`);
const example = R.agent.decisions.find((d) => d.side !== 0 && !d.check.ok) ?? R.agent.decisions[0]!;
console.log(`  example ${hhmmss(example.t)}: "${example.reason}"\n    -> ${example.check.ok ? "all claims check out" : "checker: " + example.check.problems.join("; ")}; outcome ${example.outcome}`);

const T = M.stats;
const tl = (t: { trades: number; hitRatePct: number | null; ci95Pct: number | null }) => (t.trades ? `${t.trades} trades, hit rate ${t.hitRatePct}% (+/- ${t.ci95Pct})` : "0 trades");
console.log(`\nMeta-gate (logistic regression on ${M.features.length} features; train ${M.split.trainTrades} trades, ${M.split.purgedTrades} purged, test ${M.split.testTrades})`);
console.log(`  threshold ${M.defaultThreshold} (training win rate ${T.trainBaseRatePct}%)`);
console.log(`  test, no gate    : ${tl(T.testNoGate)}`);
console.log(`  test, with gate  : ${tl(T.testWithGate)}   blocked ${T.blocked.trades}, of which ${T.blocked.wouldHaveWon} would have won`);
console.log(`  test, gate fitted without purging: ${tl(T.testWithGateNaiveSplit)}`);
console.log(`  Simulated, on ${mode} data; not advice. ${T.note}.`);
if (mode === "live") console.log(`  This live window is only ${pts.length} samples (${((pts.at(-1)!.t - pts[0]!.t) / 60).toFixed(0)} minutes): it shows the pipeline running on fresh data, it is too short to conclude anything.`);

// ---- 3. write out/*.json -------------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data) + "\n");
const meta = { source, mode, capturedAt, pair: "SOL/USDC", note: path.note, stepSec: path.stepSec };
write("labels.json", { ...meta, params: opts.labels, points: pts, vol: R.labels.vol, labels: R.labels.labels, stats: R.labels.stats });
write("agent.json", { ...meta, params: opts.agent, simulatedErrors: "each decision with injected != none carries ONE deliberately wrong claim (fixed seed); this is a simulation to test the checker", decisions: R.agent.decisions, stats: A });
write("overlap.json", { ...meta, horizon: opts.labels.horizon, every: opts.labels.every, conc: R.overlap.conc, uniq: R.overlap.uniq, stats: O, leak: R.overlap.leak });
write("meta.json", { ...meta, agentParams: opts.agent, ...M });
// same agent, same settings, three price sources: the label depends on which price you label with
const sourceRows = (["pyth", "jupiter", "orca"] as const).map((src) => {
  const r = runPipeline(pathFromSeries(series, src), opts);
  const ls = r.labels.stats as Record<string, number>;
  return {
    source: src, decisions: ls["decisions"], up: ls["up"], down: ls["down"], time: ls["time"], meanWidthBps: ls["meanWidthBps"],
    trades: r.agent.stats.trades, hitRatePct: r.agent.stats.hitRatePct, testNoGate: r.meta.stats.testNoGate, testWithGate: r.meta.stats.testWithGate,
  };
});
console.log("\nSame agent on three price paths (labels differ because the paths differ):");
for (const r of sourceRows) console.log(`  ${r.source.padEnd(8)} up ${String(r.up).padStart(3)}  down ${String(r.down).padStart(3)}  time ${String(r.time).padStart(3)}  width ${r.meanWidthBps} bps  ${r.trades} trades, hit rate ${r.hitRatePct}%`);
write("sources.json", { ...meta, params: opts.labels, agentParams: opts.agent, rows: source === "swaps" ? [] : sourceRows });
write("series.json", { pair: "SOL/USDC", mode, capturedAt, intervalSec: series.intervalSec, points: series.points });
const ten = pickTen(R.labels.labels, pts.map((p) => p.price), opts.labels.horizon);
writeFileSync(`${outDir}minilab.md`, sheetMarkdown(ten, opts.labels.horizon, path.stepSec === null ? "bar close" : `${path.stepSec} seconds`));
writeFileSync(`${outDir}minilab-answers.md`, answersMarkdown(ten));
write("lanes.json", JSON.parse(readFileSync(`${root}data/lanes.json`, "utf8")));
console.log(`\nWrote labels.json, agent.json, overlap.json, meta.json, sources.json, series.json, lanes.json, minilab.md and minilab-answers.md to ${outDir}`);
