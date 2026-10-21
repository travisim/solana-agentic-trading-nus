import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBreak, gapSeries } from "../src/breaks.ts";
import { realSeries } from "./helpers.ts";

const P = { warmup: 60, k: 0.5, h: 5 };
test("healthy recorded feed: no alarm over the whole 40 minutes", () => {
  assert.equal(detectBreak(gapSeries(realSeries(), null), P).alarmTick, null);
});
test("simulated freeze: alarm fires after the freeze and within two minutes", () => {
  const r = detectBreak(gapSeries(realSeries(), 288), P);
  assert.ok(r.alarmTick !== null && r.alarmTick >= 288 && r.alarmTick - 288 <= 24, `alarm at ${r.alarmTick}`);
});
test("a bigger market move after the freeze raises the alarm sooner", () => {
  const a = detectBreak(gapSeries(realSeries(), 288, 0), P).alarmTick!, b = detectBreak(gapSeries(realSeries(), 288, 5), P).alarmTick!;
  assert.ok(b <= a);
});
test("constructed series: a level shift of 5 standard deviations is caught within a few samples, a flat line never", () => {
  const flat = Array.from({ length: 200 }, (_, i) => (i % 2 ? 1 : -1));
  assert.equal(detectBreak(flat, P).alarmTick, null);
  const shifted = flat.map((v, i) => (i >= 100 ? v + 5 : v));
  const r = detectBreak(shifted, P);
  assert.ok(r.alarmTick !== null && r.alarmTick >= 100 && r.alarmTick < 106, `${r.alarmTick}`);
});
