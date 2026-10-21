// Tiny JSON-RPC helpers with clear errors and polite back-off. No dependencies.
// Copied from build night 2 (0003 demo-repo/code/src/rpc.ts), which adapted build night 1: getJson, getAccount, rpcCall with retries.

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

/** Shared pause: when one call is rate limited, every worker waits . */
export const rateLimit = { pauseUntil: 0 };

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const host = new URL(url).host;
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) throw new RateLimitError(host);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`);
  return res.json();
}

/** One JSON-RPC call. Throws RateLimitError on HTTP 429 (no retry; the caller decides). */
export async function rpcOnce<T>(method: string, params: unknown[], url: string = RPC_URL): Promise<T> {
  const json = (await getJson(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })) as { result?: T; error?: { code: number; message: string } };
  if (json.error) throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  return json.result as T;
}

/** Same as rpcOnce but backs off and retries on HTTP 429 (1 s, 2 s, 4 s ... up to 30 s), logging each wait. */
export async function rpcCall<T>(method: string, params: unknown[], opts: { retries?: number; url?: string } = {}): Promise<T> {
  const retries = opts.retries ?? 8;
  let wait = 1000;
  for (let attempt = 0; ; attempt++) {
    try {
      return await rpcOnce<T>(method, params, opts.url ?? RPC_URL);
    } catch (e) {
      const transient = e instanceof RateLimitError || (e as Error).message.startsWith("fetch failed") || /HTTP 5\d\d|timed out|aborted/.test((e as Error).message);
      if (!transient || attempt >= retries) throw e;
      console.log(`  ${e instanceof RateLimitError ? "429 rate limited" : "transient error"}; waiting ${wait / 1000}s (attempt ${attempt + 1}/${retries})`);
      if (e instanceof RateLimitError) rateLimit.pauseUntil = Math.max(rateLimit.pauseUntil, Date.now() + wait);
      await sleep(wait);
      wait = Math.min(wait * 2, 30_000);
    }
  }
}

/** Read one account over JSON-RPC. Returns raw bytes, owner and the slot of the read. */
export async function getAccount(
  address: string,
  url: string = RPC_URL,
): Promise<{ bytes: Uint8Array; owner: string; slot: number }> {
  const result = await rpcOnce<{ context: { slot: number }; value: { data: [string, string]; owner: string } | null }>(
    "getAccountInfo",
    [address, { encoding: "base64", commitment: "confirmed" }],
    url,
  );
  if (!result?.value) throw new Error(`account ${address} not found`);
  return {
    bytes: Uint8Array.from(Buffer.from(result.value.data[0], "base64")),
    owner: result.value.owner,
    slot: result.context.slot,
  };
}
