// npm run demo            -> uses bundled recorded data (default, no network)
// npm run demo -- --live  -> presenter option: reads one fresh Pyth SOL/USD price and the current mainnet slot, and shows what the risk hook says about it
// Options: --threshold-usd N  --cusum-bps N  --usd-per-bps N  --fee-bps N  --max-notional N  --out DIR
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_PARAMS, failureTests, runAgent } from "./agent.ts";
import { POLICY, drillSteps, runCalls } from "./drill.ts";
import { buildScript, scriptTotalSec } from "./pitch.ts";
import { readPythOnce } from "./live.ts";
import { checks as rubricChecks, CRITERIA, score, type DemoPack } from "./rubric.ts";
import { CHECKS, QA_SEC, SEGMENTS, TOTAL_SEC, timingVerdict } from "./timer.ts";
import { checkOrder } from "./risk.ts";
import { RateLimitError } from "./rpc.ts";
import { filterSwaps } from "./clean.ts";
import { overlapWindow } from "./agent.ts";
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
const outDir = flag("out") ?? `${root}out/`;
const readJson = <T>(f: string): T => JSON.parse(readFileSync(`${root}${f}`, "utf8")) as T;
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const hms = (t: number) => new Date(t * 1000).toISOString().slice(11, 19);

const params = {
  ...DEFAULT_PARAMS,
  thresholdUsd: num("threshold-usd", DEFAULT_PARAMS.thresholdUsd),
  cusumBps: num("cusum-bps", DEFAULT_PARAMS.cusumBps),
  usdPerBps: num("usd-per-bps", DEFAULT_PARAMS.usdPerBps),
  feeBps: num("fee-bps", DEFAULT_PARAMS.feeBps),
  limits: { ...DEFAULT_PARAMS.limits, maxNotionalUsd: num("max-notional", DEFAULT_PARAMS.limits.maxNotionalUsd) },
};
const swapFile = readJson<SwapFile>("recorded/swaps.json");
const pyth = readJson<PythReads>("recorded/pyth-reads.json");
const devnet = readJson<{ capturedAt: string; slot: number; version: string; signatureCheck: { validSignature: string; flippedBit: string }; throwawayAddress: string }>("recorded/devnet-reads.json");
let mode: "recorded" | "live" = "recorded";

// ---- 0. live (optional): one fresh oracle read through the same risk hook ---------------------
if (process.argv.includes("--live")) {
  try {
    const r = await readPythOnce();
    mode = "live";
    console.log(`Live: Pyth SOL/USD ${r.price.toFixed(2)} (age ${r.ageSec} s, slot ${fmt(r.currentSlot)}).`);
    const d = checkOrder({ side: "buy", sizeUsd: 250, price: r.price }, { oraclePrice: r.price, oracleAgeSec: r.ageSec }, params.limits);
    console.log(`  a 250 USD buy at the oracle price -> ${d.ok ? "ACCEPT" : "REJECT [" + d.rule + "] " + d.reason}\n  (the walk-through below still uses the recorded window.)\n`);
  } catch (e) {
    console.log(`!! live read failed: ${e instanceof RateLimitError ? e.message : (e as Error).message}\n!! Falling back to --recorded data so you can keep going.\n`);
  }
}

