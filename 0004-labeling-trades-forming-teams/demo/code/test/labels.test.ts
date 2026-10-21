import { test } from "node:test";
import assert from "node:assert/strict";
import { barrierWidthBps, ewmVolBps, labelAt, tripleBarrier, type LabelParams } from "../src/labels.ts";

const P: LabelParams = { mult: 1, horizon: 5, volSpan: 3, every: 1, minWidthBps: 10 };
const times = (n: number) => Array.from({ length: n }, (_, i) => 1000 + i * 5);
const flat = (n: number, p = 100) => Array.from({ length: n }, () => p);

test("ewmVolBps: first value is null, then the weighted standard deviation of one-step returns", () => {
  const v = ewmVolBps([100, 100.01, 100.01], 1); // span 1 -> alpha 1: vol is just |last return|
  assert.equal(v[0], null);
  assert.ok(Math.abs((v[1] as number) - 1) < 1e-6, "0.01% = 1 bp");
  assert.equal(v[2], 0);
});

test("barrier width follows volatility but never goes below the floor", () => {
  assert.equal(barrierWidthBps(0, P), 10);
  assert.equal(barrierWidthBps(5, P), 5 * Math.sqrt(5)); // 11.18 > floor 10
  assert.ok(barrierWidthBps(10, P) > barrierWidthBps(5, P));
});

test("a jump up through the upper barrier gives +1 and stops there", () => {
  const prices = [...flat(6), 100.2, 100.2, 100.2, 100.2, 100.2]; // +20 bps at index 6
  const vol = ewmVolBps(prices, 3);
  const l = labelAt(prices, times(prices.length), vol, 4, P)!; // horizon 5: sees indices 5..9
  assert.equal(l.touch, "up");
  assert.equal(l.label, 1);
  assert.equal(l.exitI, 6);
  assert.ok(l.retBps > 19 && l.retBps < 21);
});

test("a fall through the lower barrier gives -1", () => {
  const prices = [...flat(6), 99.8, 99.8, 99.8, 99.8, 99.8];
  const l = labelAt(prices, times(prices.length), ewmVolBps(prices, 3), 4, P)!;
  assert.equal(l.label, -1);
  assert.equal(l.touch, "down");
});

test("nothing touched before the horizon gives 0 and exits at the vertical barrier", () => {
  const prices = [...flat(6), 100.01, 100.0, 100.01, 100.0, 100.01, 100.0];
  const l = labelAt(prices, times(prices.length), ewmVolBps(prices, 3), 4, P)!;
  assert.equal(l.label, 0);
  assert.equal(l.touch, "time");
  assert.equal(l.exitI, 4 + P.horizon);
});

test("the first barrier touched wins, even if the other would be touched later", () => {
  const prices = [...flat(5), 100.2, 99.7, 99.7, 99.7, 99.7, 99.7];
  const l = labelAt(prices, times(prices.length), ewmVolBps(prices, 3), 4, P)!;
  assert.equal(l.label, 1);
});

test("a plain fixed-horizon label can disagree with the triple barrier", () => {
  const prices = [...flat(5), 100.2, 100.1, 100.0, 99.95, 99.9, 99.9];
  const l = labelAt(prices, times(prices.length), ewmVolBps(prices, 3), 4, P)!;
  assert.equal(l.label, 1, "touched the upper barrier first");
  assert.equal(l.fixed, -1, "but the price ended lower");
});

test("decisions whose horizon runs past the end of the data are dropped, not guessed", () => {
  const prices = [...flat(10), 100.3, 100.3];
  const r = tripleBarrier(prices, times(prices.length), P);
  assert.ok(r.dropped > 0);
  assert.ok(r.labels.every((l) => l.i + P.horizon <= prices.length - 1));
});

test("wider multiplier means wider barriers and more time-outs on the same data", () => {
  const prices = Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 5) * 0.05 + (i % 7) * 0.004);
  const narrow = tripleBarrier(prices, times(200), { ...P, mult: 0.5, minWidthBps: 0 });
  const wide = tripleBarrier(prices, times(200), { ...P, mult: 3, minWidthBps: 0 });
  const timeouts = (r: typeof narrow) => r.labels.filter((l) => l.touch === "time").length;
  assert.ok(timeouts(wide) >= timeouts(narrow));
  assert.ok(wide.labels[0]!.widthBps > narrow.labels[0]!.widthBps);
});

test("bad settings fail with a clear message", () => {
  assert.throws(() => tripleBarrier([1, 2, 3], [1, 2, 3], { ...P, horizon: 0 }), /horizon/);
  assert.throws(() => ewmVolBps([1, 2], 0), /volSpan/);
});
