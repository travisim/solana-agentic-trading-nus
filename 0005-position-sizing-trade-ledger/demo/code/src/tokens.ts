// Read a real SPL token account over JSON-RPC (inventory from real token accounts).
// We use getAccountInfo and decode the account bytes ourselves: public RPCs often refuse the
// convenience method getTokenAccountBalance ("indexed request"), but they all serve getAccountInfo.
import { getAccount } from "./rpc.ts";
import type { TokenBalance } from "./types.ts";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}

const KNOWN_DECIMALS: Record<string, number> = {
  So11111111111111111111111111111111111111112: 9, // wrapped SOL
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 6, // USDC
};

/** SPL token account layout: mint 0..32, owner 32..64, amount 64..72 (u64 little endian). */
export function decodeTokenAccount(bytes: Uint8Array): { mint: string; owner: string; amountRaw: bigint } {
  if (bytes.length < 165) throw new Error(`not a token account: ${bytes.length} bytes`);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { mint: base58(bytes.slice(0, 32)), owner: base58(bytes.slice(32, 64)), amountRaw: dv.getBigUint64(64, true) };
}

export async function readTokenAccount(address: string, label: string, rpcUrl?: string): Promise<TokenBalance> {
  const acc = await getAccount(address, rpcUrl);
  const d = decodeTokenAccount(acc.bytes);
  const decimals = KNOWN_DECIMALS[d.mint];
  if (decimals === undefined) throw new Error(`unknown mint ${d.mint}; add its decimals to KNOWN_DECIMALS`);
  return { label, address, mint: d.mint, owner: d.owner, amountRaw: d.amountRaw.toString(), decimals, amount: Number(d.amountRaw) / 10 ** decimals, slot: acc.slot };
}
