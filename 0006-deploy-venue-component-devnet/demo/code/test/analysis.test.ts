import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFlow, buildMatching, chronological, cleanSwaps, snapshotFeatures, type DevnetRun, type SwapRec } from "../src/analysis.ts";
import { readJson, exists } from "./helpers.ts";

const sw = (slot: number, price: number, side: "buy" | "sell", sol = 1): SwapRec => ({ t: 1000 + slot, slot, side, solAmount: sol, usdcAmount: sol * price, price, sig: `s${slot}-${price}` });

test("chronological puts each slot's swaps back in execution order and leaves slot order alone", () => {
  const input = [sw(1, 100, "buy"), sw(2, 103, "buy"), sw(2, 102, "buy"), sw(2, 101, "buy"), sw(3, 99, "sell")];
  assert.deepEqual(chronological(input).map((s) => s.price), [100, 101, 102, 103, 99]);
});

test("cleanSwaps drops dust and price outliers and says how many", () => {
  const input = [sw(1, 100, "buy"), sw(2, 100.2, "sell"), sw(3, 100.1, "buy"), sw(4, 100, "buy", 0.001), sw(5, 1826, "buy")];
  const c = cleanSwaps(input);
  assert.equal(c.kept.length, 3);
  assert.equal(c.dust, 1);
  assert.equal(c.outliers, 1);
});

test("flow windows conserve volume and the tick rule is right on a clean up-down sequence", () => {
  const swaps: SwapRec[] = [];
  for (let i = 0; i < 40; i++) swaps.push(sw(i + 1, 100 + (i % 2 ? -0.05 : 0.05) + i * 0.001, i % 2 ? "sell" : "buy"));
  const f = buildFlow(swaps, 10);
  const total = f.windows.reduce((a, w) => a + w.buyUsd + w.sellUsd, 0);
  const expected = swaps.reduce((a, s) => a + s.usdcAmount, 0);
  assert.ok(Math.abs(total - expected) < 1e-6);
  assert.ok(f.tickRule.share > 0.9);
  assert.equal(f.windows.reduce((a, w) => a + w.trades, 0), swaps.length);
});

test("snapshot features: a one-sided book has no spread and is measured from its only price", () => {
  const f = snapshotFeatures({ slot: 1, t: 1, bids: [], asks: [[10, 1], [10.05, 2]], orders: { bids: 0, asks: 2, expiredBids: 0, expiredAsks: 0 } }, null);
  assert.equal(f.top.spread, null);
  assert.equal(f.depth.find((d) => d.bps === 100)!.ask, 3);
  assert.equal(f.imbalance500, -1);
});

test("the recorded on-chain session replays exactly in the TypeScript engine", () => {
  for (const file of ["recorded/devnet-run.json", "recorded/local-run.json"]) {
    if (!exists(file)) continue;
    const m = buildMatching(readJson<DevnetRun>(file));
    assert.equal(m.allMatch, true, `${file}: engine logs equal chain logs on every step`);
    assert.equal(m.finalBookEqualsChain, true, `${file}: final book bytes equal the book account on chain`);
    assert.ok(m.steps.some((s) => !s.chainOk), "the session includes one rejected order");
    assert.ok(m.steps.some((s) => s.chainLogs.some((l) => l.startsWith("FILL"))), "the session includes fills");
  }
});

test("recorded devnet evidence is internally consistent", () => {
  const run = readJson<DevnetRun & { cluster: string }>("recorded/devnet-run.json");
  assert.equal(run.cluster, "devnet");
  assert.equal(run.mirrorEqual, true);
  const deploy = readJson<{ programId: string; elfSha256: string; elfBytes: number }>("recorded/devnet-deploy.json");
  assert.equal(deploy.programId, run.programId);
  assert.ok(run.txs.every((t) => t.signature.length >= 86 && t.signature.length <= 88), "base58 signatures");
  assert.equal(run.txs.filter((t) => !t.ok).length, 1, "exactly one transaction was rejected on purpose");
  const failed = run.txs.find((t) => !t.ok)!;
  assert.ok((failed.fee ?? 0) > 0, "a failed transaction still pays a fee");
});
