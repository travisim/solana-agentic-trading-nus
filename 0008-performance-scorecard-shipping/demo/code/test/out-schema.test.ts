// Runs the demo (recorded mode) into a temp folder and checks the shape and the arithmetic of every out/*.json file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { score, gridOf } from "../src/scorecard.ts";

const dir = mkdtempSync(join(tmpdir(), "scorecard-"));
const stdout = execFileSync("node", ["src/demo.ts", "--recorded", "--out", dir + "/"], { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8" });
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

test("demo prints the scorecard and never prints NaN or undefined", () => {
  assert.match(stdout, /Scorecard, simulated on recorded data; not advice/);
  assert.match(stdout, /ALL \(one ledger\)/);
  assert.ok(!/NaN|undefined|Infinity/.test(stdout));
});
test("ledger.json: time-ordered closed trades on the recorded window", () => {
  const l = read("ledger.json");
  assert.equal(l.pair, "SOL/USDC");
  assert.equal(l.intervalSec, 5);
  assert.ok(l.trades.length >= 30, `only ${l.trades.length} trades`);
  assert.deepEqual(l.trades.map((t: { id: number }) => t.id), l.trades.map((_: unknown, i: number) => i + 1));
  for (let i = 1; i < l.trades.length; i++) assert.ok(l.trades[i].closeT >= l.trades[i - 1].closeT);
  for (const t of l.trades) {
    assert.ok(t.openT >= l.windowStartT && t.closeT <= l.windowEndT && t.closeT >= t.openT);
    assert.ok(["long", "short"].includes(t.side));
    assert.equal(typeof t.grossUsd, "number");
    assert.equal(t.status, undefined, "recorded sample ledger must not carry invented on-chain fields");
  }
});
test("scorecard.json: overall equals a fresh computation, and strategies add up", () => {
  const sc = read("scorecard.json");
  const l = read("ledger.json");
  const again = score(l.trades, { feeBps: sc.feeBps, slippageBps: sc.slippageBps }, l.capitalUsd, gridOf(l));
  assert.deepEqual(sc.overall, again);
  const ids = Object.keys(sc.byStrategy);
  assert.ok(ids.length >= 3);
  assert.equal(ids.reduce((a, id) => a + sc.byStrategy[id].trades, 0), sc.overall.trades);
  const net = ids.reduce((a, id) => a + sc.byStrategy[id].netUsd, 0);
  assert.ok(Math.abs(net - sc.overall.netUsd) < 0.01, `${net} vs ${sc.overall.netUsd}`);
  assert.ok(Math.abs(sc.overall.grossUsd - sc.overall.costsUsd - sc.overall.netUsd) < 0.001);
});
test("scorecard totals agree with strategies.json (the earlier sessions' numbers)", () => {
  const sc = read("scorecard.json");
  const st = read("strategies.json");
  for (const s of st.strategies) {
    if (!s.trades) continue;
    assert.equal(sc.byStrategy[s.id].trades, s.trades, s.id);
    assert.ok(Math.abs(sc.byStrategy[s.id].netUsd - s.pnlNetUsd) < 0.06, `${s.id}: ${sc.byStrategy[s.id].netUsd} vs ${s.pnlNetUsd}`);
  }
});
test("equity.json: starts at capital, same length as the grid, drawdown never negative", () => {
  const e = read("equity.json");
  const l = read("ledger.json");
  assert.equal(e.times.length, gridOf(l).length);
  for (const [k, c] of Object.entries(e.curves) as [string, { equity: number[]; drawdown: number[] }][]) {
    assert.equal(c.equity.length, e.times.length, k);
    assert.ok(c.drawdown.every((d) => d >= 0), k);
  }
  assert.equal(e.curves.all.equity[0], e.capitalUsd);
});
test("dashboards.json: five tricks, each with shown/hidden/honest text", () => {
  const d = read("dashboards.json");
  assert.equal(d.tricks.length, 5);
  for (const t of d.tricks) for (const k of ["name", "shown", "hidden", "honest"]) assert.equal(typeof t[k], "string", k);
  assert.ok(!JSON.stringify(d).match(/NaN|undefined/));
  assert.ok(d.misleading.grossUsd > d.honest.netUsd);
});
test("shipcheck.json: three samples, the verdicts the teaching depends on", () => {
  const s = read("shipcheck.json");
  assert.deepEqual(s.samples.map((x: { id: string }) => x.id), ["tidy", "messy", "leaky"]);
  assert.deepEqual(s.samples.map((x: { report: { verdict: string } }) => x.report.verdict), ["ready to ship", "not ready", "not ready"]);
  assert.equal(s.checks.length, 14);
});
test("failure-table.json: more trades, same hit rate, surer failure", () => {
  const f = read("failure-table.json");
  assert.equal(f.breakEvenHitRate, 0.5);
  for (let i = 1; i < f.rows.length; i++) assert.ok(f.rows[i].probFailure > f.rows[i - 1].probFailure);
});
test("cost-scenarios.json: costs never help; zero costs equals gross", () => {
  const c = read("cost-scenarios.json");
  assert.deepEqual(c.scenarios.map((s: { feeBps: number }) => s.feeBps), [0, 5, 12]);
  const [a, b, d] = c.scenarios;
  assert.equal(a.overall.netUsd, a.overall.grossUsd);
  assert.ok(a.overall.netUsd > b.overall.netUsd && b.overall.netUsd > d.overall.netUsd);
  assert.equal(a.overall.grossUsd, b.overall.grossUsd);
});
test("solana-costs.json is a real capture with a date", () => {
  const c = read("solana-costs.json");
  assert.ok(!Number.isNaN(Date.parse(c.capturedAt)));
  assert.ok(c.userTransactions > 500);
  assert.ok(c.failedRate > 0 && c.failedRate < 1);
});
test("dashboard.html is written and is self-contained", () => {
  assert.ok(existsSync(join(dir, "dashboard.html")));
  const h = readFileSync(join(dir, "dashboard.html"), "utf8");
  assert.ok(h.includes("<svg") && !/https?:\/\//.test(h.replace(/https?:\/\/www\.w3\.org\/2000\/svg/g, "")));
  assert.ok(!/NaN|undefined/.test(h));
});
test("--ledger scores your own file; a bad file fails with a clear message", () => {
  const own = join(dir, "own.json");
  execFileSync("node", ["-e", `require('fs').writeFileSync(${JSON.stringify(own)}, JSON.stringify({capitalUsd:1000,windowStartT:0,windowEndT:100,intervalSec:10,trades:[{strategy:"mine",side:"long",openT:0,closeT:50,entry:100,exit:101,notionalUsd:100,grossUsd:1,legs:2}]}))`]);
  const out2 = mkdtempSync(join(tmpdir(), "own-"));
  const txt = execFileSync("node", ["src/demo.ts", "--ledger", own, "--out", out2 + "/"], { cwd: new URL("../", import.meta.url).pathname, encoding: "utf8" });
  assert.match(txt, /Your ledger/);
  assert.match(txt, /mine/);
  assert.ok(existsSync(join(out2, "dashboard.html")));
  const bad = join(dir, "bad.json");
  execFileSync("node", ["-e", `require('fs').writeFileSync(${JSON.stringify(bad)}, '{"capitalUsd":1000}')`]);
  assert.throws(() => execFileSync("node", ["src/demo.ts", "--ledger", bad, "--out", out2 + "/"], { cwd: new URL("../", import.meta.url).pathname, stdio: "pipe" }), /windowStartT must be a number/);
});
