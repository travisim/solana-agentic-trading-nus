// Collector 3: POOL price. Orca Whirlpool (concentrated liquidity) SOL/USDC, read on-chain.
//
// Pool: SOL/USDC, tick spacing 4, fee 0.04%. Address found via Orca's public API
// (https://api.orca.so/v2/solana/pools) and checked against the account's own mint fields.
// Account is owned by the Whirlpools program whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc.
// Layout (bytes, from the Orca whirlpools SDK `Whirlpool` struct):
// 0..8 discriminator | 8..40 config | 40 bump | 41..43 tickSpacing u16 | 43..45 feeTierSeed |
// 45..47 feeRate u16 (hundredths of a bp) | 47..49 protocolFeeRate | 49..65 liquidity u128 |
// 65..81 sqrtPrice u128 (Q64.64) | 81..85 tickCurrentIndex i32 | 85..101 protocol fees owed |
// 101..133 mintA | 133..165 vaultA | 165..181 feeGrowthGlobalA | 181..213 mintB
import type { VenueQuote } from "../types.ts";
import { getAccount } from "../rpc.ts";

export const WHIRLPOOL_PROGRAM = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const SOL_USDC_POOL = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

/** price (USDC per SOL) = (sqrtPrice / 2^64)^2 * 10^(decimalsA - decimalsB) */
export function priceFromSqrtPrice(sqrtPriceX64: bigint): number {
  const root = Number(sqrtPriceX64) / 2 ** 64;
  return root * root * 10 ** (SOL_DECIMALS - USDC_DECIMALS);
}

export function decodeWhirlpool(bytes: Uint8Array): { sqrtPrice: bigint; price: number; feeRate: number; mintA: string; mintB: string } {
  if (bytes.length < 213) throw new Error(`Whirlpool account too short: ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sqrtPrice = view.getBigUint64(65, true) | (view.getBigUint64(73, true) << 64n);
  return {
    sqrtPrice,
    price: priceFromSqrtPrice(sqrtPrice),
    feeRate: view.getUint16(45, true),
    mintA: base58(bytes.slice(101, 133)),
    mintB: base58(bytes.slice(181, 213)),
  };
}

export async function orcaPool(): Promise<VenueQuote> {
  const acc = await getAccount(SOL_USDC_POOL);
  if (acc.owner !== WHIRLPOOL_PROGRAM) throw new Error(`unexpected pool owner ${acc.owner}`);
  const pool = decodeWhirlpool(acc.bytes);
  if (pool.mintA !== SOL_MINT || pool.mintB !== USDC_MINT) throw new Error("pool is not SOL/USDC");
  return {
    id: "orca",
    label: "Orca SOL/USDC pool",
    price: pool.price,
    ts: Math.floor(Date.now() / 1000),
    source: "whirlpool sqrtPrice via RPC",
  };
}

// Minimal base58 encoder (so mint addresses can be compared as text).
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}
