// Runs the demo (recorded mode) into a temp folder and checks the shape of every out/*.json file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "bars-alerts-"));
execFileSync("node", ["src/demo.ts", "--recorded", "--out", dir + "/"], { cwd: new URL("../", import.meta.url).pathname, stdio: "pipe" });
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));
const num = (x: unknown, label: string) => assert.equal(typeof x, "number", label);

test("swaps.json: 1500+ real swaps, oldest first", () => {
  const s = read("swaps.json");
  assert.equal(s.pair, "SOL/USDC");
  assert.equal(s.mode, "recorded");
  assert.match(s.pool, /^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  assert.ok(!Number.isNaN(Date.parse(s.capturedAt)));
  assert.equal(typeof s.source, "string");
  assert.ok(s.swaps.length >= 1500, `only ${s.swaps.length} swaps`);
  const sigs = new Set<string>();
  for (let i = 0; i < s.swaps.length; i++) {
    const w = s.swaps[i];
    for (const k of ["t", "slot", "solAmount", "usdcAmount", "price"]) num(w[k], k);
    assert.ok(["buy", "sell"].includes(w.side));
    assert.ok(w.price > 10 && w.price < 10_000);
    assert.ok(Math.abs(w.usdcAmount / w.solAmount - w.price) / w.price < 1e-4);
    assert.ok(!sigs.has(w.sig), "duplicate signature");
    sigs.add(w.sig);
    if (i) assert.ok(w.t >= s.swaps[i - 1].t, "not oldest first");
  }
});
test("bars.json: both kinds of bars add up to the swaps", () => {
  const b = read("bars.json");
  const s = read("swaps.json");
  num(b.timeBarSec, "timeBarSec"); num(b.dollarThresholdUsd, "dollarThresholdUsd");
  for (const k of ["swaps", "timeBarCount", "dollarBarCount", "emptyTimeBars"]) num(b.stats[k], k);
  assert.equal(b.stats.swaps, s.swaps.length);
  assert.equal(b.stats.timeBarCount, b.timeBars.length);
  assert.equal(b.stats.dollarBarCount, b.dollarBars.length);
  const total = s.swaps.reduce((a: number, w: { usdcAmount: number }) => a + w.usdcAmount, 0);
  for (const bars of [b.timeBars, b.dollarBars]) {
    assert.ok(bars.length > 5);
    for (const x of bars) {
      for (const k of ["tStart", "tEnd", "open", "high", "low", "close", "volumeUsd", "count"]) num(x[k], k);
      assert.ok(x.low <= Math.min(x.open, x.close) && x.high >= Math.max(x.open, x.close) && x.count >= 1);
    }
    assert.ok(Math.abs(bars.reduce((a: number, x: { volumeUsd: number }) => a + x.volumeUsd, 0) - total) < 0.01);
    assert.equal(bars.reduce((a: number, x: { count: number }) => a + x.count, 0), s.swaps.length);
  }
});
test("cusum.json: events are a small subset of ticks", () => {
  const c = read("cusum.json");
  num(c.thresholdBps, "thresholdBps");
  assert.ok(c.series.length > 100);
  for (const p of c.series) for (const k of ["t", "price", "sPos", "sNeg"]) num(p[k], k);
  assert.ok(c.series.every((p: { sPos: number; sNeg: number }) => p.sPos >= 0 && p.sNeg <= 0));
  for (const e of c.events) { num(e.t, "t"); num(e.price, "price"); assert.ok(["up", "down"].includes(e.direction)); }
  assert.equal(c.stats.ticks, c.series.length);
  assert.equal(c.stats.events, c.events.length);
  assert.equal(c.stats.agentCallsEveryTick, c.stats.ticks);
  assert.equal(c.stats.agentCallsOnEvents, c.events.length);
  assert.ok(c.events.length > 0 && c.events.length < c.stats.ticks);
});
test("staleness.json: 20+ minutes every 5 s of real reads, fault labelled as simulated", () => {
  const s = read("staleness.json");
  assert.equal(s.maxAgeSec, 30);
  assert.equal(s.maxSlotsBehind, 75);
  assert.ok(s.points.length >= 240, `only ${s.points.length} points`);
  assert.ok(s.points.at(-1).t - s.points[0].t >= 20 * 60);
  for (const p of s.points) {
    for (const k of ["t", "currentSlot", "postedSlot", "publishTime", "ageSec", "slotsBehind"]) num(p[k], k);
    assert.equal(typeof p.ok, "boolean");
    assert.equal(typeof p.simulated, "boolean");
  }
  assert.equal(s.injectedFault.simulated, true);
  assert.match(s.injectedFault.kind, /simulated/);
  assert.match(s.injectedFault.note, /SIMULATED/);
  const sim = s.points.filter((p: { simulated: boolean }) => p.simulated);
  assert.ok(sim.length > 20 && sim.every((p: { t: number }) => p.t >= s.injectedFault.startT));
  assert.ok(s.points.filter((p: { simulated: boolean }) => !p.simulated).length >= 120);
  assert.ok(!sim.at(-1).ok);
});
