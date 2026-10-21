import { test } from "node:test";
import assert from "node:assert/strict";
import { replay } from "../src/ledger.ts";
import { DEFAULT_RUN, oracleAgeProxy, simulate } from "../src/simulate.ts";
import { makeSignals } from "../src/signals.ts";
import type { ImpactFile, Series } from "../src/types.ts";
import { recorded, seriesOf, toyQuotes } from "./helpers.ts";

const series = recorded<Series>("series.json");
const quotes = recorded<ImpactFile>("jupiter-impact.json").pairs[0]!.quotes;

test("oracleAgeProxy counts seconds since the oracle value last changed", () => {
  assert.deepEqual(oracleAgeProxy(seriesOf([1, 1, 1, 2, 2, 3])), [0, 5, 10, 0, 5, 0]);
});
test("signals: a flat series gives none, a sharp move gives a signal on the right side with p in (0.5, 0.95)", () => {
  const flat = seriesOf(Array(80).fill(100));
  assert.equal(makeSignals(flat).length, 0);
  const prices = Array.from({ length: 80 }, (_, i) => 100 + (i % 2) * 0.01);
  for (let i = 60; i < 80; i++) prices[i] = 100 + (i - 59) * 0.2; // jump up at the end
  const sigs = makeSignals(seriesOf(prices));
  assert.ok(sigs.length >= 1);
  assert.ok(sigs.every((s) => s.side === 1 && s.p > 0.5 && s.p < 0.95));
});
test("recorded run: the ledger replays and reconciles to the equity curve", () => {
  const run = simulate(series, quotes, DEFAULT_RUN);
  const r = replay(run.ledger.rows, DEFAULT_RUN.sizing.startUsd);
  assert.equal(r.ok, true, r.errors.join("; "));
  const last = run.equity.at(-1)!;
  assert.ok(Math.abs(last.cashUsd - r.cashUsd) < 1e-5);
  assert.ok(Math.abs(last.posSol - r.posSol) < 1e-8);
  assert.equal(run.stats.filled, r.fills);
  assert.equal(run.stats.rejected, r.rejected);
});
test("the risk hook gates every order: no accepted order is over the notional limit, rejected orders have no fill", () => {
  const run = simulate(series, quotes, DEFAULT_RUN);
  for (const row of run.ledger.rows) {
    if (row.verdict.ok) assert.ok(row.order.sizeUsd <= DEFAULT_RUN.limits.maxNotionalUsd + 0.01);
    else assert.equal(row.fill, null);
  }
});
test("the two injected bad orders are rejected with the right rule and flagged as injected", () => {
  const run = simulate(series, quotes, DEFAULT_RUN);
  const inj = run.ledger.rows.filter((r) => r.trigger === "injected");
  assert.equal(inj.length, 2);
  assert.deepEqual(inj.map((r) => r.verdict.rule), ["max-notional", "unit-sanity"]);
  assert.ok(inj.every((r) => !r.verdict.ok && /INJECTED/.test(r.note)));
  assert.equal(simulate(series, quotes, { ...DEFAULT_RUN, injected: false }).ledger.rows.filter((r) => r.trigger === "injected").length, 0);
});
test("exposure never goes over the cap by more than one order's rounding", () => {
  const run = simulate(series, quotes, DEFAULT_RUN);
  const cap = DEFAULT_RUN.sizing.maxFraction * 1.01 * Math.max(...run.equity.map((e) => e.equityUsd));
  assert.ok(run.stats.maxAbsExposureUsd <= cap, `${run.stats.maxAbsExposureUsd} > ${cap}`);
});
test("costs lower the final equity; same orders, so fees explain the whole difference within impact", () => {
  const free = simulate(series, quotes, { ...DEFAULT_RUN, feeBps: 0, useImpact: false });
  const paid = simulate(series, quotes, DEFAULT_RUN);
  const diff = free.stats.finalEquityUsd - paid.stats.finalEquityUsd;
  assert.ok(diff > 0);
  assert.ok(Math.abs(diff - (paid.stats.feesUsd + paid.stats.impactCostUsd)) < 0.05, `diff ${diff}`);
});
test("summing overlapping bets reaches a bigger position than averaging them", () => {
  const avg = simulate(series, quotes, DEFAULT_RUN);
  const sum = simulate(series, quotes, { ...DEFAULT_RUN, combine: "sum" });
  assert.ok(Math.max(...sum.exposure.map((e) => Math.abs(e.sum))) > Math.max(...avg.exposure.map((e) => Math.abs(e.average))));
  assert.ok(sum.stats.rejected > avg.stats.rejected); // the hook has to stop the oversized orders
});
test("an impact cap cuts a big order on a thin curve", () => {
  const run = simulate(series, toyQuotes, { ...DEFAULT_RUN, sizing: { ...DEFAULT_RUN.sizing, maxImpactBps: 0.5 } });
  assert.ok(run.stats.cappedByImpact > 0);
});
test("deterministic: two runs give the same head hash", () => {
  assert.equal(simulate(series, quotes, DEFAULT_RUN).ledger.headHash, simulate(series, quotes, DEFAULT_RUN).ledger.headHash);
});
