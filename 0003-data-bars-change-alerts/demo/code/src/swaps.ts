// Collector: REAL Orca SOL/USDC swaps, read from public mainnet RPC. No API key.
//
// How a swap is found (verified live, see recorded/SOURCES.md):
//  1. getAccount(pool) -> the Whirlpool account holds the two token VAULTS (where the pool keeps its SOL and USDC).
//     Layout (bytes): 101..133 mintA (SOL) | 133..165 vaultA | 181..213 mintB (USDC) | 213..245 vaultB.
//  2. getSignaturesForAddress(pool) -> newest-first list of transactions that touched the pool.
//  3. getTransaction(sig, jsonParsed) -> meta.preTokenBalances / postTokenBalances give the vault balances
//     before and after. A swap moves the two vaults in OPPOSITE directions:
//        SOL vault up, USDC vault down  -> the trader SOLD SOL  (side "sell")
//        SOL vault down, USDC vault up  -> the trader BOUGHT SOL (side "buy")
//     Same-direction changes (liquidity add/remove) and failed transactions are skipped and counted.
//  price = USDC moved / SOL moved (so it includes the 0.04% pool fee, which stays in the vault).
import { base58 } from "./base58.ts";
import { SOL_USDC_POOL, SOL_MINT, USDC_MINT, WHIRLPOOL_PROGRAM } from "./orca.ts";
import { RPC_URL, getAccount, rateLimit, rpcCall, sleep } from "./rpc.ts";
import type { RawSwapFile, Swap } from "./types.ts";

export interface SigInfo { signature: string; slot: number; blockTime: number | null; err: unknown }

interface TokenBalance { accountIndex: number; mint: string; uiTokenAmount: { amount: string; decimals: number } }
export interface ParsedTx {
  slot: number;
  blockTime: number | null;
  meta: { err: unknown; preTokenBalances?: TokenBalance[]; postTokenBalances?: TokenBalance[] } | null;
  transaction: { message: { accountKeys: ({ pubkey: string } | string)[] } };
}

export interface Vaults { solVault: string; usdcVault: string }

/** Find the pool's two token vaults from the pool account itself (checks owner and both mints). */
export async function loadVaults(pool: string = SOL_USDC_POOL): Promise<Vaults> {
  const acc = await getAccount(pool);
  if (acc.owner !== WHIRLPOOL_PROGRAM) throw new Error(`unexpected pool owner ${acc.owner}`);
  const b = acc.bytes;
  if (b.length < 245) throw new Error(`Whirlpool account too short: ${b.length}`);
  if (base58(b.slice(101, 133)) !== SOL_MINT || base58(b.slice(181, 213)) !== USDC_MINT) throw new Error("pool is not SOL/USDC");
  return { solVault: base58(b.slice(133, 165)), usdcVault: base58(b.slice(213, 245)) };
}

/** Pure: turn one parsed transaction into a swap, or null (failed tx, not a swap). Exported for tests. */
export function swapFromTx(sig: string, tx: ParsedTx, v: Vaults): Swap | null {
  if (!tx.meta || tx.meta.err || tx.blockTime == null) return null;
  const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === "string" ? k : k.pubkey));
  const delta = (vault: string, mint: string): number | null => {
    const idx = keys.indexOf(vault);
    if (idx < 0) return null;
    const find = (list?: TokenBalance[]) => list?.find((b) => b.accountIndex === idx && b.mint === mint);
    const pre = find(tx.meta!.preTokenBalances);
    const post = find(tx.meta!.postTokenBalances);
    if (!pre || !post) return null;
    return (Number(post.uiTokenAmount.amount) - Number(pre.uiTokenAmount.amount)) / 10 ** pre.uiTokenAmount.decimals;
  };
  const dSol = delta(v.solVault, SOL_MINT);
  const dUsdc = delta(v.usdcVault, USDC_MINT);
  if (dSol === null || dUsdc === null || dSol === 0 || dUsdc === 0) return null;
  if (Math.sign(dSol) === Math.sign(dUsdc)) return null; // liquidity change, not a swap
  const solAmount = Math.abs(dSol);
  const usdcAmount = Math.abs(dUsdc);
  return {
    t: tx.blockTime,
    slot: tx.slot,
    side: dSol > 0 ? "sell" : "buy",
    solAmount: round(solAmount, 9),
    usdcAmount: round(usdcAmount, 6),
    price: round(usdcAmount / solAmount, 6),
    sig,
  };
}

