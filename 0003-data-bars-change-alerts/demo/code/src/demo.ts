// npm run demo            -> uses bundled recorded data (default, no network)
// npm run demo -- --live  -> presenter option: fetches fresh swaps and Pyth reads first (slow on the public endpoint)
// Options: --threshold-usd N  --time-bar-sec N  --cusum-bps N  --max-age-sec N  --max-slots-behind N  --tick-sec N  --out DIR
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { barDurations, countEmptyTimeBars, dollarBars, lastBarIsPartial, timeBars, totalVolumeUsd } from "./bars.ts";
import { cusum, toTicks } from "./cusum.ts";
import { readPyth } from "./pyth.ts";
import { RateLimitError, sleep } from "./rpc.ts";
import { buildStaleness, isFresh } from "./staleness.ts";
import { collectSwaps, filterSwaps } from "./swaps.ts";
import type { PythReads, SwapFile } from "./types.ts";

const root = new URL("../", import.meta.url).pathname;
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const num = (name: string, dflt: number): number => {
  const v = flag(name);
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} needs a number > 0, got "${v}"`);
  return n;
};

const thresholdUsd = num("threshold-usd", 50_000);
const timeBarSec = num("time-bar-sec", 60);
const cusumBps = num("cusum-bps", 15);
const maxAgeSec = num("max-age-sec", 30);
const maxSlotsBehind = num("max-slots-behind", 75);
const tickSec = num("tick-sec", 1);
const outDir = flag("out") ?? `${root}out/`;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(`${root}recorded/${file}`, "utf8")) as T;

// ---- 1. data: recorded (default) or live ----------------------------------------------------
let swapFile = readJson<SwapFile>("swaps.json");
let pyth = readJson<PythReads>("pyth-reads.json");
let mode: SwapFile["mode"] = "recorded";
let liveReads: PythReads["reads"] = [];
if (process.argv.includes("--live")) {
  try {
    console.log("Fetching 200 fresh swaps and 4 live Pyth reads (a minute or two on the public endpoint)...");
    const fresh = await collectSwaps({ count: 200 });
    const reads: PythReads["reads"] = [];
    for (let i = 0; i < 4; i++) {
      const p = await readPyth();
      reads.push({ t: Math.floor(Date.now() / 1000), price: p.price, confBps: Math.round(p.confBps * 100) / 100, publishTime: p.publishTime, postedSlot: p.postedSlot, currentSlot: p.currentSlot });
      await sleep(2000);
    }
    swapFile = { ...swapFile, ...fresh, mode: "live" };
    liveReads = reads;
    mode = "live";
  } catch (e) {
    const why = e instanceof RateLimitError ? e.message : `live fetch failed: ${(e as Error).message}`;
    console.log(`!! ${why}\n!! Falling back to --recorded data so you can keep going.\n`);
  }
}
const cleaned = filterSwaps(swapFile.swaps);
const swaps = cleaned.kept;
const stamp = (d: number) => new Date(d * 1000).toISOString().slice(11, 19);
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const span = swaps.at(-1)!.t - swaps[0]!.t;
const totalVol = totalVolumeUsd(swaps);
console.log(`Data collection (${mode}) ${swapFile.capturedAt}   pool ${swapFile.pool.slice(0, 8)}... (${swapFile.pair}, Orca)`);
console.log(`${fmt(swapFile.swaps.length)} real swaps recorded, ${fmt(cleaned.duplicates)} duplicates, ${fmt(cleaned.dust)} dust (< 1 USDC) and ${fmt(cleaned.outliers)} price outliers (> 1% from neighbours) dropped, ${fmt(swaps.length)} used, ${stamp(swaps[0]!.t)} to ${stamp(swaps.at(-1)!.t)} UTC (${(span / 60).toFixed(1)} min), ${fmt(totalVol)} USD traded\n`);

// ---- 2. time bars versus dollar bars ----------------------------------------------------------
const tBars = timeBars(swaps, timeBarSec);
const dBars = dollarBars(swaps, thresholdUsd);
const empty = countEmptyTimeBars(tBars, timeBarSec);
const dur = barDurations(dBars).sort((a, b) => a - b);
const median = dur.length ? dur[Math.floor(dur.length / 2)]! : 0;
console.log(`Bars: ${timeBarSec}-second time bars versus ${fmt(thresholdUsd)} USD dollar bars on the same swaps`);
console.log(`  time bars   : ${fmt(tBars.length)} bars (${empty} empty)  volume per bar ${fmt(Math.min(...tBars.map((b) => b.volumeUsd)))} to ${fmt(Math.max(...tBars.map((b) => b.volumeUsd)))} USD`);
console.log(`  dollar bars : ${fmt(dBars.length)} bars${lastBarIsPartial(dBars, thresholdUsd) ? " (last one unfinished)" : ""}  took ${dur[0]} s to ${dur.at(-1)} s to fill (median ${median} s)`);
const busiest = [...tBars].sort((a, b) => b.volumeUsd - a.volumeUsd)[0]!;
const quietest = [...tBars].sort((a, b) => a.volumeUsd - b.volumeUsd)[0]!;
const perMin = (from: number, to: number) => dBars.filter((b) => b.tEnd >= from && b.tEnd < to).length;
console.log(`  busiest minute ${stamp(busiest.tStart)}: ${fmt(busiest.volumeUsd)} USD -> ${perMin(busiest.tStart, busiest.tStart + 60)} dollar bars; quietest minute ${stamp(quietest.tStart)}: ${fmt(quietest.volumeUsd)} USD -> ${perMin(quietest.tStart, quietest.tStart + 60)} dollar bars`);
if (Math.abs(tBars.reduce((a, b) => a + b.volumeUsd, 0) - totalVol) > 0.01 || Math.abs(dBars.reduce((a, b) => a + b.volumeUsd, 0) - totalVol) > 0.01) {
  throw new Error("volume check failed: bars do not add up to the swaps");
}
console.log("  check: both sets of bars add up to the same total volume");

// ---- 3. CUSUM change alert ------------------------------------------------------------------
const ticks = toTicks(swaps, tickSec);
const cs = cusum(ticks, cusumBps);
console.log(`\nCUSUM change filter: threshold ${cusumBps} bps on ${fmt(ticks.length)} one-${tickSec === 1 ? "second" : tickSec + "-second"} price ticks`);
console.log(`  agent wakes every tick : ${fmt(cs.stats.agentCallsEveryTick)} calls`);
console.log(`  agent wakes on events  : ${fmt(cs.stats.agentCallsOnEvents)} calls (${cs.events.filter((e) => e.direction === "up").length} up, ${cs.events.filter((e) => e.direction === "down").length} down)  = ${(100 * (1 - cs.stats.agentCallsOnEvents / cs.stats.agentCallsEveryTick)).toFixed(1)}% fewer`);
for (const e of cs.events.slice(0, 5)) console.log(`    ${stamp(e.t)} ${e.direction.padEnd(4)} at ${e.price.toFixed(2)}`);
if (cs.events.length > 5) console.log(`    ... ${cs.events.length - 5} more in out/cusum.json`);

// ---- 4. staleness check -----------------------------------------------------------------------
const st = buildStaleness(pyth.reads, { maxAgeSec, maxSlotsBehind });
const mins = ((pyth.reads.at(-1)!.t - pyth.reads[0]!.t) / 60).toFixed(1);
if (liveReads.length) {
  console.log("\nLive Pyth check (real reads taken now; the recorded 26-minute series below is still used for the frozen-feed demo):");
  for (const r of liveReads) {
    const age = Math.max(0, r.t - r.publishTime);
    const behind = Math.max(0, r.currentSlot - r.postedSlot);
    console.log(`  ${stamp(r.t)} UTC  age ${age} s  ${behind} slots behind  -> ${isFresh(age, behind, { maxAgeSec, maxSlotsBehind }) ? "ok" : "STALE"}`);
  }
}
console.log(`\nStaleness check: ${st.stats.points} real Pyth reads over ${mins} min (limits: age ${maxAgeSec} s, ${maxSlotsBehind} slots behind)`);
console.log(`  real data    : max age ${st.stats.maxRealAgeSec} s, max ${st.stats.maxRealSlotsBehind} slots behind, ${st.stats.realStaleCount} of ${st.stats.realPoints} reads flagged stale`);
console.log(`  SIMULATED fault (frozen feed, repeats the last real value) from ${stamp(st.injectedFault.startT)} UTC:`);
console.log(`    caught ${st.stats.firstStaleDetectedAfterFaultSec} s after the freeze began; ${st.stats.simulatedPoints - 0} reads after it, last one age ${st.points.at(-1)!.ageSec} s / ${st.points.at(-1)!.slotsBehind} slots -> ${st.points.at(-1)!.ok ? "ok" : "STALE"}`);

// ---- 5. write out/*.json (the files the lab demos read) --------------------------------------
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data, null, 1) + "\n");
const { scanned: _s, ...swapMeta } = swapFile as SwapFile & { scanned?: unknown };
write("swaps.json", { ...swapMeta, mode, source: `${swapFile.source}; cleaned: ${cleaned.duplicates} duplicate signatures, ${cleaned.dust} dust swaps (< 1 USDC) and ${cleaned.outliers} price outliers (> 1% from the median of 21 neighbours) dropped`, swaps });
write("bars.json", {
  timeBarSec,
  dollarThresholdUsd: thresholdUsd,
  timeBars: tBars,
  dollarBars: dBars,
  stats: { swaps: swaps.length, timeBarCount: tBars.length, dollarBarCount: dBars.length, emptyTimeBars: empty, totalVolumeUsd: Math.round(totalVol * 100) / 100, lastDollarBarPartial: lastBarIsPartial(dBars, thresholdUsd) },
});
write("cusum.json", { ...cs, tickSec, note: "sPos >= 0 collects up moves, sNeg <= 0 collects down moves (both in bps); each point shows the buckets at the moment of the check, so an event point shows a bucket past the threshold; both empty right after." });
write("staleness.json", st);
console.log(`\nWrote swaps.json, bars.json, cusum.json, staleness.json to ${outDir}`);
