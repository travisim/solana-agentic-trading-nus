// Shared types. These mirror the JSON files in out/ and recorded/.

export type Side = "buy" | "sell";

/** recorded/series.json (copied from build night 1): SOL/USD prices from three sources, every 5 s. */
export interface SeriesPoint {
  t: number; // unix seconds
  jupiter: number; // Jupiter quote for 1 SOL
  pyth: number; // Pyth oracle
  orca: number; // Orca pool marginal price (no fee, no impact)
}
export interface Series {
  pair: "SOL/USDC";
  intervalSec: number;
  points: SeriesPoint[];
}

/** One real Jupiter quote used for the price-impact curve (recorded/jupiter-impact.json). */
export interface ImpactQuote {
  side: Side; // buy = USDC -> token, sell = token -> USDC (trader's view of the token)
  sizeUsd: number; // intended size in USD
  inAmount: string;
  outAmount: string;
  execPrice: number; // USDC per token actually quoted for this size
  impactBps: number; // Jupiter's priceImpactPct converted to basis points (1 % = 100 bps)
  jupiterImpactPct: string; // Jupiter's own priceImpactPct field, verbatim
  routes: string[];
}
export interface ImpactPair {
  id: string; // "SOL/USDC"
  note: string;
  quotes: ImpactQuote[];
}
export interface ImpactFile {
  capturedAt: string;
  source: string;
  pairs: ImpactPair[];
}

/** recorded/token-balances.json: real SPL token accounts read with getAccountInfo. */
export interface TokenBalance {
  label: string;
  address: string;
  mint: string;
  owner: string;
  amountRaw: string;
  decimals: number;
  amount: number;
  slot: number;
}
export interface BalancesFile {
  capturedAt: string;
  source: string;
  balances: TokenBalance[];
}

export interface Signal {
  t: number;
  side: 1 | -1; // +1 long SOL, -1 short SOL
  z: number; // momentum z-score that triggered it
  p: number; // confidence: stand-in for "probability this call is right"
}

/** One bet (AFML-style: a signal with a start and an end). */
export interface Bet {
  id: number;
  tOpen: number;
  tClose: number;
  side: 1 | -1;
  p: number;
  m: number; // signed size in [-1, 1] from confidence
}

// Risk hook types, copied from build night 1 (0002 demo-repo/code/src/types.ts).
export interface Order {
  side: Side;
  sizeUsd: number;
  price: number;
}
export interface RiskContext {
  oraclePrice: number; // USD per SOL from the oracle
  oracleAgeSec: number; // seconds since the oracle last published
}
export interface RiskLimits {
  maxNotionalUsd: number;
  maxOracleGapBps: number;
  maxOracleAgeSec: number;
}
export interface RiskDecision {
  ok: boolean;
  rule: "max-notional" | "max-oracle-gap" | "max-oracle-age" | "unit-sanity" | null;
  reason: string;
}
export type RiskVerdict = RiskDecision;

export interface Fill {
  price: number; // USDC per SOL paid or received, after impact
  qtySol: number; // always positive; sign comes from the order side
  impactBps: number;
  feeUsd: number;
}

export interface LedgerRow {
  seq: number;
  t: number;
  trigger: "signal-open" | "signal-expire" | "injected";
  note: string;
  activeBets: number;
  targetFraction: number; // signed, share of the exposure cap
  targetUsd: number; // signed
  currentUsd: number; // signed exposure before this order
  order: { side: Side; sizeUsd: number; price: number };
  oraclePrice: number;
  oracleAgeSec: number;
  verdict: RiskVerdict;
  fill: Fill | null; // null when rejected
  cashUsd: number; // after this row
  posSol: number; // after this row (negative = simulated short)
  equityUsd: number; // cash + position marked at the oracle price
  prevHash: string;
  hash: string;
}

export interface SizingParams {
  startUsd: number;
  maxFraction: number; // exposure cap as a share of equity
  step: number; // discrete size step, share of cap
  maxImpactBps: number;
  minOrderUsd: number;
}
