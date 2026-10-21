// Shared helpers for the five sample strategies. Kept tiny on purpose.
import type { Costs, StrategyResult } from "../types.ts";

export const NOTIONAL_USD = 1000; // every trade risks the same size, so results compare fairly

export interface RoundTrip {
  side: 1 | -1; // 1 = long (buy then sell), -1 = short (sell then buy)
  entry: number;
  exit: number;
  i0?: number; // CHANGED in 0007: series index at entry
  i1?: number; // CHANGED in 0007: series index at exit
}

/** Gross P&L of one round trip in USD, before any fee or slippage. */
export const grossUsd = (t: RoundTrip, notional = NOTIONAL_USD): number => (t.side * (t.exit - t.entry)) / t.entry * notional;

/** Cost of one leg (one buy or one sell) in USD. */
export const legCostUsd = (c: Costs, notional = NOTIONAL_USD): number => ((c.feeBps + c.slippageBps) / 10_000) * notional;

export type Meta = Pick<StrategyResult, "id" | "name" | "family" | "dataNeeds">;

/** Turn per-trade gross P&L into a result. legs = how many legs one "trade" pays costs on. */
export function summarize(meta: Meta, grosses: number[], legs: number, costs: Costs, paysSlippage = true, spans?: [number, number][]): StrategyResult {
  const perTradeCost = legs * legCostUsd(costs);
  const gross = grosses.reduce((a, b) => a + b, 0);
  const net = gross - grosses.length * perTradeCost;
  const wins = grosses.filter((g) => g - perTradeCost > 0).length;
  return {
    ...meta,
    trades: grosses.length,
    pnlGrossUsd: round(gross),
    pnlNetUsd: round(net),
    hitRate: grosses.length ? round(wins / grosses.length, 3) : 0,
    notionalUsd: NOTIONAL_USD,
    legsPerTrade: legs,
    paysSlippage,
    // CHANGED in 0007: per-trade detail (only when the strategy passes index spans)
    ...(spans ? { detail: grosses.map((g, k) => ({ i0: spans[k]![0], i1: spans[k]![1], grossUsd: round(g, 4), netUsd: round(g - perTradeCost, 4) })) } : {}),
  };
}

export function round(x: number, d = 2): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
export const std = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
