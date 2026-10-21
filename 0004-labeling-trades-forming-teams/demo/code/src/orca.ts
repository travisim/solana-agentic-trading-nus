// Orca Whirlpool SOL/USDC pool price, read on-chain (copied from build night 1, 0002 src/collectors/orca.ts).
// Layout (bytes): 0..8 discriminator | 45..47 feeRate | 65..81 sqrtPrice u128 (Q64.64) | 101..133 mintA | 181..213 mintB
import { base58 } from "./base58.ts";
import { getAccount } from "./rpc.ts";

export const WHIRLPOOL_PROGRAM = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const SOL_USDC_POOL = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** price (USDC per SOL) = (sqrtPrice / 2^64)^2 * 10^(9 - 6) */
export function priceFromSqrtPrice(sqrtPriceX64: bigint): number {
  const root = Number(sqrtPriceX64) / 2 ** 64;
  return root * root * 10 ** 3;
}

export function decodeWhirlpool(bytes: Uint8Array): { price: number; mintA: string; mintB: string } {
  if (bytes.length < 213) throw new Error(`Whirlpool account too short: ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sqrtPrice = view.getBigUint64(65, true) | (view.getBigUint64(73, true) << 64n);
  return { price: priceFromSqrtPrice(sqrtPrice), mintA: base58(bytes.slice(101, 133)), mintB: base58(bytes.slice(181, 213)) };
}

export async function readOrcaPrice(): Promise<number> {
  const acc = await getAccount(SOL_USDC_POOL);
  if (acc.owner !== WHIRLPOOL_PROGRAM) throw new Error(`unexpected pool owner ${acc.owner}`);
  const pool = decodeWhirlpool(acc.bytes);
  if (pool.mintA !== SOL_MINT || pool.mintB !== USDC_MINT) throw new Error("pool is not SOL/USDC");
  return pool.price;
}
