import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterSwaps, swapFromTx, type ParsedTx, type Vaults } from "../src/swaps.ts";
import { swapsOf } from "./helpers.ts";
import { decodePythPrice, PYTH_RECEIVER_PROGRAM, SOL_USD_ACCOUNT, SOL_USD_FEED_ID } from "../src/pyth.ts";
import { fixtureBytes } from "./helpers.ts";

// Real getTransaction responses (jsonParsed) for one buy and one sell on the Orca SOL/USDC pool, captured 2026-10-21 from public RPC.
const fx = JSON.parse(readFileSync(new URL("./fixtures/swap-transactions.json", import.meta.url), "utf8")) as Record<"buy" | "sell", { expected: unknown; tx: ParsedTx }>;
const vaults: Vaults = { solVault: "EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9", usdcVault: "2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP" };

test("a real buy and a real sell are decoded from the pool vault balance changes", () => {
  for (const side of ["buy", "sell"] as const) {
    const exp = fx[side].expected as { sig: string; side: string };
    const swap = swapFromTx(exp.sig, fx[side].tx, vaults);
    assert.deepEqual(swap, exp);
    assert.equal(swap!.side, side);
    assert.ok(swap!.price > 50 && swap!.price < 300);
  }
});
test("a failed transaction is not a swap", () => {
  const tx = structuredClone(fx.buy.tx);
  tx.meta!.err = { InstructionError: [0, "Custom"] };
  assert.equal(swapFromTx("x", tx, vaults), null);
});
test("vault balances that move the same way (liquidity change) are not a swap", () => {
  const tx = structuredClone(fx.buy.tx);
  const idx = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey)).indexOf(vaults.usdcVault);
  const post = tx.meta!.postTokenBalances!.find((b) => b.accountIndex === idx)!;
  const pre = tx.meta!.preTokenBalances!.find((b) => b.accountIndex === idx)!;
  // make the USDC vault move in the same direction as the SOL vault
  const d = Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount);
  post.uiTokenAmount.amount = String(Number(pre.uiTokenAmount.amount) - d);
  assert.equal(swapFromTx("x", tx, vaults), null);
});
test("a transaction that does not touch the vaults is not a swap", () => {
  assert.equal(swapFromTx("x", fx.buy.tx, { solVault: "11111111111111111111111111111111", usdcVault: "22222222222222222222222222222222" }), null);
});
test("Pyth: decodes a real captured PriceUpdateV2 account (publish time and posted slot)", () => {
  const acc = fixtureBytes(SOL_USD_ACCOUNT);
  assert.equal(acc.owner, PYTH_RECEIVER_PROGRAM);
  const p = decodePythPrice(acc.bytes);
  assert.equal(p.feedId, SOL_USD_FEED_ID);
  assert.equal(p.publishTime, 1792602786);
  assert.equal(p.postedSlot, 459709268);
  assert.throws(() => decodePythPrice(new Uint8Array(200)), /not a Pyth/);
});
test("filterSwaps drops dust and price outliers, and nothing else", () => {
  const rows: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [100 + i, 100 + (i % 3) * 0.01, 500]);
  rows[10] = [110, 5753, 500]; // a transaction that did more than one thing
  rows[20] = [120, 100, 0.5]; // dust
  const all = swapsOf(rows);
  const { kept, dust, outliers, duplicates } = filterSwaps([...all, all[0]!]); // one swap listed twice
  assert.equal(duplicates, 1);
  assert.equal(dust, 1);
  assert.equal(outliers, 1);
  assert.equal(kept.length, 28);
  assert.ok(kept.every((s) => s.price < 101 && s.usdcAmount >= 1));
});
