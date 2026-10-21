import { test } from "node:test";
import assert from "node:assert/strict";
import { concurrency, leaking, uniqueness } from "../src/overlap.ts";

test("concurrency counts the labels alive at each step", () => {
  const spans = [{ i: 0, exitI: 2 }, { i: 1, exitI: 3 }];
  assert.deepEqual(concurrency(spans, 5), [1, 2, 2, 1, 0]);
});

test("non-overlapping labels are fully unique; heavy overlap shrinks uniqueness", () => {
  const apart = [{ i: 0, exitI: 1 }, { i: 2, exitI: 3 }];
  assert.deepEqual(uniqueness(apart, concurrency(apart, 4)), [1, 1]);
  const same = [{ i: 0, exitI: 3 }, { i: 0, exitI: 3 }, { i: 0, exitI: 3 }, { i: 0, exitI: 3 }];
  assert.deepEqual(uniqueness(same, concurrency(same, 4)), [0.25, 0.25, 0.25, 0.25]);
});

test("uniqueness of half-overlapping labels is the mean of 1/c over the life", () => {
  const s = [{ i: 0, exitI: 3 }, { i: 2, exitI: 5 }]; // steps 0,1 alone (1), steps 2,3 shared (1/2)
  const u = uniqueness(s, concurrency(s, 6));
  assert.equal(u[0], (1 + 1 + 0.5 + 0.5) / 4);
});

test("leaking = labels made before the cut that look at or past the cut", () => {
  const spans = [{ i: 0, exitI: 4 }, { i: 3, exitI: 7 }, { i: 6, exitI: 9 }, { i: 8, exitI: 10 }];
  assert.equal(leaking(spans, 5), 1); // only i=3 starts before 5 and ends at/after 5
  assert.equal(leaking(spans, 8), 1); // i=3 ends at 7 (before 8); i=6 ends at 9 (leaks); i=8 starts at the cut, so it is a test label
  assert.equal(leaking(spans, 0), 0);
});
