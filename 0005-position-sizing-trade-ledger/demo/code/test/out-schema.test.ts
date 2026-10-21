import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { replay } from "../src/ledger.ts";
import type { LedgerRow } from "../src/types.ts";
import { demoOutDir, outFile } from "./helpers.ts";

const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
const noBad = (o: unknown) => assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(o)));

test("out/ledger.json: rows replay, jsonl matches json", () => {
  const l = outFile<{ startUsd: number; rows: LedgerRow[]; replay: { ok: boolean } }>("ledger.json");
  assert.ok(l.rows.length >= 20);
  assert.equal(replay(l.rows, l.startUsd).ok, true);
  assert.equal(l.replay.ok, true);
  const jsonl = readFileSync(demoOutDir() + "ledger.jsonl", "utf8").trim().split("\n").map((x) => JSON.parse(x));
  assert.deepEqual(jsonl, l.rows);
  noBad(l);
});
test("out/equity.json: four runs, curves of [t, equity, exposure]", () => {
  const e = outFile<{ runs: { id: string; curve: number[][]; stats: Record<string, unknown> }[] }>("equity.json");
  assert.deepEqual(e.runs.map((r) => r.id), ["frictionless", "main", "small-cap", "sum"]);
  for (const r of e.runs) {
    assert.ok(r.curve.length >= 400);
    assert.ok(r.curve.every((p) => p.length === 3 && p.every(num)));
  }
  noBad(e);
});
test("out/concurrency.json: counts and uniqueness are in range", () => {
  const c = outFile<{ bets: { uniqueness: number; tOpen: number; tClose: number }[]; timeline: { open: number }[]; stats: { maxConcurrent: number } }>("concurrency.json");
  assert.ok(c.bets.length >= 20);
  assert.ok(c.bets.every((b) => b.uniqueness > 0 && b.uniqueness <= 1 && b.tClose > b.tOpen));
  assert.equal(Math.max(...c.timeline.map((x) => x.open)), c.stats.maxConcurrent);
  noBad(c);
});
test("out/sizing.json: curve is increasing, impact pairs and inventory present", () => {
  const s = outFile<{ curve: { p: number; m: number }[]; impact: { pairs: unknown[] }; inventory: { balances: unknown[] } }>("sizing.json");
  assert.equal(s.curve.length, 50);
  assert.ok(s.curve.every((c, i) => i === 0 || c.m > s.curve[i - 1]!.m));
  assert.equal(s.impact.pairs.length, 2);
  assert.equal(s.inventory.balances.length, 2);
  noBad(s);
});
