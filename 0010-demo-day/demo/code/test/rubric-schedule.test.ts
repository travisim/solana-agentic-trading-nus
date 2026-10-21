import { test } from "node:test";
import assert from "node:assert/strict";
import { CRITERIA, NOT_SCORED, SCALE, TOTAL, total } from "../src/rubric.ts";
import { buildSchedule } from "../src/schedule.ts";

test("rubric weights add up to 100 and cover the five review criteria", () => {
  assert.equal(TOTAL, 100);
  assert.deepEqual(CRITERIA.map((c) => c.id), ["utility", "tests", "devnet", "explanation", "contribution"]);
  assert.ok(CRITERIA.every((c) => c.anchors.length === 5));
});

test("simulated returns carry no weight and no criterion", () => {
  assert.ok(NOT_SCORED.includes("simulated returns"));
  assert.ok(!CRITERIA.some((c) => /return|profit|pnl/i.test(c.id + c.label)));
});

test("total: all zero is 0, all max is 100, the weights apply", () => {
  const all = (n: number) => Object.fromEntries(CRITERIA.map((c) => [c.id, n]));
  assert.equal(total(all(0)), 0);
  assert.equal(total(all(SCALE.max)), 100);
  assert.equal(total({ ...all(0), utility: 4 }), 30);
  assert.equal(total({ ...all(0), tests: 2 }), 12.5);
  assert.equal(total({ ...all(2), explanation: 4 }), 50 - 5 + 10);
});

test("total clamps out-of-range scores and ignores unknown keys (returns cannot add points)", () => {
  assert.equal(total({ utility: 99, tests: -3, returns: 4 }), 30);
});

test("schedule: seven back-to-back 3+2 slots from 18:20 end at 18:55", () => {
  const s = buildSchedule();
  assert.equal(s.slots.length, 7);
  assert.equal(s.slots[0]!.start, "18:20");
  assert.equal(s.slots[0]!.demoEnds, "18:23");
  assert.equal(s.slots[0]!.end, "18:25");
  assert.equal(s.slots[6]!.start, "18:50");
  assert.equal(s.slots[6]!.end, "18:55");
  assert.equal(s.window, "18:20-18:55");
  assert.equal(s.peerGallery, "18:55-19:10");
});

test("schedule: projects fill slots in order and extra ones are counted as overflow", () => {
  const s = buildSchedule({ order: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] });
  assert.equal(s.slots[0]!.projectId, "a");
  assert.equal(s.slots[6]!.projectId, "g");
  assert.equal(s.overflow, 2);
  assert.equal(buildSchedule({ order: ["a"] }).slots[1]!.projectId, null);
});

test("schedule rejects bad input", () => {
  assert.throws(() => buildSchedule({ firstStart: "6pm" }));
  assert.throws(() => buildSchedule({ demoMin: 0 }));
});
