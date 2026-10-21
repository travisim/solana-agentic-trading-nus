import { test } from "node:test";
import assert from "node:assert/strict";
import { activeAt, averageUniqueness, concurrentCounts } from "../src/concurrency.ts";
import { bet } from "./helpers.ts";

const times = [0, 1, 2, 3, 4, 5, 6, 7];

test("activeAt: a bet is open from tOpen up to but not including tClose", () => {
  const bets = [bet(1, 2, 5, 0.5)];
  assert.equal(activeAt(bets, 1).length, 0);
  assert.equal(activeAt(bets, 2).length, 1);
  assert.equal(activeAt(bets, 4).length, 1);
  assert.equal(activeAt(bets, 5).length, 0);
});
test("concurrentCounts on two overlapping bets", () => {
  const bets = [bet(1, 0, 4, 0.5), bet(2, 2, 6, 0.5)];
  assert.deepEqual(concurrentCounts(bets, times), [1, 1, 2, 2, 1, 1, 0, 0]);
});
test("averageUniqueness: no overlap is 1, full overlap is 1/2, half overlap is 3/4", () => {
  const alone = averageUniqueness([bet(1, 0, 4, 0.5)], times);
  assert.equal(alone.get(1), 1);
  const same = averageUniqueness([bet(1, 0, 4, 0.5), bet(2, 0, 4, 0.5)], times);
  assert.equal(same.get(1), 0.5);
  assert.equal(same.get(2), 0.5);
  const half = averageUniqueness([bet(1, 0, 4, 0.5), bet(2, 2, 6, 0.5)], times);
  // bet 1 is open at 0,1 (count 1) and 2,3 (count 2): mean(1, 1, 1/2, 1/2) = 0.75
  assert.equal(half.get(1), 0.75);
  assert.equal(half.get(2), 0.75);
});
