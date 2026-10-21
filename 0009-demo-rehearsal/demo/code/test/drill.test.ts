import { test } from "node:test";
import assert from "node:assert/strict";
import { DRILL_BUDGET_SEC, POLICY, drillSteps, nextState, runCalls } from "../src/drill.ts";

test("a good call keeps live and clears the failure count", () => {
  const s = nextState({ mode: "live", fails: 2 }, true);
  assert.deepEqual([s.mode, s.fails, s.action], ["live", 0, "continue"]);
});

test("first and second failures retry; the third failure in a row falls back to recorded", () => {
  const r = runCalls([false, false, false]);
  assert.deepEqual(r.map((x) => x.action), ["retry", "retry", "fallback"]);
  assert.equal(r[2]!.mode, "recorded");
  assert.equal(POLICY.failuresToFallback, 3);
});

test("failures must be in a row: a good call in between resets the count", () => {
  const r = runCalls([false, false, true, false, false]);
  assert.ok(r.every((x) => x.mode === "live"));
  assert.equal(r.at(-1)!.fails, 2);
});

test("once recorded, later calls do nothing (no flip-flopping on screen)", () => {
  const r = runCalls([false, false, false, true, false]);
  assert.deepEqual(r.slice(3).map((x) => [x.mode, x.action]), [["recorded", "none"], ["recorded", "none"]]);
});

test("the drill has five steps; steps 1 to 4 fit in the 30 second drill budget; the switch line names the recorded date", () => {
  const steps = drillSteps("2026-10-21");
  assert.equal(steps.length, 5);
  assert.equal(steps.slice(0, 4).reduce((a, s) => a + s.budgetSec, 0), DRILL_BUDGET_SEC);
  assert.match(steps[2]!.say, /2026-10-21/);
  assert.ok(steps.every((s) => s.say.length > 8 && s.do.length > 10));
});
