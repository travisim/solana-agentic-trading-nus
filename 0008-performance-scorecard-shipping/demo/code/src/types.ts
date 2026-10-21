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

/** One closed trade in the ledger. This is the only thing the scorecard needs. Costs are NOT stored: the scorecard applies them. */
export interface LedgerTrade {
  id: number;
  strategy: string;
  side: "long" | "short";
  openT: number; // unix seconds
  closeT: number; // unix seconds
  entry: number; // USD per SOL
  exit: number; // USD per SOL
  notionalUsd: number;
  grossUsd: number; // P&L before fees and slippage
  legs: number; // how many legs pay costs (one buy or one sell = one leg)
  paysSlippage: boolean;
  // Optional on-chain fields. Leave them out when you have no real transactions; the scorecard says "n/a" instead of guessing.
  status?: "confirmed" | "failed";
  signature?: string; // transaction signature, for an explorer link
  cluster?: "devnet" | "mainnet-beta";
  baseFeeLamports?: number;
  priorityFeeLamports?: number;
  jitoTipLamports?: number;
}

export interface Ledger {
  note: string;
  pair: "SOL/USDC";
  capitalUsd: number;
  windowStartT: number;
  windowEndT: number;
  intervalSec: number; // spacing of the time grid the equity curve is sampled on
  trades: LedgerTrade[];
}
