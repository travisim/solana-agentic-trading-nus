// Shared types. These mirror the JSON files in out/ and recorded/.
// Swap, Bar and PythReads come from build night 2 (0003); Order and the risk types from build night 1 (0002).

export type Side = "buy" | "sell"; // from the trader's view of SOL

export interface Swap {
  t: number; // block time, unix seconds
  slot: number;
  side: Side;
  solAmount: number;
  usdcAmount: number;
  price: number; // usdcAmount / solAmount (USDC per SOL, includes the pool fee)
  sig: string;
}

export interface SwapFile {
  pool: string;
  pair: "SOL/USDC";
  capturedAt: string;
  mode?: "recorded" | "live";
  source: string;
  swaps: Swap[];
}

export interface Bar {
  tStart: number;
  tEnd: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
  count: number;
}

export interface PythRead { t: number; price: number; confBps: number; publishTime: number; postedSlot: number; currentSlot: number }
export interface PythReads {
  pair: "SOL/USD";
  intervalSec: number;
  account: string;
  failures: number;
  reads: PythRead[];
}

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
