import { test } from "node:test";
import assert from "node:assert/strict";
import { SLIPPAGE_BUDGET_BPS, defaultFault, replayFault, retryCalls } from "../src/faults.ts";
import { checkOrder } from "../src/vendor/0002/risk.ts";
import { realSeries } from "./helpers.ts";

const series = realSeries();
const n = series.points.length;
const run = (kind: Parameters<typeof defaultFault>[0], guards = { dedupe: false, breaker: false }) => replayFault(series, defaultFault(kind, n), 3, guards);

test("no fault: every order is accepted and nothing is lost", () => {
  const r = replayFault(series, { ...defaultFault("none", n), kind: "none" }, 3);
  assert.ok(r.records.length > 70);
  assert.ok(r.records.every((x) => x.ok), "all within limits on calm recorded data");
});
test("stale oracle: the hook lets the first minute through and rejects every later order for age", () => {
  const r = run("stale-oracle");
  const w = r.records.filter((x) => x.inWindow);
  assert.ok(w.length === 10);
  const rejected = w.filter((x) => !x.ok);
  assert.ok(rejected.length >= 7);
  assert.ok(rejected.every((x) => x.rule === "max-oracle-age"));
  assert.ok(w.slice(0, 2).every((x) => x.ok), "age is still under 60 s for the first two orders");
  assert.ok(r.inWindow.lossUsd < r.inWindow.lossIfNoHookUsd);
});
test("stale oracle with a tighter age limit rejects sooner", () => {
  const loose = replayFault(series, defaultFault("stale-oracle", n), 3, { dedupe: false, breaker: false });
  const tight = replayFault(series, defaultFault("stale-oracle", n), 3, { dedupe: false, breaker: false }, { maxNotionalUsd: 1000, maxOracleGapBps: 50, maxOracleAgeSec: 20 });
  assert.ok(tight.inWindow.accepted < loose.inWindow.accepted);
});
test("RPC outage: frozen prices, the hook catches it by oracle age after a minute", () => {
  const r = run("rpc-outage");
  assert.deepEqual(Object.keys(r.inWindow.byRule), ["max-oracle-age"]);
  assert.ok(r.inWindow.accepted > 0 && r.inWindow.accepted <= 3);
});
test("slippage shock and fee change: the hook is blind (this is the test that should fail until you add a rule)", () => {
  for (const kind of ["slippage-shock", "fee-change"] as const) {
    const r = run(kind);
    assert.equal(r.inWindow.rejected, 0, kind);
    assert.ok(r.inWindow.lossUsd > 0, kind);
  }
});
test("circuit breaker halts after 3 fills worse than the slippage budget", () => {
  const r = run("slippage-shock", { dedupe: false, breaker: true });
  assert.equal(r.inWindow.accepted, 3);
  assert.deepEqual(r.inWindow.byRule, { "circuit-breaker": 7 });
  assert.ok(40 > SLIPPAGE_BUDGET_BPS);
  assert.ok(r.inWindow.lossUsd < run("slippage-shock").inWindow.lossUsd);
});
test("duplicate submission: the stateless hook accepts both copies; an idempotency guard blocks the second", () => {
  const hookOnly = run("duplicate-submission");
  assert.equal(hookOnly.inWindow.orders, 20);
  assert.equal(hookOnly.inWindow.accepted, 20);
  assert.equal(hookOnly.inWindow.exposureUsd, 5000);
  const fixed = run("duplicate-submission", { dedupe: true, breaker: false });
  assert.equal(fixed.inWindow.accepted, 10);
  assert.deepEqual(fixed.inWindow.byRule, { "duplicate-order": 10 });
});
test("back-off makes far fewer calls than a one-second retry during a 5 minute 429 outage", () => {
  const c = retryCalls(300);
  assert.equal(c.naive, 300);
  assert.ok(c.backoff < 20);
  assert.equal(retryCalls(0).backoff, 0);
});
test("the vendored risk hook itself is unchanged: stale oracle is rejected at 61 s, accepted at 60 s", () => {
  const o = { side: "buy" as const, sizeUsd: 100, price: 100 };
  assert.equal(checkOrder(o, { oraclePrice: 100, oracleAgeSec: 61 }).rule, "max-oracle-age");
  assert.equal(checkOrder(o, { oraclePrice: 100, oracleAgeSec: 60 }).ok, true);
});
