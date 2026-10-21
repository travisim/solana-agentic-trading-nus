// Shared types. These mirror the JSON files in out/ and recorded/.

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
  mode: "recorded" | "live";
  source: string;
  swaps: Swap[];
}

/** What the recorder writes before demo.ts stamps mode and capturedAt (oldest first). */
export interface RawSwapFile {
  pool: string;
  pair: "SOL/USDC";
  capturedAt: string;
  source: string;
  swaps: Swap[];
  scanned?: { listed: number; failedTx: number; notSwaps: number };
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

export interface PythReads {
  pair: "SOL/USD";
  intervalSec: number;
  account: string;
  failures: number;
  reads: { t: number; price: number; confBps: number; publishTime: number; postedSlot: number; currentSlot: number }[];
}
