import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStaleness, isFresh } from "../src/staleness.ts";

// A healthy feed: published 1 s before each read, posted 2 slots before.
const reads = Array.from({ length: 20 }, (_, i) => ({ t: 1000 + i * 5, price: 100, confBps: 1, publishTime: 1000 + i * 5 - 1, postedSlot: 5000 + i * 12 - 2, currentSlot: 5000 + i * 12 }));

test("isFresh checks both age and slots", () => {
  assert.equal(isFresh(5, 10, { maxAgeSec: 30, maxSlotsBehind: 75 }), true);
  assert.equal(isFresh(31, 10, { maxAgeSec: 30, maxSlotsBehind: 75 }), false);
  assert.equal(isFresh(5, 76, { maxAgeSec: 30, maxSlotsBehind: 75 }), false);
  assert.equal(isFresh(30, 75, { maxAgeSec: 30, maxSlotsBehind: 75 }), true);
});
test("a healthy feed is never flagged, and the simulated freeze is caught", () => {
  const s = buildStaleness(reads, { maxAgeSec: 30, maxSlotsBehind: 75, faultAtFraction: 0.5 });
  const real = s.points.filter((p) => !p.simulated);
  assert.equal(real.length, 10);
  assert.ok(real.every((p) => p.ok && p.ageSec === 1 && p.slotsBehind === 2));
  const sim = s.points.filter((p) => p.simulated);
  assert.equal(sim.length, 10);
  assert.ok(!sim.at(-1)!.ok);
  assert.ok(sim.every((p) => p.publishTime === real.at(-1)!.publishTime && p.postedSlot === real.at(-1)!.postedSlot));
  assert.equal(s.injectedFault.simulated, true);
  assert.match(s.injectedFault.kind, /simulated/);
  assert.equal(s.stats.realStaleCount, 0);
  // age grows by 5 s per read after the freeze: the first read more than 30 s old is 25 s after the freeze (the frozen value was already 1 s + 5 s old)
  assert.equal(s.stats.firstStaleDetectedAfterFaultSec, 25);
});
test("slot lag alone can flag a price", () => {
  const r = reads.map((x, i) => (i === 3 ? { ...x, postedSlot: x.currentSlot - 200 } : x));
  const s = buildStaleness(r, { maxAgeSec: 30, maxSlotsBehind: 75, faultAtFraction: 0.9 });
  assert.equal(s.points[3]!.ok, false);
  assert.equal(s.points[3]!.slotsBehind, 200);
});
test("needs enough reads", () => {
  assert.throws(() => buildStaleness(reads.slice(0, 2), { maxAgeSec: 30, maxSlotsBehind: 75 }), /at least 3/);
});
