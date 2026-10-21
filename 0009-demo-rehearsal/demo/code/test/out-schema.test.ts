import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
const haveOut = existsSync(new URL("../out/walkthrough.json", import.meta.url));
const t = (name: string, fn: () => void) => test(name, { skip: !haveOut && "run npm run demo first" }, fn);
const J = (f: string) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);

test("recorded/devnet-reads.json: a real devnet read and a signature check, nothing sent", () => {
  const d = J("recorded/devnet-reads.json");
  assert.equal(d.cluster, "devnet");
  assert.ok(num(d.slot) && d.slot > 1_000_000);
  assert.equal(d.memoProgram.executable, true);
  assert.equal(d.signatureCheck.validSignature, "AccountNotFound");
  assert.equal(d.signatureCheck.flippedBit, "SignatureFailure");
  assert.equal(d.faucet.sent, false);
  assert.doesNotMatch(JSON.stringify(d), /seed|secret|private/i);
});

t("out/walkthrough.json: window, decisions and ledger agree with each other", () => {
  const w = J("out/walkthrough.json");
  assert.equal(w.events, w.decisions.length);
  assert.equal(w.scorecard.events, w.events);
  assert.equal(w.scorecard.accepted + w.scorecard.rejected, w.events);
  assert.equal(w.scorecard.fills + w.scorecard.skippedNoLaterSwap, w.scorecard.accepted);
  assert.equal(w.ledger.length, w.scorecard.fills);
  assert.match(w.scorecard.label, /Simulated, on recorded data; not advice/);
  for (const d of w.decisions) {
    assert.ok(num(d.order.sizeUsd) && num(d.order.price) && num(d.context.oraclePrice) && num(d.gapBps));
    assert.equal(d.decision.ok, d.decision.rule === null);
  }
  const rej = w.decisions.filter((d: { decision: { ok: boolean } }) => !d.decision.ok).length;
  assert.equal(rej, w.scorecard.rejected);
  assert.ok(w.failureTests.length === 4 && w.failureTests.every((f: { ok: boolean; injected: boolean }) => !f.ok && f.injected));
  assert.ok(w.window.swaps > 500 && w.window.toT > w.window.fromT);
  assert.equal(w.mode, "recorded");
});

t("out/*.json contain no NaN, undefined or Infinity text", () => {
  for (const f of ["walkthrough", "pitch", "rubric", "drill"]) assert.doesNotMatch(readFileSync(new URL(`../out/${f}.json`, import.meta.url), "utf8"), /NaN|undefined|Infinity/);
});

t("out/rubric.json: 12 checks, three criteria, the score adds up", () => {
  const r = J("out/rubric.json");
  assert.equal(r.checks.length, 12);
  assert.equal(r.result.points, r.checks.filter((c: { pass: boolean }) => c.pass).length);
  assert.equal(r.result.perCriterion.reduce((a: number, k: { points: number }) => a + k.points, 0), r.result.points);
});

t("out/drill.json and out/pitch.json have the structure the demos read", () => {
  const d = J("out/drill.json");
  assert.equal(d.steps.length, 5);
  assert.equal(d.policy.failuresToFallback, 3);
  const p = J("out/pitch.json");
  assert.equal(p.segments.reduce((a: number, s: { budgetSec: number }) => a + s.budgetSec, 0), p.totalSec);
  assert.equal(p.script.length, 4);
});
