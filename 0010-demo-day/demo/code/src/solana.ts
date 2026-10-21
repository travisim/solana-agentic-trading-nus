// Read-only Solana helpers (Node). No keys, no wallets, no writes: only getSlot and getSignatureStatuses.
// Browsers use lab/shared/live.js, which does the same two calls.
import type { SigCheck, SigStatus } from "./types.ts";

export const MAINNET_RPC = process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet.solana.com";
export const DEVNET_RPC = process.env["SOLANA_DEVNET_RPC_URL"] ?? "https://api.devnet.solana.com";

export class RateLimitError extends Error {
  constructor(host: string) {
    super(`HTTP 429 (rate limited) from ${host}. Wait a minute and retry, or use --recorded (bundled real data, no network needed).`);
    this.name = "RateLimitError";
  }
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function rpc<T>(url: string, method: string, params: unknown[], retried = false): Promise<T> {
  const host = new URL(url).host;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429) {
    if (!retried) {
      await sleep(1500);
      return rpc<T>(url, method, params, true);
    }
    throw new RateLimitError(host);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`);
  const j = (await res.json()) as { result?: T; error?: { code: number; message: string } };
  if (j.error) throw new Error(`RPC error ${j.error.code}: ${j.error.message}`);
  return j.result as T;
}

export const getSlot = (url: string = MAINNET_RPC): Promise<number> => rpc<number>(url, "getSlot", [{ commitment: "confirmed" }]);

interface StatusRow {
  slot: number;
  err: unknown;
  confirmationStatus?: string;
}

/** Read-only: asks devnet what it knows about each signature. Never sends anything. */
export async function getSignatureStatuses(signatures: string[], url: string = DEVNET_RPC): Promise<SigCheck[]> {
  if (signatures.length === 0) return [];
  const r = await rpc<{ value: (StatusRow | null)[] }>(url, "getSignatureStatuses", [signatures, { searchTransactionHistory: true }]);
  const checkedAt = new Date().toISOString();
  return signatures.map((signature, i): SigCheck => {
    const row = r.value[i] ?? null;
    let status: SigStatus = "not-found";
    if (row) status = row.err ? "failed" : ((row.confirmationStatus as SigStatus | undefined) ?? "processed");
    return { signature, cluster: "devnet", status, slot: row ? row.slot : null, err: row ? row.err : null, checkedAt, mode: "live" };
  });
}
