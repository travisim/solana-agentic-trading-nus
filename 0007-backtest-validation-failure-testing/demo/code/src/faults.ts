// Failure injection. A tiny paper agent places an order every 30 s on the recorded series; we inject one fault for a few
// minutes and watch what the build-night-1 risk hook (vendored, unchanged) does with it. Every fault is SIMULATED on top of
// real recorded prices; nothing here touches a live service. Mirrored in lab/shared/calc.js and checked by lab/verify.mjs.
import { checkOrder, DEFAULT_LIMITS } from "./vendor/0002/risk.ts";
import type { Order, RiskLimits, Series } from "./vendor/0002/types.ts";
import { round } from "./stats.ts";

export type FaultKind = "none" | "stale-oracle" | "rpc-outage" | "slippage-shock" | "fee-change" | "duplicate-submission";
export const FAULT_KINDS: FaultKind[] = ["stale-oracle", "rpc-outage", "slippage-shock", "fee-change", "duplicate-submission"];

export interface FaultParams {
  kind: FaultKind;
  startTick: number;
  durationTicks: number;
  shockBps: number; // market move during the fault (negative = down), stale-oracle and rpc-outage
  slipBps: number; // extra slippage on every fill during the fault, slippage-shock
  feeBps: number; // fee per leg during the fault, fee-change
}
export interface Guards { dedupe: boolean; breaker: boolean }

export const ORDER_EVERY = 6; // ticks: one order every 30 s
export const ORDER_SIZE_USD = 250;
export const BASE_FEE_BPS = 5;
export const BAD_FILL_BPS = 20; // a fill more than this many bps worse than the market counts as "bad"
export const SLIPPAGE_BUDGET_BPS = 15;
export const BREAKER_MAX_BREACHES = 3;
export const TICK_SEC = 5;

export const defaultFault = (kind: FaultKind, n: number): FaultParams => ({
  kind, startTick: Math.floor(n * 0.6), durationTicks: 60,
  shockBps: -80, slipBps: 40, feeBps: 30,
});

export interface OrderRecord {
  tick: number;
  inWindow: boolean;
  copy: 1 | 2; // 2 = the duplicate resubmission
  order: Order;
  oraclePrice: number;
  oracleAgeSec: number;
  marketPrice: number;
  ok: boolean;
  rule: string | null;
  reason: string;
  adverseBps: number; // how much worse than the market this order fills (0 when it fills at or better)
  lossUsd: number; // adverse move plus extra fee, in USD, if it was accepted (0 if rejected)
  lossIfNoHookUsd: number; // same order with no hook at all
}

export interface FaultSummary {
  orders: number; // orders sent inside the fault window (duplicates counted)
  accepted: number;
  rejected: number;
  byRule: Record<string, number>;
  badFills: number;
  worstAdverseBps: number;
  lossUsd: number;
  lossIfNoHookUsd: number;
  exposureUsd: number; // total notional accepted inside the window
  firstRejectTick: number | null;
}

export interface Replay { params: FaultParams; guards: Guards; records: OrderRecord[]; inWindow: FaultSummary; baseAgeSec: number }

