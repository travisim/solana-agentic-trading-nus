// Runs the demo (recorded mode) into a temp folder and checks the shape of every out/*.json file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "data-risk-"));
execFileSync("node", ["src/demo.ts", "--recorded", "--out", dir + "/"], { cwd: new URL("../", import.meta.url).pathname, stdio: "pipe" });
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

test("prices.json matches the data contract", () => {
  const p = read("prices.json");
  assert.equal(p.mode, "recorded");
  assert.equal(p.pair, "SOL/USDC");
  assert.ok(!Number.isNaN(Date.parse(p.generatedAt)));
  assert.deepEqual(p.venues.map((v: { id: string }) => v.id), ["jupiter", "pyth", "orca"]);
  for (const v of p.venues) { assert.equal(typeof v.price, "number"); assert.ok(v.price > 1 && v.price < 10_000); assert.equal(typeof v.source, "string"); }
  const pyth = p.venues[1];
  for (const k of ["confBps", "publishTime", "postedSlot", "currentSlot"]) assert.equal(typeof pyth[k], "number", k);
  for (const k of ["jupiterVsPyth", "orcaVsPyth", "jupiterVsOrca"]) assert.equal(typeof p.gapBps[k], "number", k);
});
test("series.json has 300+ real points every 5 s", () => {
  const s = read("series.json");
  assert.equal(s.intervalSec, 5);
  assert.ok(s.points.length >= 300, `only ${s.points.length} points`);
  for (const pt of s.points) for (const k of ["t", "jupiter", "pyth", "orca"]) assert.equal(typeof pt[k], "number");
  for (let i = 1; i < s.points.length; i++) assert.ok(s.points[i].t > s.points[i - 1].t);
});
test("risk.json has four rules and 8+ decisions covering every rule", () => {
  const r = read("risk.json");
  assert.deepEqual(r.rules.map((x: { id: string }) => x.id), ["max-notional", "max-oracle-gap", "max-oracle-age", "unit-sanity"]);
  assert.ok(r.decisions.length >= 8);
  const rejected = new Set(r.decisions.filter((d: { ok: boolean }) => !d.ok).map((d: { rule: string }) => d.rule));
  for (const id of ["max-notional", "max-oracle-gap", "max-oracle-age", "unit-sanity"]) assert.ok(rejected.has(id), `no rejection for ${id}`);
  assert.ok(r.decisions.some((d: { ok: boolean }) => d.ok));
  for (const d of r.decisions) { assert.equal(typeof d.reason, "string"); assert.ok(["buy", "sell"].includes(d.order.side)); }
});
test("strategies.json has the five strategies with numeric fields", () => {
  const s = read("strategies.json");
  assert.equal(s.feeBps, 5);
  assert.equal(s.slippageBps, 2);
  assert.match(s.note, /not advice/);
  assert.deepEqual(s.strategies.map((x: { id: string }) => x.id), ["cross-venue-arb", "basis", "trend", "mean-reversion", "market-maker"]);
  for (const x of s.strategies) {
    for (const k of ["trades", "pnlGrossUsd", "pnlNetUsd", "hitRate", "notionalUsd", "legsPerTrade"]) assert.equal(typeof x[k], "number", `${x.id}.${k}`);
    assert.ok(Array.isArray(x.dataNeeds) && typeof x.family === "string" && typeof x.name === "string");
  }
});
