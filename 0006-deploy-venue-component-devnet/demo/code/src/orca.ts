// Orca Whirlpool account decoder (reference price only). Layout and pool address verified in build nights 1 and 2.
//   8 discriminator | 32 config | 1 bump | tickSpacing u16 @41 | 2 seed | feeRate u16 @45 (hundredths of a bp) | protocolFeeRate u16 |
//   liquidity u128 @49 | sqrtPrice u128 @65 (Q64.64) | tickCurrentIndex i32 @81 | ... | mintA @101 | vaultA @133 | ... | mintB @181 | vaultB @213
import { getAccount } from "./rpc.ts";
import { base58 } from "./base58.ts";

export const WHIRLPOOL_PROGRAM = "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc";
export const SOL_USDC_POOL = "Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export interface OrcaPool {
  price: number; // USDC per SOL
  tickSpacing: number;
  feeRatePct: number;
  tickCurrentIndex: number;
}

export function decodeOrcaPool(bytes: Uint8Array): OrcaPool {
  if (bytes.length < 245) throw new Error(`whirlpool account too short: ${bytes.length}`);
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (base58(bytes.slice(101, 133)) !== SOL_MINT || base58(bytes.slice(181, 213)) !== USDC_MINT) throw new Error("pool is not SOL/USDC");
  const sqrt = (v.getBigUint64(73, true) << 64n) | v.getBigUint64(65, true);
  const r = Number(sqrt) / 2 ** 64;
  return { price: r * r * 1000, tickSpacing: v.getUint16(41, true), feeRatePct: v.getUint16(45, true) / 1e4, tickCurrentIndex: v.getInt32(81, true) };
}

export async function readOrca(): Promise<OrcaPool & { slot: number }> {
  const a = await getAccount(SOL_USDC_POOL);
  if (a.owner !== WHIRLPOOL_PROGRAM) throw new Error(`unexpected owner ${a.owner}`);
  return { ...decodeOrcaPool(a.bytes), slot: a.slot };
}
