// One command: recorded real data -> numbers -> out/*.json (the interactive demos read these files).
//   npm run demo -- --recorded     (default; no network)
//   npm run demo -- --live         (also reads the current Phoenix SOL/USDC book and Orca price right now and prints them)
// Reads use public mainnet data; every write is devnet only; no real funds.
import fs from "node:fs";
import { buildDevnet, buildFlow, buildLadder, buildMatching, type DeployRecord, type DepositRun, type DevnetRun, type PhoenixRecorded, type SwapRec } from "./analysis.ts";

const live = process.argv.includes("--live");
const read = <T>(p: string): T => JSON.parse(fs.readFileSync(p, "utf8")) as T;
const pick = (...ps: string[]) => ps.find((p) => fs.existsSync(p));
const pct = (x: number | null, d = 1) => (x === null ? "n/a" : (x * 100).toFixed(d) + "%");
const f = (x: number | null, d = 2) => (x === null ? "n/a" : x.toFixed(d));

fs.mkdirSync("out", { recursive: true });
console.log("Workshop 3 sample code. Reads use public mainnet data; every write is devnet only; no real funds.\n");

// 1. order books
const ph = read<PhoenixRecorded>("recorded/phoenix.json");
const ladder = buildLadder(ph);
fs.writeFileSync("out/ladder.json", JSON.stringify(ladder));
console.log(`1. Order books: ${ph.markets.length} Phoenix markets, ${ladder.markets[0]?.snapshotCount} snapshots each, every ${ph.intervalSec} s, captured ${ph.capturedAt}`);
for (const m of ladder.markets) {
  const last = m.snapshots[m.snapshots.length - 1]!;
  const t = last.features.top;
  const d100 = last.features.depth.find((x) => x.bps === 100)!;
  const d1000 = last.features.depth.find((x) => x.bps === 1000)!;
  console.log(
    `   ${m.name.padEnd(32)} ${m.cluster.padEnd(7)} bid ${f(t.bestBid, 4).padStart(9)}  ask ${f(t.bestAsk, 4).padStart(9)}  spread ${f(t.spreadBps, 1).padStart(8)} bps  depth within 1%: ${f(d100.bid, 2)}/${f(d100.ask, 2)} within 10%: ${f(d1000.bid, 2)}/${f(d1000.ask, 2)} (bids/asks, base units)  top-5 changed in ${m.topChanges} of ${m.snapshotCount - 1} intervals`,
  );
}

// 2. matching engine vs the chain
const runPath = pick("recorded/devnet-run.json", "recorded/local-run.json");
if (!runPath) throw new Error("no recorded/devnet-run.json or recorded/local-run.json");
const run = read<DevnetRun>(runPath);
const matching = buildMatching(run);
fs.writeFileSync("out/matching.json", JSON.stringify(matching));
console.log(`\n2. Matching: the TypeScript engine replays ${matching.steps.length} recorded steps from ${run.cluster}: logs equal the chain's on ${matching.steps.filter((s) => s.match).length}/${matching.steps.length} steps; final book bytes equal: ${matching.finalBookEqualsChain}`);
for (const s of matching.steps) console.log(`   ${String(s.step).padStart(2)} ${s.chainOk ? "ok    " : "FAILED"} ${s.label}${s.chainLogs.filter((l) => l.startsWith("FILL")).map((l) => "\n         " + l).join("")}`);

// 3. devnet evidence
const dep = pick("recorded/deposit-run.json") ? read<DepositRun>("recorded/deposit-run.json") : null;
const deploy = pick("recorded/devnet-deploy.json") ? read<DeployRecord>("recorded/devnet-deploy.json") : null;
const localRun = pick("recorded/local-run.json") && runPath !== "recorded/local-run.json" ? read<DevnetRun>("recorded/local-run.json") : null;
const dn = buildDevnet(run, dep, deploy, localRun);
fs.writeFileSync("out/devnet.json", JSON.stringify(dn));
console.log(`\n3. Evidence (${dn.cluster}, ${dn.rpcHost}): program ${dn.programId}${deploy ? ` (deployed in slot ${deploy.deploySlot}, ${deploy.elfBytes} bytes, sha256 ${deploy.elfSha256.slice(0, 12)}...)` : ""}\n   book account ${dn.bookAccount}\n   ${dn.txCount} transactions (${dn.failedCount} failed on purpose), fees ${dn.totalFeeLamports} lamports, median confirmed after ${dn.medianMs.confirmed} ms, finalized after ${dn.medianMs.finalized} ms`);
if (localRun) console.log(`   for comparison, a local test validator: median processed ${dn.local?.medianMs.processed} ms, confirmed ${dn.local?.medianMs.confirmed} ms, finalized ${dn.local?.medianMs.finalized} ms`);
if (dep) {
  console.log(`   deposits (${dep.cluster}):`);
  for (const r of dep.rows) console.log(`     ${r.label}: ${r.ok ? "ok" : "FAILED"}, credited ${r.credited}, amount ${r.amountLamports} lamports, processed ${r.processedAfterMs} ms, confirmed ${r.confirmedAfterMs} ms, finalized ${r.finalizedAfterMs} ms`);
}

// 4. trade flow
const swaps = read<{ swaps: SwapRec[]; capturedAt: string }>("recorded/swaps.json");
const flow = buildFlow(swaps.swaps, 60);
fs.writeFileSync("out/flow.json", JSON.stringify(flow));
console.log(`\n4. Trade flow: ${flow.recordedSwaps} real Orca SOL/USDC swaps recorded; dropped ${flow.droppedDust} dust swaps (< 0.01 SOL) and ${flow.droppedOutliers} price outliers; ${flow.swaps} swaps kept in execution order, in ${flow.windows.length} one-minute windows; tick rule agrees with the reported side on ${pct(flow.tickRule.share)} (${flow.tickRule.agree}/${flow.tickRule.total}); Roll spread ${f(flow.rollSpreadBps, 2)} bps; imbalance vs same-minute return correlation ${f(flow.corrSameWindow, 2)}, vs next minute ${f(flow.corrNextWindow, 2)}`);

if (live) {
  const { getAccount } = await import("./rpc.ts");
  const { decodePhoenixMarket, liveOrders, toLadder } = await import("./phoenix.ts");
  const { topOfBook } = await import("./microstructure.ts");
  const { readOrca } = await import("./orca.ts");
  const a = await getAccount("4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg");
  const mk = decodePhoenixMarket(a.bytes);
  const unix = Math.floor(Date.now() / 1000);
  const t = topOfBook(toLadder(liveOrders(mk.bids, a.slot, unix), 5), toLadder(liveOrders(mk.asks, a.slot, unix), 5));
  const o = await readOrca();
  console.log(`\nLIVE (slot ${a.slot}): Phoenix SOL/USDC bid ${t.bestBid} ask ${t.bestAsk} spread ${f(t.spreadBps, 1)} bps; Orca SOL/USDC price ${f(o.price, 3)}`);
}
console.log("\nwrote out/ladder.json, out/matching.json, out/devnet.json, out/flow.json");