export function replayFault(series: Series, p: FaultParams, baseAgeSec: number, guards: Guards = { dedupe: false, breaker: false }, limits: RiskLimits = DEFAULT_LIMITS): Replay {
  const pts = series.points;
  const records: OrderRecord[] = [];
  const seenKeys = new Set<string>();
  let breaches = 0, halted = false;
  const end = p.startTick + p.durationTicks;
  for (let i = ORDER_EVERY; i < pts.length; i += ORDER_EVERY) {
    const win = p.kind !== "none" && i >= p.startTick && i < end;
    const side: "buy" | "sell" = (i / ORDER_EVERY) % 2 === 1 ? "buy" : "sell";
    const shock = win && (p.kind === "stale-oracle" || p.kind === "rpc-outage") ? 1 + p.shockBps / 10_000 : 1;
    const market = pts[i]!.jupiter * shock; // what the market really is right now
    // what the agent believes
    const lastGood = Math.max(0, p.startTick - 1);
    const frozenOracle = win && (p.kind === "stale-oracle" || p.kind === "rpc-outage");
    const oraclePrice = frozenOracle ? pts[lastGood]!.pyth : pts[i]!.pyth;
    const oracleAgeSec = frozenOracle ? baseAgeSec + (i - p.startTick + 1) * TICK_SEC : baseAgeSec;
    // Where the agent's order price comes from:
    //  - stale-oracle: it quotes off the oracle (like the market maker), which is frozen, while the market moves on;
    //  - rpc-outage: it cannot read anything new, so it keeps the last good venue price;
    //  - otherwise: it reads the live venue price.
    const orderPrice = win && p.kind === "rpc-outage" ? pts[lastGood]!.jupiter : win && p.kind === "stale-oracle" ? oraclePrice : market;
    const order: Order = { side, sizeUsd: ORDER_SIZE_USD, price: round(orderPrice, 4) };
    const copies = win && p.kind === "duplicate-submission" ? 2 : 1;
    for (let c = 1; c <= copies; c++) {
      let d = checkOrder(order, { oraclePrice, oracleAgeSec }, limits);
      let rule: string | null = d.rule, reason = d.reason, ok = d.ok;
      if (ok && guards.dedupe) {
        const key = `${side}|${order.sizeUsd}|${Math.floor(i / ORDER_EVERY)}`;
        if (seenKeys.has(key)) { ok = false; rule = "duplicate-order"; reason = "same order already sent in this 30 s slot"; }
        else seenKeys.add(key);
      }
      if (ok && guards.breaker && halted) { ok = false; rule = "circuit-breaker"; reason = `halted after ${BREAKER_MAX_BREACHES} fills worse than ${SLIPPAGE_BUDGET_BPS} bps`; }
      let adverse = side === "buy" ? Math.max(0, (order.price / market - 1) * 10_000) : Math.max(0, (1 - order.price / market) * 10_000);
      if (win && p.kind === "slippage-shock") adverse += p.slipBps;
      const extraFee = win && p.kind === "fee-change" ? (order.sizeUsd * Math.max(0, p.feeBps - BASE_FEE_BPS)) / 10_000 : 0;
      const loss = (order.sizeUsd * adverse) / 10_000 + extraFee;
      if (ok && guards.breaker && adverse > SLIPPAGE_BUDGET_BPS && ++breaches >= BREAKER_MAX_BREACHES) halted = true;
      records.push({
        tick: i, inWindow: win, copy: c as 1 | 2, order, oraclePrice: round(oraclePrice, 4), oracleAgeSec, marketPrice: round(market, 4),
        ok, rule, reason, adverseBps: round(adverse, 2), lossUsd: ok ? round(loss, 4) : 0, lossIfNoHookUsd: round(loss, 4),
      });
    }
  }
  return { params: p, guards, records, inWindow: summarizeWindow(records), baseAgeSec };
}

export function summarizeWindow(records: OrderRecord[]): FaultSummary {
  const w = records.filter((r) => r.inWindow);
  const byRule: Record<string, number> = {};
  for (const r of w) if (!r.ok) byRule[r.rule ?? "unknown"] = (byRule[r.rule ?? "unknown"] ?? 0) + 1;
  const acc = w.filter((r) => r.ok);
  const rej = w.filter((r) => !r.ok);
  return {
    orders: w.length, accepted: acc.length, rejected: rej.length, byRule,
    badFills: acc.filter((r) => r.adverseBps > BAD_FILL_BPS).length,
    worstAdverseBps: round(Math.max(0, ...acc.map((r) => r.adverseBps)), 2),
    lossUsd: round(acc.reduce((a, r) => a + r.lossUsd, 0), 2),
    lossIfNoHookUsd: round(w.reduce((a, r) => a + r.lossIfNoHookUsd, 0), 2),
    exposureUsd: acc.reduce((a, r) => a + r.order.sizeUsd, 0),
    firstRejectTick: rej.length ? rej[0]!.tick : null,
  };
}

/**
 * RPC outage with HTTP 429: how many calls a client makes in `windowSec` seconds.
 * naive = retry every second; backoff = wait 1 s, 2 s, 4 s ... capped at 30 s (the same schedule as src/rpc.ts).
 */
export function retryCalls(windowSec: number): { naive: number; backoff: number } {
  let t = 0, wait = 1, calls = 0;
  while (t < windowSec) { calls++; t += wait; wait = Math.min(wait * 2, 30); }
  return { naive: Math.floor(windowSec), backoff: calls };
}