// Public endpoints rate-limit per method (measured 2026-10-21): api.mainnet.solana.com allows about 10 getTransaction
// calls per 10 s (so 1 per second); solana-rpc.publicnode.com sustained about 7 per second with 2 parallel workers (4 workers with no gap got 429s).
// getTransaction calls are therefore spaced out by a gap chosen from the host. 429s are retried with back-off.
const gapMs = (): number => Number(process.env["SWAP_GAP_MS"] ?? (new URL(RPC_URL).host === "api.mainnet.solana.com" ? 1100 : 100));
let nextSlot = 0;
async function throttle(): Promise<void> {
  const at = Math.max(Date.now(), nextSlot, rateLimit.pauseUntil);
  nextSlot = at + gapMs();
  await sleep(Math.max(0, at - Date.now()));
}

export interface CollectOptions {
  count: number;
  before?: string; // start strictly before this signature (older), default: newest
  pool?: string;
  concurrency?: number;
  onProgress?: (partial: RawSwapFile) => void;
}

/** Collect `count` real swaps, walking back in time from `before` (or from the newest). Returned oldest first. */
export async function collectSwaps(opts: CollectOptions): Promise<RawSwapFile> {
  const pool = opts.pool ?? SOL_USDC_POOL;
  const vaults = await loadVaults(pool);
  const concurrency = opts.concurrency ?? Number(process.env["SWAP_CONCURRENCY"] ?? 2);
  const found: Swap[] = [];
  const scanned = { listed: 0, failedTx: 0, notSwaps: 0 };
  let cursor = opts.before;
  let lastLogged = 0;
  let fetched = 0;
  const snapshot = (): RawSwapFile => ({
    pool,
    pair: "SOL/USDC",
    capturedAt: new Date().toISOString(),
    source: "Orca Whirlpool SOL/USDC; getSignaturesForAddress(pool) + getTransaction(jsonParsed) vault token-balance deltas",
    swaps: [...found].sort((a, b) => a.t - b.t || a.slot - b.slot),
    scanned: { ...scanned },
  });
  while (found.length < opts.count) {
    const page = await rpcCall<SigInfo[]>("getSignaturesForAddress", [pool, { limit: 1000, ...(cursor ? { before: cursor } : {}) }]);
    if (page.length === 0) break;
    cursor = page.at(-1)!.signature;
    const ok = page.filter((s) => {
      scanned.listed++;
      if (s.err) scanned.failedTx++;
      return !s.err;
    });
    let next = 0;
    const worker = async () => {
      while (next < ok.length && found.length < opts.count) {
        const s = ok[next++]!;
        await throttle();
        fetched++;
        if (fetched % 250 === 0) console.log(`${new Date().toISOString()} fetched=${fetched} swaps=${found.length}`);
        const tx = await rpcCall<ParsedTx | null>("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed" }]);
        if (!tx) { scanned.notSwaps++; continue; }
        const swap = swapFromTx(s.signature, tx, vaults);
        if (swap) found.push(swap);
        else scanned.notSwaps++;
        if (found.length % 100 === 0 && found.length > lastLogged) {
          lastLogged = found.length;
          opts.onProgress?.(snapshot());
          console.log(`${new Date().toISOString()} swaps=${found.length}/${opts.count} scanned=${scanned.listed}`);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
  const out = snapshot();
  out.swaps = out.swaps.slice(-opts.count); // oldest-first; trim any overshoot from the oldest end
  return out;
}

function round(x: number, d: number): number {
  return Math.round(x * 10 ** d) / 10 ** d;
}

export const MIN_SWAP_USD = 1;
export const MAX_OUTLIER_PCT = 1;

/**
 * Clean the recorded swaps before analysis. Two simple, visible rules (counts are printed by the demo):
 *  0. duplicates: the same transaction signature twice (can happen where two recording runs meet) is kept once;
 *  1. dust: swaps under 1 USDC are dropped (the price is computed as USDC / SOL, so tiny amounts are mostly rounding noise);
 *  2. outliers: a swap whose price is more than 1% away from the median of the 21 swaps around it is dropped
 *     (a transaction that did more than one thing, so the vault change is not one clean swap).
 * Input must be oldest first. Nothing is repaired or invented; swaps are only kept or dropped.
 */
export function filterSwaps(swaps: Swap[]): { kept: Swap[]; dust: number; outliers: number; duplicates: number } {
  const seen = new Set<string>();
  const unique = swaps.filter((s) => (seen.has(s.sig) ? false : (seen.add(s.sig), true)));
  const big = unique.filter((s) => s.usdcAmount >= MIN_SWAP_USD);
  const kept: Swap[] = [];
  big.forEach((s, i) => {
    const win = big.slice(Math.max(0, i - 10), i + 11).map((x) => x.price).sort((a, b) => a - b);
    const med = win[Math.floor(win.length / 2)]!;
    if (Math.abs(s.price / med - 1) * 100 <= MAX_OUTLIER_PCT) kept.push(s);
  });
  return { kept, dust: unique.length - big.length, outliers: big.length - kept.length, duplicates: swaps.length - unique.length };
}
