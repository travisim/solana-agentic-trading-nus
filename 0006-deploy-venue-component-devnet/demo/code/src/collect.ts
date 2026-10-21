// Recorder: captures REAL data into recorded/ (run by the lead; students use the recorded files).
//   node src/collect.ts phoenix [--minutes 8] [--interval 15]   Phoenix order books (mainnet + devnet) with Orca and Pyth reference prices
//   node src/collect.ts fixtures                                  small decoder test fixtures (gzip of real market accounts)
// Reads only. Writes only into recorded/ and test/fixtures/.
import fs from "node:fs";
import zlib from "node:zlib";
import { getAccount, sleep } from "./rpc.ts";
import { MARKETS } from "./markets.ts";
import { PHOENIX_PROGRAM, decodePhoenixMarket, liveOrders, toLadder } from "./phoenix.ts";
import { readOrca } from "./orca.ts";
import { readPyth } from "./pyth.ts";

const LEVELS = 100;

function arg(name: string, d: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
}
const round = (x: number, n = 6) => Math.round(x * 10 ** n) / 10 ** n;

async function snapshotMarket(m: (typeof MARKETS)[number]) {
  const a = await getAccount(m.address, m.url);
  if (a.owner !== PHOENIX_PROGRAM) throw new Error(`${m.address} is owned by ${a.owner}`);
  const mk = decodePhoenixMarket(a.bytes);
  const unix = Math.floor(Date.now() / 1000);
  const bids = liveOrders(mk.bids, a.slot, unix);
  const asks = liveOrders(mk.asks, a.slot, unix);
  const lad = (o: typeof bids) => toLadder(o, LEVELS).map((l) => [round(l.price), round(l.size)]);
  return {
    slot: a.slot,
    t: unix,
    bids: lad(bids),
    asks: lad(asks),
    orders: { bids: bids.length, asks: asks.length, expiredBids: mk.bids.length - bids.length, expiredAsks: mk.asks.length - asks.length },
    meta: { base: mk.base, quote: mk.quote, takerFeeBps: mk.takerFeeBps, capacity: mk.numBidsCapacity, accountBytes: a.bytes.length },
  };
}

async function phoenix() {
  const minutes = arg("minutes", 8);
  const interval = arg("interval", 15);
  const rounds = Math.max(1, Math.floor((minutes * 60) / interval));
  const series = new Map<string, Awaited<ReturnType<typeof snapshotMarket>>[]>();
  const reference: Array<{ t: number; slot: number; orcaPrice: number | null; pythPrice: number | null }> = [];
  const failures: string[] = [];
  const start = Date.now();
  for (let r = 0; r < rounds; r++) {
    const tickStart = Date.now();
    for (const m of MARKETS) {
      try {
        const s = await snapshotMarket(m);
        (series.get(m.address) ?? series.set(m.address, []).get(m.address)!).push(s);
      } catch (e) {
        failures.push(`${m.name}: ${(e as Error).message}`);
        console.log(`  ${m.name}: ${(e as Error).message}`);
      }
    }
    let orcaPrice: number | null = null;
    let pythPrice: number | null = null;
    let slot = 0;
    try {
      const o = await readOrca();
      orcaPrice = round(o.price, 4);
      slot = o.slot;
    } catch (e) {
      failures.push(`orca: ${(e as Error).message}`);
    }
    try {
      pythPrice = round((await readPyth()).price, 4);
    } catch (e) {
      failures.push(`pyth: ${(e as Error).message}`);
    }
    reference.push({ t: Math.floor(Date.now() / 1000), slot, orcaPrice, pythPrice });
    console.log(`round ${r + 1}/${rounds} done: orca ${orcaPrice} pyth ${pythPrice}`);
    const wait = interval * 1000 - (Date.now() - tickStart);
    if (r < rounds - 1 && wait > 0) await sleep(wait);
  }
  const out = {
    capturedAt: new Date(start).toISOString(),
    mode: "recorded",
    source: "getAccountInfo of Phoenix market accounts (mainnet via solana-rpc.publicnode.com, devnet via api.devnet.solana.com), decoded by src/phoenix.ts; Orca SOL/USDC pool and Pyth SOL/USD account on mainnet as reference prices",
    intervalSec: interval,
    levelsKept: LEVELS,
    failures,
    reference,
    markets: MARKETS.map((m) => ({ name: m.name, cluster: m.cluster, address: m.address, snapshots: series.get(m.address) ?? [] })),
  };
  fs.mkdirSync("recorded", { recursive: true });
  fs.writeFileSync("recorded/phoenix.json", JSON.stringify(out));
  console.log(`wrote recorded/phoenix.json (${fs.statSync("recorded/phoenix.json").size} bytes), ${failures.length} failed reads`);
}

async function fixtures() {
  fs.mkdirSync("test/fixtures", { recursive: true });
  for (const m of [MARKETS[3], MARKETS[4], MARKETS[1]]) {
    const a = await getAccount(m.address, m.url);
    const file = `test/fixtures/phoenix-${m.address}.account.gz`;
    fs.writeFileSync(file, zlib.gzipSync(Buffer.from(a.bytes), { level: 9 }));
    const mk = decodePhoenixMarket(a.bytes);
    console.log(`${file}: slot ${a.slot}, ${fs.statSync(file).size} bytes gz, bids ${mk.bids.length} asks ${mk.asks.length}`);
    fs.writeFileSync(file.replace(".account.gz", ".expected.json"), JSON.stringify({ address: m.address, name: m.name, slot: a.slot, capturedAt: new Date().toISOString(), bids: toLadder(mk.bids, 5), asks: toLadder(mk.asks, 5), counts: { bids: mk.bids.length, asks: mk.asks.length } }, null, 1));
  }
}

const cmd = process.argv[2];
if (cmd === "phoenix") await phoenix();
else if (cmd === "fixtures") await fixtures();
else {
  console.log("usage: node src/collect.ts phoenix|fixtures");
  process.exit(1);
}
