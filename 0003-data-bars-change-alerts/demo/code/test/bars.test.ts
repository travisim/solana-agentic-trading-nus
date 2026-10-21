import { test } from "node:test";
import assert from "node:assert/strict";
import { barDurations, countEmptyTimeBars, dollarBars, lastBarIsPartial, timeBars, totalVolumeUsd } from "../src/bars.ts";
import { swapsOf } from "./helpers.ts";

// t, price, usdc
const swaps = swapsOf([
  [100, 10, 400], [105, 12, 300], // clock slot [60,120)
  [130, 9, 500], [131, 11, 200], // clock slot [120,180)
  [300, 10, 1000], // clock slot [300,360): slots 180 and 240 are empty
]);

test("time bars: OHLC, volume and count per clock slot", () => {
  const b = timeBars(swaps, 60);
  assert.equal(b.length, 3);
  assert.deepEqual(b[0], { tStart: 60, tEnd: 120, open: 10, high: 12, low: 10, close: 12, volumeUsd: 700, count: 2 });
  assert.deepEqual(b[1], { tStart: 120, tEnd: 180, open: 9, high: 11, low: 9, close: 11, volumeUsd: 700, count: 2 });
  assert.equal(b[2]!.count, 1);
});
test("time bars: empty slots are counted, not drawn", () => {
  const b = timeBars(swaps, 60);
  assert.equal(countEmptyTimeBars(b, 60), 2); // slots 180 and 240
});
test("dollar bars: a bar closes when the threshold is reached", () => {
  const b = dollarBars(swaps, 700);
  assert.equal(b.length, 3);
  assert.deepEqual(b[0], { tStart: 100, tEnd: 105, open: 10, high: 12, low: 10, close: 12, volumeUsd: 700, count: 2 });
  assert.equal(b[1]!.volumeUsd, 700);
  assert.equal(b[2]!.volumeUsd, 1000);
  assert.equal(lastBarIsPartial(b, 700), false);
});
test("dollar bars: the crossing swap stays in the bar, and the last bar may be unfinished", () => {
  const b = dollarBars(swaps, 1000);
  assert.deepEqual(b.map((x) => x.count), [3, 2]); // 400+300+500=1200 closes bar 1; 200+1000=1200 closes bar 2
  const c = dollarBars(swaps, 5000);
  assert.equal(c.length, 1);
  assert.equal(lastBarIsPartial(c, 5000), true);
});
test("volume conservation: bars add up to the swaps, for several thresholds and bar lengths", () => {
  const total = totalVolumeUsd(swaps);
  assert.equal(total, 2400);
  for (const th of [1, 250, 700, 1000, 2400, 10_000]) {
    assert.equal(dollarBars(swaps, th).reduce((a, b) => a + b.volumeUsd, 0), total, `threshold ${th}`);
    assert.equal(dollarBars(swaps, th).reduce((a, b) => a + b.count, 0), swaps.length);
  }
  for (const sec of [1, 10, 60, 600]) assert.equal(timeBars(swaps, sec).reduce((a, b) => a + b.volumeUsd, 0), total, `sec ${sec}`);
});
test("quiet versus busy: busy swaps make many dollar bars, quiet swaps make few", () => {
  const busy = swapsOf(Array.from({ length: 60 }, (_, i) => [1000 + Math.floor(i / 6), 10, 100] as [number, number, number])); // 6 swaps/s
  const quiet = swapsOf(Array.from({ length: 10 }, (_, i) => [2000 + i * 6, 10, 100] as [number, number, number])); // 1 swap per 6 s
  assert.equal(dollarBars(busy, 600).length, 10);
  assert.equal(dollarBars(quiet, 600).length, 2);
  assert.deepEqual(barDurations(dollarBars(quiet, 300)), [12, 12, 12, 0]); // 3 swaps (12 s) per bar; the last bar holds 1 swap (0 s)
});
test("bad parameters are rejected", () => {
  assert.throws(() => timeBars(swaps, 0), /> 0/);
  assert.throws(() => dollarBars(swaps, -5), /> 0/);
  assert.deepEqual(dollarBars([], 100), []);
});
