import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { buildScript, scriptTotalSec, wordCount } from "../src/pitch.ts";
import { runAgent } from "../src/agent.ts";
import { readsOf, swapsOf } from "./helpers.ts";

test("wordCount ignores extra spaces and newlines", () => {
  assert.equal(wordCount("  one  two\nthree "), 3);
  assert.equal(wordCount(""), 0);
});

const sw = swapsOf(Array.from({ length: 60 }, (_, i) => [1000 + i * 2, 100 * (1 + (i < 30 ? i : 60 - i) * 0.0003), 1000] as [number, number, number]));
const run = runAgent(sw, readsOf(1000, 1120, 100), { thresholdUsd: 3000, cusumBps: 5, usdPerBps: 100, feeBps: 4, limits: { maxNotionalUsd: 1000, maxOracleGapBps: 50, maxOracleAgeSec: 60 } });

test("the sample script has one text per part, in order, every number from the run", () => {
  const s = buildScript(run, 4, true);
  assert.deepEqual(s.map((p) => p.id), ["problem", "what", "proof", "next"]);
  assert.match(s[2]!.text, new RegExp(`${run.scorecard.events} change alerts`));
  assert.match(s[2]!.text, new RegExp(`${run.scorecard.accepted} orders accepted`));
  assert.ok(s.every((p) => p.words === wordCount(p.text)));
});

test("estimated seconds are words at 130 a minute and the sample fits its budgets", () => {
  const s = buildScript(run, 4, true);
  for (const p of s) assert.equal(p.estSec, Math.round((p.words / 130) * 60));
  assert.ok(scriptTotalSec(s) <= 180);
  assert.ok(s.every((p) => p.fits));
});

test("the script never claims a return, a profit or a funded devnet transaction it does not have", () => {
  const all = buildScript(run, 4, true).map((p) => p.text).join(" ");
  assert.doesNotMatch(all, /profit|return of|\bearn|guarantee|\bAPY\b/i);
  assert.match(all, /faucet was rate limited/);
  assert.match(buildScript(run, 4, false)[2]!.text, /do not have a devnet transaction/);
});

test("the shipped sample script (out/pitch.json) keeps the same promise", { skip: !existsSync(new URL("../out/pitch.json", import.meta.url)) && "run npm run demo first" }, () => {
  const p = JSON.parse(readFileSync(new URL("../out/pitch.json", import.meta.url), "utf8"));
  assert.equal(p.totalSec, 180);
  assert.ok(p.script.every((x: { fits: boolean }) => x.fits));
});
