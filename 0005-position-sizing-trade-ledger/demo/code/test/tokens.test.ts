import { test } from "node:test";
import assert from "node:assert/strict";
import { base58, decodeTokenAccount } from "../src/tokens.ts";
import { fixtureBytes, recorded } from "./helpers.ts";
import type { BalancesFile } from "../src/types.ts";

const SOL_VAULT = "EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9";

test("decodes a real SPL token account: wrapped SOL mint, owned by the Orca SOL/USDC pool", () => {
  const { bytes, owner } = fixtureBytes(SOL_VAULT);
  assert.equal(owner, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"); // the SPL Token program owns every token account
  const d = decodeTokenAccount(bytes);
  assert.equal(d.mint, "So11111111111111111111111111111111111111112");
  assert.equal(d.owner, "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE");
  assert.ok(d.amountRaw > 1_000_000_000_000n); // more than 1,000 SOL in the pool
});
test("base58 round trip on a known key", () => {
  const { bytes } = fixtureBytes(SOL_VAULT);
  assert.equal(base58(bytes.slice(0, 32)), "So11111111111111111111111111111111111111112");
});
test("rejects bytes that are not a token account", () => {
  assert.throws(() => decodeTokenAccount(new Uint8Array(10)), /not a token account/);
});
test("recorded balances file matches the decoder's output shape", () => {
  const f = recorded<BalancesFile>("token-balances.json");
  assert.equal(f.balances.length, 2);
  for (const b of f.balances) {
    assert.equal(b.amount, Number(BigInt(b.amountRaw)) / 10 ** b.decimals);
    assert.ok(b.slot > 459_000_000);
  }
});
