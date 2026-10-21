import { test } from "node:test";
import assert from "node:assert/strict";
import { CHECKS, QA_SEC, SEGMENTS, TOTAL_SEC, evaluateChecks, segStatus, timingVerdict } from "../src/timer.ts";

test("the four parts add up to exactly 3 minutes; questions are 2 minutes", () => {
  assert.equal(SEGMENTS.length, 4);
  assert.equal(TOTAL_SEC, 180);
  assert.equal(QA_SEC, 120);
  assert.deepEqual(SEGMENTS.map((s) => s.id), ["problem", "what", "proof", "next"]);
});

test("segStatus: ok, short, over (up to 10 s), way-over, missing", () => {
  assert.equal(segStatus(30, 30), "ok");
  assert.equal(segStatus(15, 30), "ok"); // exactly half is still fine
  assert.equal(segStatus(14, 30), "short");
  assert.equal(segStatus(31, 30), "over");
  assert.equal(segStatus(40, 30), "over");
  assert.equal(segStatus(41, 30), "way-over");
  assert.equal(segStatus(null, 30), "missing");
  assert.equal(segStatus(NaN, 30), "missing");
});

test("a rehearsal exactly on budget passes", () => {
  const v = timingVerdict({ problem: 30, what: 35, proof: 75, next: 40 });
  assert.equal(v.totalSec, 180);
  assert.equal(v.pass, true);
});

test("one part way over fails even if the total is fine", () => {
  const v = timingVerdict({ problem: 60, what: 20, proof: 60, next: 30 });
  assert.equal(v.totalSec, 170);
  assert.equal(v.underTotal, true);
  assert.equal(v.noWayOver, false);
  assert.equal(v.pass, false);
});

test("going over 3:00 fails; missing parts do not pass", () => {
  assert.equal(timingVerdict({ problem: 35, what: 40, proof: 80, next: 40 }).pass, false); // 195 s
  assert.equal(timingVerdict({ problem: 30, what: 35, proof: 75 }).pass, false);
});

test("evaluateChecks: timing checks come from the timer, content checks from listeners", () => {
  const log = { problem: 30, what: 35, proof: 75, next: 40 };
  const none = evaluateChecks(log, {});
  assert.equal(none.verdict, "not finished");
  assert.equal(none.results.find((r) => r.id === "t-total")!.pass, true);
  assert.equal(none.open, CHECKS.length - 2);
  const all = Object.fromEntries(CHECKS.filter((c) => c.kind === "content").map((c) => [c.id, true]));
  assert.equal(evaluateChecks(log, all).verdict, "ready");
  assert.equal(evaluateChecks(log, { ...all, "c-limit": false }).verdict, "fix and rerun");
  assert.equal(evaluateChecks({ problem: 90, what: 35, proof: 75, next: 40 }, all).verdict, "fix and rerun");
});

test("the check list includes no-return-claim and a limitation", () => {
  const ids = CHECKS.map((c) => c.id);
  assert.ok(ids.includes("c-returns") && ids.includes("c-limit") && ids.includes("c-devnet") && ids.includes("c-failure"));
});
