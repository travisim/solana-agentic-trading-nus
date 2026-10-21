// Shared types. These mirror the JSON files in out/ and recorded/.

export interface VenueQuote {
  id: "jupiter" | "pyth" | "orca";
  label: string;
  price: number; // USD per SOL
  ts?: number; // unix seconds when we read it
  confBps?: number; // pyth only: confidence interval in basis points
  publishTime?: number; // pyth only: publisher clock, unix seconds
  postedSlot?: number; // pyth only: slot the update was posted at
  currentSlot?: number; // pyth only: slot of the RPC read
  source: string;
}

export interface Prices {
  generatedAt: string;
  mode: "recorded" | "live";
  pair: "SOL/USDC";
  venues: VenueQuote[];
  gapBps: { jupiterVsPyth: number; orcaVsPyth: number; jupiterVsOrca: number };
}

export interface SeriesPoint {
  t: number; // unix seconds
  jupiter: number;
  pyth: number;
  orca: number;
}

export interface Series {
  pair: "SOL/USDC";
  intervalSec: number;
  points: SeriesPoint[];
}

export interface Costs {
  feeBps: number; // charged on every leg
  slippageBps: number; // charged on every leg
}

export interface StrategyResult {
  id: string;
  name: string;
  family: string;
  dataNeeds: string[];
  trades: number;
  pnlGrossUsd: number;
  pnlNetUsd: number;
  hitRate: number; // share of trades with net P&L > 0 (0 when there are no trades)
  // Extra fields so a chart can re-price the same trades with other costs:
  // net = pnlGrossUsd - trades * legsPerTrade * (feeBps + (paysSlippage ? slippageBps : 0)) / 10000 * notionalUsd
  notionalUsd: number;
  legsPerTrade: number;
  /** false when the strategy is simulated with fees only (the market maker earns the spread, so no slippage is charged). */
  paysSlippage: boolean;
}

export interface Order {
  side: "buy" | "sell";
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
