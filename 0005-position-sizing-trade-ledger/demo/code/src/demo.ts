// npm run demo            -> uses bundled recorded data (default, no network)
// npm run demo -- --live  -> presenter option: also reads the pool token accounts and a few Jupiter quotes right now
// Options: --start-usd N --max-fraction F --step F --max-impact-bps N --horizon-sec N --min-z F --fee-bps N
//          --combine average|sum --max-notional N --no-injected --out DIR
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { averageUniqueness, concurrentCounts } from "./concurrency.ts";
import { impactBpsFor, maxSizeForImpact } from "./impact.ts";
import { replay } from "./ledger.ts";
import { describeRules } from "./risk.ts";
import { DEFAULT_RUN, simulate, type RunConfig } from "./simulate.ts";
import { normCdf, probToSize, zOfP } from "./sizing.ts";
import { readTokenAccount } from "./tokens.ts";
import { getJson, RateLimitError } from "./rpc.ts";
import type { BalancesFile, ImpactFile, Series } from "./types.ts";

const root = new URL("../", import.meta.url).pathname;
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const num = (name: string, dflt: number, min = 0): number => {
  const v = flag(name);
  if (v === undefined) return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || (min === 0 && n === 0 && name !== "fee-bps")) throw new Error(`--${name} needs a number > ${min === 0 ? "0" : min - 1e-9}, got "${v}"`);
  return n;
};
const readJson = <T>(file: string): T => JSON.parse(readFileSync(`${root}recorded/${file}`, "utf8")) as T;
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const usd = (n: number, d = 2) => (n < 0 ? "-" : "") + "$" + fmt(Math.abs(n), d);
const clock = (t: number) => new Date(t * 1000).toISOString().slice(11, 19);

const series = readJson<Series>("series.json");
const impact = readJson<ImpactFile>("jupiter-impact.json");
let balances = readJson<BalancesFile>("token-balances.json");
let mode: "recorded" | "live" = "recorded";
const solPair = impact.pairs.find((p) => p.id === "SOL/USDC")!;

