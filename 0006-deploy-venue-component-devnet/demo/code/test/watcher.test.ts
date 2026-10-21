import { test } from "node:test";
import assert from "node:assert/strict";
import { createLedger, wsUrlFor } from "../src/watcher.ts";

test("a deposit is credited at confirmed, not at processed", () => {
  const l = createLedger();
  assert.equal(l.onLog("sigA", 10, null, "processed", 1000).credited, false);
  assert.equal(l.onLog("sigA", 10, null, "confirmed", 1400).credited, true);
  const row = l.onLog("sigA", 10, null, "finalized", 1500);
  assert.deepEqual(row.seenAtMs, { processed: 1000, confirmed: 1400, finalized: 1500 });
  assert.equal(l.rows.size, 1);
});

test("a failed transaction is never credited, even when it is finalized", () => {
  const l = createLedger();
  l.onLog("sigB", 11, { InstructionError: [0, { Custom: 1 }] }, "processed", 1);
  l.onLog("sigB", 11, { InstructionError: [0, { Custom: 1 }] }, "confirmed", 2);
  const row = l.onLog("sigB", 11, { InstructionError: [0, { Custom: 1 }] }, "finalized", 3);
  assert.equal(row.ok, false);
  assert.equal(row.credited, false);
});

test("duplicate notifications do not move the first-seen time", () => {
  const l = createLedger();
  l.onLog("sigC", 5, null, "confirmed", 100);
  const row = l.onLog("sigC", 5, null, "confirmed", 999);
  assert.equal(row.seenAtMs.confirmed, 100);
});

test("websocket URL: https to wss; a local validator uses the next port", () => {
  assert.equal(wsUrlFor("https://api.devnet.solana.com"), "wss://api.devnet.solana.com");
  assert.equal(wsUrlFor("http://127.0.0.1:8899"), "ws://127.0.0.1:8900");
});
