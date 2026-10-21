// npm run demo            -> uses bundled recorded data (default, no network)
// npm run demo -- --live  -> fetches one live sample from Jupiter, Pyth and Orca first
// Options: --fee-bps N  --slippage-bps N  --out DIR
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { collectAll } from "./collectors/index.ts";
import { RateLimitError } from "./rpc.ts";
import { DEFAULT_LIMITS, checkOrder, describeRules } from "./risk.ts";
import { runAll } from "./strategies/index.ts";
import type { Order, Prices, RiskContext, Series, StrategyResult } from "./types.ts";

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

const feeBps = num("fee-bps", 5);
const slippageBps = num("slippage-bps", 2);
const outDir = flag("out") ?? `${root}out/`;
const readJson = <T>(file: string): T => JSON.parse(readFileSync(`${root}recorded/${file}`, "utf8")) as T;

// ---- 1. data: recorded (default) or live -------------------------------------------------
let prices: Prices = readJson<Prices>("snapshot.json");
const series = readJson<Series>("series.json");
let mode: Prices["mode"] = "recorded";
if (process.argv.includes("--live")) {
  try {
    prices = await collectAll();
    mode = "live";
  } catch (e) {
    const why = e instanceof RateLimitError ? e.message : `live fetch failed: ${(e as Error).message}`;
    console.log(`!! ${why}\n!! Falling back to --recorded data so you can keep going.\n`);
  }
}
prices = { ...prices, mode };

const v = (id: string) => prices.venues.find((x) => x.id === id)!;
console.log(`Data collection (${mode}) ${prices.generatedAt}   pair ${prices.pair}`);
console.log("Venue".padEnd(22) + "Price (USD)".padStart(12) + "  Gap vs Pyth");
for (const x of prices.venues) {
  const bps = ((x.price - v("pyth").price) / v("pyth").price) * 10_000;
  const gap = x.id === "pyth" ? "" : `${(Math.abs(bps) < 0.05 ? 0 : bps).toFixed(1)} bps`;
  console.log(x.label.padEnd(22) + x.price.toFixed(4).padStart(12) + "  " + gap);
}
const hours = ((series.points.at(-1)!.t - series.points[0]!.t) / 3600).toFixed(2);
console.log(`Recorded series: ${series.points.length} points every ${series.intervalSec}s (${hours} h)\n`);

// ---- 2. the risk hook on a list of example orders ------------------------------------------
const pyth = v("pyth");
const refTime = v("jupiter").ts ?? Math.floor(Date.parse(prices.generatedAt) / 1000);
const baseAge = Math.max(0, refTime - (pyth.publishTime ?? refTime));
const oracle = pyth.price;
const px = (mult: number) => Math.round(oracle * mult * 100) / 100;
const examples: { label: string; order: Order; age?: number }[] = [
  { label: "normal buy", order: { side: "buy", sizeUsd: 250, price: px(1) } },
  { label: "normal sell", order: { side: "sell", sizeUsd: 500, price: px(1) } },
  { label: "right at the notional limit", order: { side: "sell", sizeUsd: 1000, price: px(1) } },
  { label: "40 bps from oracle", order: { side: "buy", sizeUsd: 250, price: px(1.004) } },
  { label: "oversized order", order: { side: "buy", sizeUsd: 5000, price: px(1) } },
  { label: "buy 100 bps above oracle", order: { side: "buy", sizeUsd: 250, price: px(1.01) } },
  { label: "sell 100 bps below oracle", order: { side: "sell", sizeUsd: 250, price: px(0.99) } },
  { label: "stale oracle (300 s old)", order: { side: "buy", sizeUsd: 250, price: px(1) }, age: 300 },
  { label: "price in cents, not dollars", order: { side: "buy", sizeUsd: 250, price: px(100) } },
  { label: "negative size", order: { side: "buy", sizeUsd: -50, price: px(1) } },
];
const ctx: RiskContext = { oraclePrice: oracle, oracleAgeSec: baseAge };
const decisions = examples.map((e) => {
  const c = { ...ctx, oracleAgeSec: e.age ?? ctx.oracleAgeSec };
  return { label: e.label, order: e.order, oracleAgeSec: c.oracleAgeSec, ...checkOrder(e.order, c, DEFAULT_LIMITS) };
});
console.log(`Risk hook (limits: ${DEFAULT_LIMITS.maxNotionalUsd} USD, ${DEFAULT_LIMITS.maxOracleGapBps} bps, ${DEFAULT_LIMITS.maxOracleAgeSec} s; oracle ${oracle.toFixed(2)})`);
for (const d of decisions) {
  console.log(`  ${d.ok ? "ACCEPT" : "REJECT"}  ${d.label.padEnd(30)} ${d.ok ? "" : `[${d.rule}] ${d.reason}`}`);
}

// ---- 3. five sample strategies on the recorded series -------------------------------------
const results: StrategyResult[] = runAll(series, { feeBps, slippageBps });
console.log(`\nSample strategies, simulated on recorded data; not advice. fee ${feeBps} bps + slippage ${slippageBps} bps per leg, 1000 USD per trade`);
console.log("Strategy".padEnd(26) + "Trades".padStart(7) + "Gross USD".padStart(11) + "Net USD".padStart(10) + "Hit rate".padStart(10));
for (const r of results) {
  console.log(
    r.name.padEnd(26) + String(r.trades).padStart(7) + r.pnlGrossUsd.toFixed(2).padStart(11) + r.pnlNetUsd.toFixed(2).padStart(10) +
      `${(r.hitRate * 100).toFixed(0)}%`.padStart(10),
  );
}

// ---- 4. write out/*.json (the files the lab demos read) -----------------------------------
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data, null, 2) + "\n");
write("prices.json", prices);
write("series.json", series);
write("risk.json", { rules: describeRules(), context: ctx, decisions });
write("strategies.json", { feeBps, slippageBps, note: "simulated on recorded data; not advice", strategies: results });
console.log(`\nWrote prices.json, series.json, risk.json, strategies.json to ${outDir}`);
