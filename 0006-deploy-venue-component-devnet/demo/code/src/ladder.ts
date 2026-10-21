// Starter: Phoenix ladder reader. Print the order book of one Phoenix market with spread, depth and imbalance.
//   npm run ladder                          recorded data, SOL/USDC on mainnet (no network)
//   npm run ladder -- --market JitoSOL/SOL  another recorded market (names are in recorded/phoenix.json)
//   npm run ladder -- --live                read the market account right now (public RPC, read only)
import fs from "node:fs";
import { getAccount, DEVNET_RPC, MAINNET_RPC } from "./rpc.ts";
import { decodePhoenixMarket, liveOrders, toLadder } from "./phoenix.ts";
import { depthWithin, imbalance, topOfBook, walkBook, type Level } from "./microstructure.ts";
import { MARKETS } from "./markets.ts";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const name = arg("market", "SOL/USDC")!;
const live = process.argv.includes("--live");
const levels = Number(arg("levels", "8"));
const mk = MARKETS.find((m) => m.name === name);
if (!mk) throw new Error(`unknown market '${name}'. Choose one of: ${MARKETS.map((m) => m.name).join(", ")}`);

let bids: Level[];
let asks: Level[];
let where: string;
if (live) {
  const a = await getAccount(mk.address, mk.cluster === "devnet" ? DEVNET_RPC : MAINNET_RPC);
  const m = decodePhoenixMarket(a.bytes);
  const unix = Math.floor(Date.now() / 1000);
  bids = toLadder(liveOrders(m.bids, a.slot, unix), 100);
  asks = toLadder(liveOrders(m.asks, a.slot, unix), 100);
  where = `LIVE, slot ${a.slot}`;
} else {
  const rec = JSON.parse(fs.readFileSync("recorded/phoenix.json", "utf8")) as { capturedAt: string; markets: Array<{ name: string; snapshots: Array<{ slot: number; bids: Array<[number, number]>; asks: Array<[number, number]> }> }> };
  const m = rec.markets.find((x) => x.name === name)!;
  const s = m.snapshots[m.snapshots.length - 1]!;
  bids = s.bids.map(([price, size]) => ({ price, size }));
  asks = s.asks.map(([price, size]) => ({ price, size }));
  where = `recorded ${rec.capturedAt}, slot ${s.slot}`;
}
const t = topOfBook(bids, asks);
console.log(`${mk.name} (${mk.cluster}, Phoenix market ${mk.address})  ${where}\n`);
console.log("          price        size");
[...asks.slice(0, levels)].reverse().forEach((l) => console.log(`  ask  ${l.price.toFixed(4).padStart(10)}  ${l.size.toFixed(4).padStart(10)}`));
console.log(`       ---- spread ${t.spread === null ? "n/a (one side is empty)" : `${t.spread.toFixed(4)} = ${t.spreadBps!.toFixed(1)} bps`} ----`);
bids.slice(0, levels).forEach((l) => console.log(`  bid  ${l.price.toFixed(4).padStart(10)}  ${l.size.toFixed(4).padStart(10)}`));
const c = t.mid ?? t.bestBid ?? t.bestAsk;
if (c) {
  for (const bps of [100, 500, 1000]) {
    const b = depthWithin(bids, "bid", c, bps);
    const a = depthWithin(asks, "ask", c, bps);
    console.log(`depth within ${String(bps).padStart(4)} bps of ${t.mid ? "mid" : "best"}: bids ${b.toFixed(3)}  asks ${a.toFixed(3)}  imbalance ${imbalance(b, a)?.toFixed(2) ?? "n/a"}`);
  }
  const w = walkBook(asks, 5, "buy");
  console.log(`a market buy of 5 would ${w.complete ? "fill" : "only fill " + w.filled.toFixed(2)} at an average ${w.vwap?.toFixed(4) ?? "n/a"} (${w.slippageBps?.toFixed(1) ?? "n/a"} bps worse than the best ask)`);
}
