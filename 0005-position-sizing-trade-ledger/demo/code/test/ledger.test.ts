import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { GENESIS, Ledger, reconcileWith, replay, type RowInput } from "../src/ledger.ts";
import type { LedgerRow } from "../src/types.ts";

const ok = { ok: true, rule: null, reason: "within all limits" } as const;
function row(side: "buy" | "sell", qty: number, price: number, fee: number, cash: number, pos: number): RowInput {
  return {
    t: 1, trigger: "signal-open", note: "t", activeBets: 1, targetFraction: 0.1, targetUsd: 100, currentUsd: 0,
    order: { side, sizeUsd: qty * price, price }, oraclePrice: price, oracleAgeSec: 1, verdict: ok,
    fill: { price, qtySol: qty, impactBps: 0, feeUsd: fee }, cashUsd: cash, posSol: pos, equityUsd: cash + pos * price,
  };
}
function build(): Ledger {
  const l = new Ledger();
  l.append(row("buy", 1, 100, 0.04, 10_000 - 100 - 0.04, 1));
  l.append(row("sell", 0.5, 110, 0.02, 10_000 - 100 - 0.04 + 55 - 0.02, 0.5));
  return l;
}

test("first row chains from the genesis hash, each row chains from the one before", () => {
  const l = build();
  assert.equal(l.rows[0]!.prevHash, GENESIS);
  assert.equal(l.rows[1]!.prevHash, l.rows[0]!.hash);
  assert.equal(l.rows[0]!.seq, 1);
  assert.equal(l.rows[1]!.seq, 2);
  assert.equal(l.headHash, l.rows[1]!.hash);
});
test("replay reconciles a clean ledger to the balance", () => {
  const r = replay(build().rows, 10_000);
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.ok(Math.abs(r.cashUsd - (10_000 - 100 - 0.04 + 55 - 0.02)) < 1e-9);
  assert.ok(Math.abs(r.posSol - 0.5) < 1e-12);
  assert.equal(r.fills, 2);
  assert.equal(r.rejected, 0);
});
test("editing a number in an old row is caught and the first bad row is named", () => {
  const rows = structuredClone([...build().rows]) as LedgerRow[];
  rows[0]!.fill!.price = 99;
  const r = replay(rows, 10_000);
  assert.equal(r.ok, false);
  assert.match(r.errors[0]!, /row 1: hash does not match/);
});
test("deleting a row breaks the chain", () => {
  const l = new Ledger();
  l.append(row("buy", 1, 100, 0, 9900, 1));
  l.append(row("buy", 1, 100, 0, 9800, 2));
  l.append(row("buy", 1, 100, 0, 9700, 3));
  const rows = [l.rows[0]!, l.rows[2]!];
  const r = replay(rows, 10_000);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /sequence|prevHash/.test(e)));
});
test("a balance that does not match the fills is reported even if hashes are recomputed", () => {
  const l = new Ledger();
  l.append(row("buy", 1, 100, 0, 9800, 1)); // cash should be 9900
  const r = replay(l.rows, 10_000);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /cash is 9800 but the fills add up to 9900/);
});
test("a rejected order moves no money", () => {
  const l = new Ledger();
  const rejected: RowInput = { ...row("buy", 1, 100, 0, 10_000, 0), fill: null, verdict: { ok: false, rule: "max-notional", reason: "x" } };
  l.append(rejected);
  const r = replay(l.rows, 10_000);
  assert.equal(r.ok, true);
  assert.equal(r.rejected, 1);
  assert.equal(r.cashUsd, 10_000);
});
test("reconcileWith compares the replay to balances read from token accounts", () => {
  const r = replay(build().rows, 10_000);
  assert.equal(reconcileWith(r, { cashUsd: r.cashUsd, posSol: 0.5 }).ok, true);
  const bad = reconcileWith(r, { cashUsd: r.cashUsd + 5, posSol: 0.5 });
  assert.equal(bad.ok, false);
  assert.ok(Math.abs(bad.cashDiffUsd - 5) < 1e-9);
});
test("append-only file: one JSON line per row, in order", () => {
  const dir = mkdtempSync(`${tmpdir()}/ledger-`);
  const l = new Ledger(`${dir}/l.jsonl`);
  l.append(row("buy", 1, 100, 0, 9900, 1));
  l.append(row("sell", 1, 100, 0, 10_000, 0));
  const lines = readFileSync(`${dir}/l.jsonl`, "utf8").trim().split("\n").map((x) => JSON.parse(x) as LedgerRow);
  assert.deepEqual(lines.map((x) => x.seq), [1, 2]);
  assert.equal(replay(lines, 10_000).ok, true);
});
test("the Ledger class has no way to edit or delete rows", () => {
  const l = build();
  assert.equal(typeof (l as unknown as Record<string, unknown>)["update"], "undefined");
  assert.equal(typeof (l as unknown as Record<string, unknown>)["delete"], "undefined");
  assert.equal(typeof (l as unknown as Record<string, unknown>)["push"], "undefined");
});
