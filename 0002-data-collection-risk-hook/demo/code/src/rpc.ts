// Tiny fetch helpers with clear errors. No dependencies.

export const RPC_URL = process.env["SOLANA_RPC_URL"] ?? "https://api.mainnet.solana.com";

export class RateLimitError extends Error {
  constructor(host: string) {
    super(
      `HTTP 429 (rate limited) from ${host}. The public endpoint is asking us to slow down. ` +
        `Wait a minute and retry, or use --recorded (bundled real data, no network needed).`,
    );
    this.name = "RateLimitError";
  }
}

export async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const host = new URL(url).host;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (res.status === 429) throw new RateLimitError(host);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`);
  return res.json();
}

interface RpcAccountInfo {
  context: { slot: number };
  value: { data: [string, string]; owner: string } | null;
}

/** Read one account over JSON-RPC. Returns raw bytes, owner and the slot of the read. */
export async function getAccount(
  address: string,
): Promise<{ bytes: Uint8Array; owner: string; slot: number }> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [address, { encoding: "base64", commitment: "confirmed" }],
  };
  const json = (await getJson(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })) as { result?: RpcAccountInfo; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  const value = json.result?.value;
  if (!value) throw new Error(`account ${address} not found`);
  return {
    bytes: Uint8Array.from(Buffer.from(value.data[0], "base64")),
    owner: value.owner,
    slot: json.result!.context.slot,
  };
}
