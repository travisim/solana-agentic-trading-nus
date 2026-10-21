import { readFileSync } from "node:fs";
import type { Series } from "../src/types.ts";

/** Real account bytes captured from public mainnet RPC on 2026-10-21 (see recorded/SOURCES.md). */
export function fixtureBytes(address: string): { bytes: Uint8Array; owner: string; slot: number } {
  const j = JSON.parse(readFileSync(new URL(`./fixtures/${address}.rpc.json`, import.meta.url), "utf8"));
  return { bytes: Uint8Array.from(Buffer.from(j.result.value.data[0], "base64")), owner: j.result.value.owner, slot: j.result.context.slot };
}

export function seriesOf(rows: [number, number, number][]): Series {
  return { pair: "SOL/USDC", intervalSec: 5, points: rows.map(([jupiter, pyth, orca], i) => ({ t: 1000 + i * 5, jupiter, pyth, orca })) };
}