// ---- 1. the sample project: bars -> change alert -> order -> risk hook -> ledger -> scorecard ---
const run = runAgent(swapFile.swaps, pyth.reads, params);
const sc = run.scorecard;
console.log(`Sample project (${mode === "live" ? "live check + " : ""}recorded data, ${swapFile.capturedAt.slice(0, 10)})   Pyth + Orca SOL/USDC, ${hms(run.window.fromT)} to ${hms(run.window.toT)} UTC`);
console.log(`  ${fmt(run.window.swaps)} real swaps -> ${run.bars} dollar bars (${fmt(params.thresholdUsd)} USD) -> ${run.events} change alerts (${params.cusumBps} bps)`);
console.log(`  risk limits: ${fmt(params.limits.maxNotionalUsd)} USD per order, ${params.limits.maxOracleGapBps} bps from oracle, ${params.limits.maxOracleAgeSec} s oracle age\n`);
console.log("   #  time      side  size USD  vs oracle  decision");
for (const d of run.decisions) {
  console.log(`  ${String(d.n).padStart(2)}  ${hms(d.t)}  ${d.order.side.padEnd(4)}  ${String(d.order.sizeUsd).padStart(8)}  ${(d.gapBps.toFixed(1) + " bps").padStart(9)}  ${d.decision.ok ? "ACCEPT" : `REJECT [${d.decision.rule}] ${d.decision.reason}`}`);
}
console.log(`\nLedger: ${sc.fills} fills (fee ${params.feeBps} bps assumed, fill = next swap price). Scorecard, ${sc.label}:`);
console.log(`  accepted ${sc.accepted}, rejected ${sc.rejected} (${Object.entries(sc.rejectedByRule).map(([r, n]) => `${n} ${r}`).join(", ") || "none"})`);
console.log(`  net ${sc.pnlNetUsd.toFixed(2)} USD at the last price ${sc.markPrice.toFixed(2)}, hit rate ${(sc.hitRate * 100).toFixed(0)}%, max drawdown ${sc.maxDrawdownUsd.toFixed(2)} USD, position ${sc.positionSol} SOL`);
console.log("  (Judges do not score this. They score utility, tests and devnet evidence.)");

// ---- 2. the failure test --------------------------------------------------------------------
const ctx0 = run.decisions[0]!.context;
const failures = failureTests(ctx0, params.limits);
console.log(`\nFailure test (injected bad orders, oracle ${ctx0.oraclePrice.toFixed(2)}):`);
for (const f of failures) console.log(`  ${f.ok ? "ACCEPT (BUG!)" : "REJECT"}  ${f.label.padEnd(30)} [${f.rule}] ${f.reason}`);
if (failures.some((f) => f.ok)) throw new Error("failure test failed: the risk hook accepted a bad order");

// ---- 3. the pitch: budget, sample script and its length --------------------------------------
const devnetSimOk = devnet.signatureCheck.validSignature === "AccountNotFound" && devnet.signatureCheck.flippedBit === "SignatureFailure";
const script = buildScript(run, failures.length, devnetSimOk);
const est = scriptTotalSec(script);
console.log(`\nThe 3-minute pitch: ${SEGMENTS.map((s) => `${s.label} ${s.budgetSec} s`).join(" + ")} = ${TOTAL_SEC} s, then ${QA_SEC} s of questions`);
for (const p of script) console.log(`  ${p.label.padEnd(15)} ${String(p.words).padStart(3)} words ~ ${String(p.estSec).padStart(2)} s of ${p.budgetSec} s  ${p.fits ? "fits" : "TOO LONG"}`);
console.log(`  sample script total ~ ${est} s of ${TOTAL_SEC} s (130 words a minute)`);
const sample = timingVerdict(Object.fromEntries(script.map((p) => [p.id, p.estSec])));
console.log(`  timing verdict for the script read at that pace: ${sample.pass ? "PASS" : "FAIL"}`);

