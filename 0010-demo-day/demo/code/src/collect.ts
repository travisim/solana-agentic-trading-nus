// Re-records the two small real-data files in recorded/:
//   network.json          two real mainnet getSlot reads a few seconds apart (gives a slots-per-second figure)
//   signature-checks.json real devnet getSignatureStatuses for the sample transactions used by the example projects
// Read-only. Run:  npm run collect
import { writeFileSync } from "node:fs";
import { DEVNET_RPC, MAINNET_RPC, getSignatureStatuses, getSlot } from "./solana.ts";
import type { NetworkInfo } from "./types.ts";

// Two real devnet Memo transactions found on 2026-10-22 with getSignaturesForAddress(MemoSq4g...). They belong to
// nobody in this program. They stand in for the signature a student would paste in projects.json.
export const SAMPLE_SIGNATURES = [
  "2eGnTvKicstuqrVfVpDmmM9HExLGw4yMUEbLaHFCvGaxiVkdiGmrtPjXEfuSBTeb8K4wHyXmoweV39hKkWkrTXY6",
  "5YiqBdZzRSYKnZh3G6ALiGWiwt9C4qqhdFBj71w7WopTE9ofpAdo5aAHy7sqRJdgtxJ4AjCf7uiSccwg2jUsu1T7",
];

const root = new URL("../", import.meta.url).pathname;
const t0 = Date.now();
const a = await getSlot();
const ta = Date.now();
await new Promise((r) => setTimeout(r, 6000));
const b = await getSlot();
const tb = Date.now();
const net: NetworkInfo = {
  cluster: "mainnet-beta",
  slot: b,
  capturedAt: new Date(tb).toISOString(),
  slotsPerSecond: Math.round(((b - a) / ((tb - ta) / 1000)) * 100) / 100,
  source: `getSlot (confirmed) twice, ${((tb - ta) / 1000).toFixed(1)} s apart, from ${new URL(MAINNET_RPC).host}; first read slot ${a}`,
  mode: "recorded",
};
writeFileSync(`${root}recorded/network.json`, JSON.stringify(net, null, 2) + "\n");
console.log("network:", net);

const checks = await getSignatureStatuses(SAMPLE_SIGNATURES, DEVNET_RPC);
for (const c of checks) c.mode = "recorded";
writeFileSync(`${root}recorded/signature-checks.json`, JSON.stringify({ source: `getSignatureStatuses (searchTransactionHistory) from ${new URL(DEVNET_RPC).host}`, capturedAt: new Date().toISOString(), checks }, null, 2) + "\n");
console.log("signature checks:", checks.map((c) => `${c.signature.slice(0, 8)}... ${c.status} slot ${c.slot}`));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
