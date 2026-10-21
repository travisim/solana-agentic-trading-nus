// An offline pretend agent: a momentum rule that writes a short reason for every decision. No AI credits, no network.
// It stands in for an LLM agent: the point is what we do with its decisions and its written reasons (label them, grade them).
//
// Rule: look back `lookback` steps. If the move is at least `zMin` times the recent noise, follow it (buy after a rise, sell after a fall).
//       Otherwise hold. "Noise" = vol * sqrt(lookback), vol as in labels.ts.
//
// To test the explanation checker, a share of the reasons gets ONE deliberately wrong claim (the direction flipped, the size
// multiplied by 2.5, or the venue gap understated). This is a SIMULATED reasoning error with a fixed seed, so a run is repeatable;
// every such decision carries injected: true in out/agent.json.
import type { Label } from "./labels.ts";

export interface AgentParams {
  lookback: number; // steps
  zMin: number; // minimum move / noise to act
  errorRatePct: number; // share of reasons given one wrong claim (0 to 100)
  seed: number;
}
export const DEFAULT_AGENT: AgentParams = { lookback: 12, zMin: 1, errorRatePct: 20, seed: 7 };

export interface Truth {
  momBps: number; // signed move over the lookback
  ratio: number; // |move| / noise
  gapBps: number | null; // |second venue - price| in bps, null if the path has no second venue
}

export interface Decision {
  i: number;
  t: number;
  side: 1 | -1 | 0; // 1 buy, -1 sell, 0 hold
  momBps: number;
  z: number; // signed move / noise
  gapBps: number | null;
  reason: string;
  injected: "none" | "direction" | "size" | "gap";
  outcome: "win" | "loss" | "timeout" | "none"; // none = hold (no trade)
  label: 1 | -1 | 0;
  sideRetBps: number | null; // return in the trade's direction at the label exit, null for hold
}

/** What is true at step i (the only inputs the agent and the checker both get). */
export function truthAt(prices: number[], others: (number | null)[], vol: (number | null)[], i: number, lookback: number): Truth | null {
  const v = vol[i];
  if (v === null || v === undefined || i < lookback) return null;
  const momBps = (prices[i]! / prices[i - lookback]! - 1) * 10_000;
  const noise = v * Math.sqrt(lookback);
  const o = others[i];
  return {
    momBps,
    ratio: noise > 0 ? Math.abs(momBps) / noise : 0,
    gapBps: o === null || o === undefined ? null : (Math.abs(o - prices[i]!) / prices[i]!) * 10_000,
  };
}

/** Fixed-seed hash of (decision index, seed): same value in TypeScript and in the browser demos. */
export function roll(i: number, seed: number): number {
  let x = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(seed + 7, 0x85ebca6b);
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d);
  x ^= x >>> 12;
  return x >>> 0;
}

export function spanText(lookback: number, stepSec: number | null): string {
  return stepSec === null ? `${lookback} bars` : `${lookback * stepSec} s`;
}

export function decide(
  prices: number[], times: number[], others: (number | null)[], vol: (number | null)[], l: Label,
  a: AgentParams, stepSec: number | null,
): Decision | null {
  const tr = truthAt(prices, others, vol, l.i, a.lookback);
  if (!tr) return null;
  const z = tr.momBps / Math.max(1e-9, (vol[l.i] as number) * Math.sqrt(a.lookback));
  const side: Decision["side"] = tr.ratio >= a.zMin ? (tr.momBps > 0 ? 1 : -1) : 0;
  // claims as the agent writes them (possibly with one injected error)
  let word = tr.momBps >= 0 ? "rose" : "fell";
  let mom = Math.abs(tr.momBps);
  let ratio = tr.ratio;
  let gapClaim = tr.gapBps === null ? null : Math.ceil(tr.gapBps * 10) / 10;
  let injected: Decision["injected"] = "none";
  const r = roll(l.i, a.seed);
  if (r % 100 < a.errorRatePct && mom >= 0.5) {
    const kinds: Decision["injected"][] = ["direction", "size", ...(tr.gapBps !== null && tr.gapBps >= 0.4 ? (["gap"] as const) : [])];
    injected = kinds[Math.floor(r / 100) % kinds.length]!;
    if (injected === "direction") word = word === "rose" ? "fell" : "rose";
    if (injected === "size") { mom *= 2.5; ratio *= 2.5; }
    if (injected === "gap") gapClaim = Math.max(0.1, Math.floor((tr.gapBps! / 4) * 10) / 10);
  }
  const span = spanText(a.lookback, stepSec);
  const gapPart = gapClaim === null ? "" : ` The two venues agree within ${gapClaim.toFixed(1)} bps.`;
  const reason =
    side === 0
      ? `Hold: SOL ${word} ${mom.toFixed(1)} bps in the last ${span}, only ${ratio.toFixed(1)}x the recent noise, too small to act on.${gapPart}`
      : `${side === 1 ? "Buy" : "Sell"}: SOL ${word} ${mom.toFixed(1)} bps in the last ${span}, ${ratio.toFixed(1)}x the recent noise, so follow the move.${gapPart}`;
  const trade = side !== 0;
  return {
    i: l.i, t: l.t, side, momBps: round(tr.momBps, 3), z: round(z, 3), gapBps: tr.gapBps === null ? null : round(tr.gapBps, 3),
    reason, injected,
    outcome: !trade ? "none" : l.label === 0 ? "timeout" : l.label === side ? "win" : "loss",
    label: l.label,
    sideRetBps: trade ? round(side * l.retBps, 3) : null,
  };
}

function round(x: number, d: number): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}
