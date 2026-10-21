import { test } from "node:test";
import assert from "node:assert/strict";
import { luckBenchmark, normInv, rng, sharpeLike } from "../src/stats.ts";

test("normInv matches known values", () => {
  assert.ok(Math.abs(normInv(0.5)) < 1e-9);
  assert.ok(Math.abs(normInv(0.975) - 1.959964) < 1e-5);
  assert.ok(Math.abs(normInv(0.99) - 2.326348) < 1e-5);
  assert.ok(Math.abs(normInv(0.001) + 3.090232) < 1e-5);
});
test("rng: same seed, same numbers; different seed, different numbers", () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  assert.deepEqual(xs, ys);
  assert.notDeepEqual(xs, [c(), c(), c()]);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
});
test("sharpeLike: mean over standard deviation, null when there is too little to say", () => {
  assert.equal(sharpeLike([1, 2, 3]), null); // fewer than 4 trades
  assert.equal(sharpeLike([2, 2, 2, 2]), null); // no spread
  const s = sharpeLike([1, 3, 1, 3])!; // mean 2, sample sd 1.1547
  assert.ok(Math.abs(s - 2 / 1.1547005) < 1e-6);
});
test("luck benchmark: zero for one try, grows with the number of tries", () => {
  assert.equal(luckBenchmark(1, 1), 0);
  const a = luckBenchmark(5, 1), b = luckBenchmark(50, 1), c = luckBenchmark(500, 1);
  assert.ok(0 < a && a < b && b < c, `${a} ${b} ${c}`);
  assert.ok(Math.abs(b - 2.25) < 0.1, `50 tries of unit variance should expect a best near 2.2, got ${b}`); // known: E[max of 50 standard normals] is about 2.25
  assert.ok(Math.abs(luckBenchmark(50, 4) - 2 * b) < 1e-9, "scales with the standard deviation");
});
