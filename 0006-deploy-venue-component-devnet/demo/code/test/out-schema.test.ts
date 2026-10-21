import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readJson, exists } from "./helpers.ts";

// A clean checkout has no out/ yet: produce it from the recorded data first (offline, a second).
if (!exists("out/ladder.json")) execFileSync(process.execPath, ["src/demo.ts", "--recorded"], { stdio: "ignore" });

const finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const noBadNumbers = (o: unknown, path = "$"): void => {
  if (typeof o === "number") assert.ok(Number.isFinite(o), `${path} is not finite`);
  else if (Array.isArray(o)) o.forEach((x, i) => noBadNumbers(x, `${path}[${i}]`));
  else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) noBadNumbers(v, `${path}.${k}`);
};

test("out/*.json exist (run `npm run demo -- --recorded` first)", () => {
  for (const f of ["ladder", "matching", "devnet", "flow"]) assert.ok(exists(`out/${f}.json`), `out/${f}.json`);
});

test("ladder.json: markets, snapshots, features", () => {
  const d = readJson<{ markets: Array<{ name: string; cluster: string; address: string; snapshots: Array<{ slot: number; bids: number[][]; asks: number[][]; features: { top: { spreadBps: number | null }; depth: Array<{ bps: number }> } }> }> }>("out/ladder.json");
  noBadNumbers(d);
  assert.ok(d.markets.length >= 5);
  for (const m of d.markets) {
    assert.ok(m.snapshots.length >= 20, `${m.name} has many snapshots`);
    for (const s of m.snapshots) {
      assert.ok(finite(s.slot));
      assert.equal(s.features.depth.length, 6);
      for (let i = 1; i < s.bids.length; i++) assert.ok(s.bids[i - 1]![0]! >= s.bids[i]![0]!, "bids sorted");
      for (let i = 1; i < s.asks.length; i++) assert.ok(s.asks[i - 1]![0]! <= s.asks[i]![0]!, "asks sorted");
    }
  }
  assert.ok(d.markets.some((m) => m.cluster === "mainnet") && d.markets.some((m) => m.cluster === "devnet"));
});

test("matching.json and devnet.json describe the same session", () => {
  const m = readJson<{ steps: Array<{ signature: string; match: boolean }>; allMatch: boolean; source: { programId: string; bookAccount: string } }>("out/matching.json");
  const d = readJson<{ txs: Array<{ signature: string }>; programId: string; bookAccount: string; cluster: string; deploy: { deploySlot: number; programId: string } | null; deposits: { rows: Array<{ credited: boolean; ok: boolean | null }> } | null }>("out/devnet.json");
  noBadNumbers(m);
  noBadNumbers(d);
  assert.equal(m.allMatch, true);
  assert.deepEqual(m.steps.map((s) => s.signature), d.txs.map((t) => t.signature));
  assert.equal(m.source.programId, d.programId);
  assert.equal(m.source.bookAccount, d.bookAccount);
  assert.equal(d.cluster, "devnet");
  assert.equal(d.deploy?.programId, d.programId);
  assert.ok(d.deposits && d.deposits.rows.length >= 3);
  assert.ok(d.deposits!.rows.filter((r) => r.ok === false).every((r) => !r.credited), "a failed deposit is never credited");
});

test("flow.json: windows, tick rule, compact swaps", () => {
  const f = readJson<{ swapsCompact: number[][]; windows: Array<{ trades: number }>; swaps: number; tickRule: { agree: number; total: number; share: number }; droppedDust: number; droppedOutliers: number; recordedSwaps: number; rollSpread: number | null }>("out/flow.json");
  noBadNumbers(f);
  assert.equal(f.swapsCompact.length, f.swaps);
  assert.equal(f.windows.reduce((a, w) => a + w.trades, 0), f.swaps);
  assert.equal(f.recordedSwaps, f.swaps + f.droppedDust + f.droppedOutliers);
  assert.ok(f.tickRule.share > 0.9, "after putting each slot in execution order the tick rule is right on more than 90% of swaps");
  for (let i = 1; i < f.swapsCompact.length; i++) assert.ok(f.swapsCompact[i - 1]![4]! <= f.swapsCompact[i]![4]!, "slots never go backwards");
});