if (process.argv.includes("--live")) {
  try {
    console.log("Live: reading the two pool token accounts and 3 Jupiter quotes right now (the simulation below still runs on the recorded series)...");
    const RPC = process.env["SOLANA_RPC_URL"] ?? "https://solana-rpc.publicnode.com";
    const fresh = [];
    for (const b of balances.balances) fresh.push(await readTokenAccount(b.address, b.label, RPC));
    balances = { capturedAt: new Date().toISOString(), source: `live getAccountInfo on ${new URL(RPC).host}`, balances: fresh };
    mode = "live";
    for (const sizeUsd of [1000, 100_000, 1_000_000]) {
      const q = (await getJson(`https://lite-api.jup.ag/swap/v1/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=${sizeUsd * 1e6}&slippageBps=50`)) as { priceImpactPct: string };
      console.log(`  live Jupiter quote, buy ${fmt(sizeUsd)} USD of SOL: priceImpactPct ${q.priceImpactPct} (${(Number(q.priceImpactPct) * 100).toFixed(3)} bps)`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (e) {
    const why = e instanceof RateLimitError ? e.message : `live read failed: ${(e as Error).message}`;
    console.log(`!! ${why}\n!! Falling back to --recorded data so you can keep going.\n`);
    balances = readJson<BalancesFile>("token-balances.json");
  }
}

// ---- configuration (command-line options change the main run) -----------------------------------
const base = DEFAULT_RUN;
const main: RunConfig = {
  ...base,
  sizing: {
    ...base.sizing,
    startUsd: num("start-usd", base.sizing.startUsd),
    maxFraction: num("max-fraction", base.sizing.maxFraction),
    step: num("step", base.sizing.step),
    maxImpactBps: num("max-impact-bps", base.sizing.maxImpactBps),
  },
  signal: { ...base.signal, minZ: num("min-z", base.signal.minZ) },
  limits: { ...base.limits, maxNotionalUsd: num("max-notional", base.limits.maxNotionalUsd) },
  horizonSec: num("horizon-sec", base.horizonSec),
  feeBps: num("fee-bps", base.feeBps),
  combine: (flag("combine") as RunConfig["combine"] | undefined) ?? base.combine,
  injected: !process.argv.includes("--no-injected"),
};
if (main.combine !== "average" && main.combine !== "sum") throw new Error(`--combine needs average or sum, got "${main.combine}"`);
const outDir = flag("out") ?? `${root}out/`;
mkdirSync(outDir, { recursive: true });

// ---- run the main case and three comparison cases on the same recorded data ---------------------
const t0 = series.points[0]!.t, t1 = series.points.at(-1)!.t;
console.log(`Position sizing and trade ledger (${mode === "live" ? "live pool reads, recorded price series" : "recorded"})  ${series.points.length} recorded 5 s points, ${clock(t0)} to ${clock(t1)} UTC (${((t1 - t0) / 60).toFixed(0)} min), SOL/USDC`);
console.log(`Simulated, on recorded data; not advice. Start ${usd(main.sizing.startUsd, 0)}, exposure cap ${(main.sizing.maxFraction * 100).toFixed(0)} % of equity, steps of ${main.sizing.step}, bets last ${main.horizonSec} s\n`);

const mainRun = simulate(series, solPair.quotes, main, `${outDir}ledger.jsonl`);
const variants: RunConfig[] = [
  { ...main, id: "frictionless", label: "No costs (before)", feeBps: 0, useImpact: false },
  { ...main, id: "main", label: "With costs (main ledger)" },
  { ...main, id: "small-cap", label: "Costs + half the cap", sizing: { ...main.sizing, maxFraction: main.sizing.maxFraction / 2 } },
  { ...main, id: "sum", label: "Costs + bets summed, not averaged", combine: main.combine === "average" ? "sum" : "average" },
];
const runs = variants.map((v) => (v.id === "main" ? mainRun : simulate(series, solPair.quotes, v)));
mainRun.config.label = "With costs (main ledger)";

// 1. confidence -> size
const keyP = [0.55, 0.6, 0.7, 0.8, 0.9, 0.95];
console.log("1. Confidence to size (z = (p - 1/2) / sqrt(p(1-p)), size = 2*Phi(z) - 1):");
console.log("   " + keyP.map((p) => `p ${p.toFixed(2)} -> ${(probToSize(p) * 100).toFixed(0)} %`).join("   "));

// 2. overlapping bets
const times = series.points.map((p) => p.t);
const counts = concurrentCounts(mainRun.bets, times);
const uniq = averageUniqueness(mainRun.bets, times);
const avgUniq = [...uniq.values()].reduce((a, b) => a + b, 0) / Math.max(1, uniq.size);
const avgOpen = counts.reduce((a, b) => a + b, 0) / counts.length;
const peakExpAvg = Math.max(...mainRun.exposure.map((e) => Math.abs(e.average)));
const peakExpSum = Math.max(...mainRun.exposure.map((e) => Math.abs(e.sum)));
console.log(`\n2. Overlapping bets: ${mainRun.bets.length} bets of ${main.horizonSec} s; up to ${mainRun.stats.maxConcurrent} open at once, ${avgOpen.toFixed(1)} on average`);
console.log(`   average uniqueness ${avgUniq.toFixed(2)} (1.00 would mean no overlap)   peak size: averaged ${(peakExpAvg * 100).toFixed(0)} % vs summed ${(peakExpSum * 100).toFixed(0)} % of the cap`);

// 3. the ledger
const rep = replay(mainRun.ledger.rows, main.sizing.startUsd);
const s = mainRun.stats;
console.log(`\n3. Ledger (out/ledger.jsonl): ${rep.rows} rows = ${rep.fills} fills + ${rep.rejected} rejected by the risk hook`);
for (const [rule, n] of Object.entries(s.rejectedByRule)) console.log(`   rejected by ${rule}: ${n}`);
console.log(`   ${s.tooSmall} changes were under the ${main.sizing.minOrderUsd} USD minimum (no order); ${s.cappedByImpact} orders were cut by the impact cap (${main.sizing.maxImpactBps} bps)`);
for (const r of mainRun.ledger.rows.filter((r) => !r.verdict.ok).slice(0, 4)) {
  console.log(`   ${clock(r.t)} row ${r.seq}: ${r.order.side} ${usd(r.order.sizeUsd, 0)} REJECTED (${r.verdict.rule}): ${r.verdict.reason}${r.trigger === "injected" ? "   [injected test]" : ""}`);
}
console.log(`   replay: ${rep.ok ? "OK, hash chain intact, every row's cash and position match the fills" : "FAILED: " + rep.errors.join("; ")}`);
console.log(`   cash ${usd(rep.cashUsd)}  position ${rep.posSol.toFixed(4)} SOL  fees ${usd(rep.feesUsd, 4)}  head hash ${rep.headHash.slice(0, 16)}...`);
if (!rep.ok) throw new Error("ledger did not reconcile");
const lastEq = mainRun.equity.at(-1)!;
if (Math.abs(lastEq.cashUsd - rep.cashUsd) > 1e-5 || Math.abs(lastEq.posSol - rep.posSol) > 1e-8) throw new Error("equity curve and ledger disagree");

// 4. equity before and after
console.log(`\n4. Equity at the end (marked at the oracle), same orders, same data:`);
for (const r of runs) {
  console.log(`   ${r.config.label.padEnd(36)} ${usd(r.stats.finalEquityUsd).padStart(12)}  (${r.stats.returnPct >= 0 ? "+" : ""}${r.stats.returnPct.toFixed(3)} %)  max drawdown ${r.stats.maxDrawdownPct.toFixed(3)} %  fees ${usd(r.stats.feesUsd, 2)}  impact ${usd(r.stats.impactCostUsd, 4)}  rejected ${r.stats.rejected}`);
}

// 5. real token accounts and price impact
const solV = balances.balances[0]!, usdcV = balances.balances[1]!;
console.log(`\n5. Real token accounts (${mode}, ${balances.capturedAt.slice(0, 19)}Z): Orca SOL/USDC pool holds ${fmt(solV.amount, 0)} SOL and ${fmt(usdcV.amount, 0)} USDC`);
console.log(`   a ${fmt(main.limits.maxNotionalUsd)} USD order is ${((main.limits.maxNotionalUsd / usdcV.amount) * 100).toFixed(4)} % of the USDC side of that pool`);
for (const pair of impact.pairs) {
  const cap = maxSizeForImpact({ quotes: pair.quotes.filter((q) => q.side === "buy") }, "buy", main.sizing.maxImpactBps);
  const at100k = impactBpsFor({ quotes: pair.quotes }, "buy", 100_000);
  console.log(`   ${pair.id.padEnd(10)} Jupiter impact at 100,000 USD: ${at100k.toFixed(3)} bps; largest order under ${main.sizing.maxImpactBps} bps: ${cap >= 1_000_000 ? "over 1,000,000" : fmt(cap)} USD`);
}

// ---- write out/*.json (the files the lab demos read) --------------------------------------------
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data, null, 1) + "\n");
const curve = Array.from({ length: 50 }, (_, i) => {
  const p = Math.round((0.5 + i * 0.01) * 100) / 100;
  return { p, z: Math.round(zOfP(p) * 1e4) / 1e4, m: Math.round(probToSize(p) * 1e4) / 1e4 };
});
write("sizing.json", {
  note: "Simulated, on recorded data; not advice.",
  params: { ...main.sizing, horizonSec: main.horizonSec, combine: main.combine, feeBps: main.feeBps, useImpact: main.useImpact, injected: main.injected, signal: main.signal },
  limits: main.limits,
  rules: describeRules(main.limits),
  curve,
  checks: { phi0: normCdf(0), phi1: Math.round(normCdf(1) * 1e6) / 1e6 },
  impact: { capturedAt: impact.capturedAt, source: impact.source, pairs: impact.pairs },
  inventory: { mode, ...balances },
});
write("series.json", { ...series, source: "copied from build night 1 recorded/series.json (real Jupiter, Pyth and Orca SOL/USDC prices, one sample every 5 s, captured 2026-10-21 17:13:59 to 17:53:59 UTC)" });
write("concurrency.json", {
  horizonSec: main.horizonSec,
  bets: mainRun.bets.map((b) => ({ ...b, uniqueness: Math.round((uniq.get(b.id) ?? 1) * 1e4) / 1e4 })),
  timeline: series.points.map((p, i) => ({ t: p.t, open: counts[i]! })),
  exposure: mainRun.exposure,
  stats: { bets: mainRun.bets.length, maxConcurrent: mainRun.stats.maxConcurrent, avgConcurrent: Math.round(avgOpen * 100) / 100, avgUniqueness: Math.round(avgUniq * 1e4) / 1e4, peakAveragedSize: Math.round(peakExpAvg * 1e4) / 1e4, peakSummedSize: Math.round(peakExpSum * 1e4) / 1e4 },
});
write("ledger.json", {
  note: "Simulated, on recorded data; not advice. Rows marked trigger=injected are deliberate bad orders added to show the risk hook.",
  startUsd: main.sizing.startUsd,
  params: main.sizing,
  limits: main.limits,
  rows: mainRun.ledger.rows,
  replay: { ...rep, errors: rep.errors },
  stats: mainRun.stats,
});
write("equity.json", {
  note: "Simulated, on recorded data; not advice. Equity = cash + position marked at the oracle price.",
  startUsd: main.sizing.startUsd,
  runs: runs.map((r) => ({
    id: r.config.id,
    label: r.config.label,
    params: { maxFraction: r.config.sizing.maxFraction, step: r.config.sizing.step, feeBps: r.config.feeBps, useImpact: r.config.useImpact, combine: r.config.combine },
    stats: r.stats,
    curve: r.equity.map((e) => [e.t, e.equityUsd, e.exposureUsd]),
  })),
});
console.log(`\nWrote ledger.jsonl, ledger.json, series.json, sizing.json, concurrency.json, equity.json to ${outDir}`);