// ---- 4. what the judge sees: the demo pack for this sample project -------------------------
const reportPath = `${root}out/test-report.txt`;
let testReport: DemoPack["testReport"] = null;
if (existsSync(reportPath)) {
  const txt = readFileSync(reportPath, "utf8");
  const pass = /^# pass (\d+)/m.exec(txt);
  const fail = /^# fail (\d+)/m.exec(txt);
  if (pass && fail) testReport = { passing: Number(pass[1]), failing: Number(fail[1]) };
}
const pack: DemoPack = {
  name: "risk-hooked agent (sample)",
  lane: "agent",
  problemStatement: script[0]!.text.split(". ")[0] + ".",
  cleanCheckout: true, // npm install, npm test, npm run demo -- --recorded: see DRY-RUN-EVIDENCE.md
  endToEndExample: run.decisions.length > 0,
  limitations: ["simulated on recorded data", "17 minutes of one afternoon", "order sizes and fee are assumptions", "no funded devnet transaction yet"],
  testReport,
  failureTest: failures.every((f) => !f.ok),
  testsRunOnRecorded: true,
  testReportMatchesFrozenCommit: false, // the sample is not frozen; a real team sets this at the 19:55 freeze
  devnetAddressOrNoneStated: true, // no deployed program: an off-chain agent, stated in the pack
  devnetTxLinkOpens: false, // the faucet refused the airdrop (HTTP 429), so there is no funded transaction yet
  claimMatchesLink: false,
  readsLabelledMainnetWritesDevnet: true,
  simulatedReturnClaimed: false,
};
const judged = score(pack);
console.log(`\nWhat the judge sees (sample demo pack): ${judged.points} of ${judged.outOf} checks`);
for (const k of judged.perCriterion) console.log(`  ${k.label.padEnd(15)} ${k.points} / ${k.outOf}`);
console.log(`  missing: ${judged.missing.length ? judged.missing.join(", ") : "none"}   ${judged.returnsNote}`);
console.log(`  test report: ${testReport ? `${testReport.passing} passing, ${testReport.failing} failing` : "not found (run npm run report first)"}`);

// ---- 5. switch drill ---------------------------------------------------------------------------
const calls = runCalls([true, true, false, false, false, true]);
console.log(`\nSwitch drill (rule: ${POLICY.failuresToFallback} failures in a row -> recorded): ${calls.map((c) => c.action).join(", ")}`);

// ---- 6. write out/*.json (the files the lab demos read) -----------------------------------
mkdirSync(outDir, { recursive: true });
const write = (name: string, data: unknown) => writeFileSync(`${outDir}${name}`, JSON.stringify(data, null, 1) + "\n");
const recordedDate = swapFile.capturedAt.slice(0, 10);
write("walkthrough.json", {
  mode,
  capturedAt: swapFile.capturedAt,
  source: `${swapFile.source}; Pyth reads from recorded/pyth-reads.json`,
  pair: "SOL/USDC",
  ...run,
  failureTests: failures,
  note: `${sc.label}. No order is sent anywhere. Fill = next swap price after the alert; fee is an assumption.`,
});
// Compact inputs for the lab demos (so the browser can re-run the agent with other settings): [t, price, usdcAmount] and [t, price, publishTime]
write("inputs.json", {
  note: "Cleaned swaps inside the Pyth window and the Pyth reads, compact. The lab demos re-run the agent on these.",
  swaps: overlapWindow(filterSwaps(swapFile.swaps).kept, pyth.reads).map((s) => [s.t, s.price, s.usdcAmount]),
  reads: pyth.reads.map((r) => [r.t, r.price, r.publishTime]),
});
write("pitch.json", {
  segments: SEGMENTS,
  totalSec: TOTAL_SEC,
  qaSec: QA_SEC,
  wordsPerMinute: 130,
  script,
  scriptEstSec: est,
  checks: CHECKS,
  sampleTiming: sample,
});
write("rubric.json", {
  criteria: CRITERIA,
  checks: rubricChecks(pack),
  pack,
  result: judged,
  devnet: { capturedAt: devnet.capturedAt, slot: devnet.slot, version: devnet.version, throwawayAddress: devnet.throwawayAddress, signatureCheck: devnet.signatureCheck },
});
write("drill.json", {
  policy: POLICY,
  recordedDate,
  steps: drillSteps(recordedDate),
  example: { outcomes: [true, true, false, false, false, true], states: calls },
});
console.log(`\nWrote walkthrough.json, inputs.json, pitch.json, rubric.json, drill.json to ${outDir}`);
