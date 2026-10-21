import { test } from "node:test";
import assert from "node:assert/strict";
import { allTrades } from "../src/strategies/index.ts";
import { validateLedger } from "../src/ledger.ts";
import { seriesOf } from "./helpers.ts";

const ok = { capitalUsd: 1000, windowStartT: 0, windowEndT: 100, intervalSec: 10, trades: [{ strategy: "a", side: "long", openT: 1, closeT: 2, entry: 1, exit: 2, notionalUsd: 10, grossUsd: 1, legs: 2 }] };

test("validateLedger fills defaults and rejects bad shapes", () => {
  const l = validateLedger(structuredClone(ok));
  assert.equal(l.trades[0]!.paysSlippage, true);
  assert.equal(l.trades[0]!.id, 1);
  assert.throws(() => validateLedger({ ...ok, capitalUsd: 0 }), /above 0/);
  assert.throws(() => validateLedger({ ...ok, trades: [{ ...ok.trades[0], side: "up" }] }), /side/);
  assert.throws(() => validateLedger({ ...ok, trades: [{ ...ok.trades[0], closeT: 0 }] }), /closes before it opens/);
  assert.throws(() => validateLedger(null), /object/);
});
test("allTrades merges strategies, sorted by close time, ids 1..n", () => {
  const rows: [number, number, number][] = [];
  for (let i = 0; i < 400; i++) rows.push([100 + Math.sin(i / 5) + (i % 40 === 0 ? 0.3 : 0), 100 + Math.sin(i / 5 + 0.3), 100 + Math.sin(i / 5 + 0.1)]);
  const t = allTrades(seriesOf(rows));
  assert.ok(t.length > 5);
  assert.deepEqual(t.map((x) => x.id), t.map((_, i) => i + 1));
  for (let i = 1; i < t.length; i++) assert.ok(t[i]!.closeT >= t[i - 1]!.closeT);
  assert.ok(new Set(t.map((x) => x.strategy)).size >= 2);
});
