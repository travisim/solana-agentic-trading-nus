import { test } from "node:test";
import assert from "node:assert/strict";
import { cusum, toTicks } from "../src/cusum.ts";

const px = (bpsMoves: number[], start = 100) => {
  let p = start;
  return [{ t: 0, price: p }, ...bpsMoves.map((m, i) => ({ t: i + 1, price: (p = p * (1 + m / 10_000)) }))];
};

test("fires exactly when the running total crosses the threshold, then resets", () => {
  const r = cusum(px([6, 6, 6, 6, 6, 6, 6]), 15); // +6 bps each: 6, 12, 18 -> fires on the 3rd move
  assert.deepEqual(r.events.map((e) => e.t), [3, 6]);
  assert.ok(r.events.every((e) => e.direction === "up"));
  assert.equal(r.series[3]!.sPos > 15, true);
  assert.equal(r.series[4]!.sPos < 7, true); // emptied after the event
});
test("down moves fill the other bucket", () => {
  const r = cusum(px([-10, -10]), 15);
  assert.deepEqual(r.events.map((e) => [e.t, e.direction]), [[2, "down"]]);
  assert.ok(r.series[2]!.sNeg < -15);
});
test("wiggles that cancel out never fire", () => {
  const r = cusum(px(Array.from({ length: 200 }, (_, i) => (i % 2 ? -9 : 9))), 15);
  assert.equal(r.events.length, 0);
});
test("below the threshold does not fire; just over does", () => {
  assert.equal(cusum([{ t: 0, price: 100 }, { t: 1, price: 100.14 }], 15).events.length, 0); // 14 bps
  assert.equal(cusum([{ t: 0, price: 100 }, { t: 1, price: 100.16 }], 15).events.length, 1);
});
test("stats: agent calls every tick versus on events", () => {
  const r = cusum(px([20, -20, 20, -20]), 15);
  assert.equal(r.stats.ticks, 5);
  assert.equal(r.stats.agentCallsEveryTick, 5);
  assert.equal(r.stats.agentCallsOnEvents, r.events.length);
  assert.equal(r.events.length, 4);
});
test("toTicks keeps the last price in each window", () => {
  const t = toTicks([{ t: 10, price: 1 }, { t: 10, price: 2 }, { t: 12, price: 3 }, { t: 19, price: 4 }, { t: 20, price: 5 }], 5);
  assert.deepEqual(t, [{ t: 10, price: 3 }, { t: 15, price: 4 }, { t: 20, price: 5 }]);
});
test("bad threshold is rejected", () => {
  assert.throws(() => cusum(px([1]), 0), /> 0/);
});
