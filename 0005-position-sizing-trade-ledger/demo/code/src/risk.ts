// Copied unchanged from build night 1 (0002-build-night-1-data-collection-risk-hook/demo-repo/code/src/risk.ts).
// The risk hook: plain code between an agent's idea and any action.
// It can say no, and it always says why. Pure function: same inputs, same answer, no network.
import type { Order, RiskContext, RiskDecision, RiskLimits } from "./types.ts";

export const DEFAULT_LIMITS: RiskLimits = {
  maxNotionalUsd: 1000,
  maxOracleGapBps: 50,
  maxOracleAgeSec: 60,
};

const ok = (): RiskDecision => ({ ok: true, rule: null, reason: "within all limits" });
const no = (rule: NonNullable<RiskDecision["rule"]>, reason: string): RiskDecision => ({ ok: false, rule, reason });

export function checkOrder(order: Order, ctx: RiskContext, limits: RiskLimits = DEFAULT_LIMITS): RiskDecision {
  // 1. unit-sanity: catch garbage before doing any maths with it
  //    (cents instead of dollars, lamports instead of SOL, negative or missing numbers).
  const { sizeUsd, price } = order;
  if (order.side !== "buy" && order.side !== "sell") return no("unit-sanity", `side "${order.side}" is not buy or sell`);
  if (!Number.isFinite(sizeUsd) || sizeUsd <= 0) return no("unit-sanity", `size ${sizeUsd} USD is not a positive number`);
  if (!Number.isFinite(price) || price <= 0) return no("unit-sanity", `price ${price} is not a positive number`);
  if (!Number.isFinite(ctx.oraclePrice) || ctx.oraclePrice <= 0) return no("unit-sanity", "oracle price is missing or not positive");
  const ratio = price / ctx.oraclePrice;
  if (ratio > 5 || ratio < 0.2) {
    return no("unit-sanity", `price ${price} is ${ratio.toFixed(1)}x the oracle price ${ctx.oraclePrice.toFixed(2)}; wrong unit?`);
  }

  // 2. max-oracle-age: an old oracle price is a wrong price
  if (ctx.oracleAgeSec > limits.maxOracleAgeSec) {
    return no("max-oracle-age", `oracle is ${ctx.oracleAgeSec} s old, limit is ${limits.maxOracleAgeSec} s`);
  }

  // 3. max-notional: cap how much one order can risk
  if (sizeUsd > limits.maxNotionalUsd) {
    return no("max-notional", `${sizeUsd} USD exceeds the ${limits.maxNotionalUsd} USD limit`);
  }

  // 4. max-oracle-gap: the order price must be close to the oracle price
  const gap = (Math.abs(price - ctx.oraclePrice) / ctx.oraclePrice) * 10_000;
  if (gap > limits.maxOracleGapBps) {
    return no("max-oracle-gap", `price is ${gap.toFixed(1)} bps from the oracle, limit is ${limits.maxOracleGapBps} bps`);
  }
  return ok();
}

export function describeRules(limits: RiskLimits = DEFAULT_LIMITS) {
  return [
    { id: "max-notional", description: "Reject any order bigger than the notional limit", limit: limits.maxNotionalUsd, unit: "USD" },
    { id: "max-oracle-gap", description: "Reject if the order price is too far from the oracle price", limit: limits.maxOracleGapBps, unit: "bps" },
    { id: "max-oracle-age", description: "Reject if the oracle price is older than the limit", limit: limits.maxOracleAgeSec, unit: "seconds" },
    { id: "unit-sanity", description: "Reject non-positive, non-numeric or wrong-unit values (e.g. cents, lamports)", limit: null, unit: null },
  ];
}
