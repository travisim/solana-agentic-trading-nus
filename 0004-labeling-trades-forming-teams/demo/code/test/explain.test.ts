import { test } from "node:test";
import assert from "node:assert/strict";
import { roll, spanText } from "../src/agent.ts";
import { checkReason, parseReason } from "../src/explain.ts";

const truth = { momBps: 4.1, ratio: 1.8, gapBps: 0.6 };

test("parseReason reads the direction, size, noise ratio and venue gap from plain text", () => {
  const c = parseReason("Buy: SOL rose 4.1 bps in the last 60 s, 1.8x the recent noise, so follow the move. The two venues agree within 0.6 bps.");
  assert.deepEqual(c, { word: "rose", momBps: 4.1, ratio: 1.8, gapWithinBps: 0.6 });
});

test("a true reason passes", () => {
  const r = checkReason("Buy: SOL rose 4.1 bps in the last 60 s, 1.8x the recent noise, so follow the move. The two venues agree within 0.6 bps.", truth);
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
});

test("a flipped direction is caught", () => {
  const r = checkReason("Sell: SOL fell 4.1 bps in the last 60 s, 1.8x the recent noise, so follow the move.", truth);
  assert.equal(r.ok, false);
  assert.match(r.problems[0]!, /says it fell/);
});

test("an exaggerated size is caught (both the bps and the noise ratio)", () => {
  const r = checkReason("Buy: SOL rose 10.3 bps in the last 60 s, 4.5x the recent noise, so follow the move.", truth);
  assert.equal(r.problems.length, 2);
});

test("an understated venue gap is caught; a looser claim is fine", () => {
  assert.equal(checkReason("Buy: SOL rose 4.1 bps in the last 60 s, 1.8x the recent noise. The two venues agree within 0.1 bps.", truth).ok, false);
  assert.equal(checkReason("Buy: SOL rose 4.1 bps in the last 60 s, 1.8x the recent noise. The two venues agree within 2.0 bps.", truth).ok, true);
});

test("rounding to one decimal is tolerated", () => {
  assert.equal(checkReason("Buy: SOL rose 4.0 bps in the last 60 s, 1.8x the recent noise.", { ...truth, momBps: 4.04 }).ok, true);
});

test("text with no facts in it is reported, not passed", () => {
  const r = checkReason("Buy because it feels right.", truth);
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 3);
});

test("roll is deterministic and spread out; spanText uses seconds or bars", () => {
  assert.equal(roll(5, 7), roll(5, 7));
  assert.notEqual(roll(5, 7), roll(6, 7));
  const hits = Array.from({ length: 1000 }, (_, i) => roll(i, 7) % 100).filter((x) => x < 20).length;
  assert.ok(hits > 150 && hits < 250, `about 20% expected, got ${hits}/1000`);
  assert.equal(spanText(12, 5), "60 s");
  assert.equal(spanText(12, null), "12 bars");
});
