// Tiny JSON-RPC helpers with clear errors and polite back-off. No dependencies.
// Adapted from build night 2 (0003 demo-repo/code/src/rpc.ts), extended with a cluster choice.

export const MAINNET_RPC = process.env["SOLANA_RPC_URL"] ?? "https://solana-rpc.publicnode.com";
export const DEVNET_RPC = process.env["SOLANA_DEVNET_RPC_URL"] ?? "https://api.devnet.solana.com";

export class RateLimitError extends Error {
  constructor(host: string) {
    super(
      `HTTP 429 (rate limited) from ${host}. The public endpoint is asking us to slow down. ` +
        `Wait a minute and retry, or use --recorded (bundled real data, no network needed).`,
    );
    this.name = "RateLimitError";
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const host = new URL(url).host;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (res.status === 429) throw new RateLimitError(host);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`);
  return res.json();
}

/** One JSON-RPC call. Throws RateLimitError on HTTP 429 or a 429 inside the JSON body. */
export async function rpcOnce<T>(method: string, params: unknown[], url: string = MAINNET_RPC): Promise<T> {
  const json = (await getJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })) as { result?: T; error?: { code: number; message: string; data?: unknown } };
  if (json.error) {
    if (json.error.code === 429) throw new RateLimitError(new URL(url).host);
    const e = new Error(`RPC error ${json.error.code}: ${json.error.message}`);
    (e as Error & { data?: unknown }).data = json.error.data;
    throw e;
  }
  return json.result as T;
}

/** Like rpcOnce but backs off and retries on 429 and transient errors (1 s, 2 s, 4 s ... up to 30 s). */
export async function rpcCall<T>(method: string, params: unknown[], opts: { retries?: number; url?: string } = {}): Promise<T> {
  const retries = opts.retries ?? 6;
  let wait = 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await rpcOnce<T>(method, params, opts.url ?? MAINNET_RPC);
    } catch (e) {
      const transient = e instanceof RateLimitError || /fetch failed|HTTP 5\d\d|timed out|aborted/.test((e as Error).message);
      if (!transient || attempt >= retries) throw e;
      console.log(`  ${e instanceof RateLimitError ? "429 rate limited" : "transient error"}; waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
      await sleep(wait);
      wait = Math.min(wait * 2, 30_000);
    }
  }
}

export interface AccountRead {
  bytes: Uint8Array;
  owner: string;
  slot: number;
  lamports: number;
}

/** Read one account over JSON-RPC. Returns raw bytes, owner, lamports and the slot of the read. */
export async function getAccount(address: string, url: string = MAINNET_RPC, commitment = "confirmed"): Promise<AccountRead> {
  const result = await rpcCall<{ context: { slot: number }; value: { data: [string, string]; owner: string; lamports: number } | null }>(
    "getAccountInfo",
    [address, { encoding: "base64", commitment }],
    { url },
  );
  if (!result?.value) throw new Error(`account ${address} not found`);
  return {
    bytes: Uint8Array.from(Buffer.from(result.value.data[0], "base64")),
    owner: result.value.owner,
    slot: result.context.slot,
    lamports: result.value.lamports,
  };
}

/** https://host -> wss://host ; a local validator serves the websocket one port above its RPC port (8899 -> 8900) */
export const wsUrlFor = (httpUrl: string) => httpUrl.replace(/^http/, "ws").replace(":8899", ":8900");
