import { readFileSync } from "node:fs";
import type { Swap } from "../src/types.ts";

/** Real account bytes captured from public mainnet RPC on 2026-10-21 (copied from build night 1 fixtures). */
export function fixtureBytes(address: string): { bytes: Uint8Array; owner: string; slot: number } {
  const j = JSON.parse(readFileSync(new URL(`./fixtures/${address}.rpc.json`, import.meta.url), "utf8"));
  return { bytes: Uint8Array.from(Buffer.from(j.result.value.data[0], "base64")), owner: j.result.value.owner, slot: j.result.context.slot };
}

/** A constructed swap for tests: [t, price, usdc]. */
export function swapsOf(rows: [number, number, number][]): Swap[] {
  return rows.map(([t, price, usdc], i) => ({ t, slot: 1000 + i, side: i % 2 ? "sell" : "buy", solAmount: usdc / price, usdcAmount: usdc, price, sig: `sig${i}` }));
}
