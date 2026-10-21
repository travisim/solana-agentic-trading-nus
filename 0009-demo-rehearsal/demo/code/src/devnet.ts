// Devnet evidence: write ONE Memo transaction to Solana DEVNET with a throwaway key, then read it back.
// Why: a Demo Day claim like "my agent wrote this decision on-chain" needs a real signature a judge can open.
//   - Devnet only. The key is generated here with Node's built-in crypto and kept in .devnet-key.json (gitignored).
//   - No real funds: devnet SOL comes from the faucet (requestAirdrop) and has no value.
//   - No dependencies: the transaction is serialized by hand (legacy format, one signer, one Memo instruction).
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { decodeBase58, encodeBase58 } from "./base58.ts";
import { rpcCall, sleep } from "./rpc.ts";

export const DEVNET_RPC = process.env["SOLANA_DEVNET_RPC_URL"] ?? "https://api.devnet.solana.com";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
const KEY_FILE = new URL("../.devnet-key.json", import.meta.url).pathname;

const compact = (n: number): number[] => {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>= 7;
    if (v === 0) { out.push(b); return out; }
    out.push(b | 0x80);
  }
};

export interface Throwaway { address: string; seed: Uint8Array }

/** Load (or create, once) the throwaway devnet key. Never commit it; it is in .gitignore. */
export function loadThrowaway(): Throwaway {
  if (existsSync(KEY_FILE)) {
    const j = JSON.parse(readFileSync(KEY_FILE, "utf8")) as { address: string; seedHex: string };
    return { address: j.address, seed: Uint8Array.from(Buffer.from(j.seedHex, "hex")) };
  }
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" }) as { d: string; x: string };
  const seed = Uint8Array.from(Buffer.from(jwk.d, "base64url"));
  const address = encodeBase58(Uint8Array.from(Buffer.from(jwk.x, "base64url")));
  writeFileSync(KEY_FILE, JSON.stringify({ address, seedHex: Buffer.from(seed).toString("hex"), note: "DEVNET throwaway key. Never reuse on mainnet." }) + "\n", { mode: 0o600 });
  return { address, seed };
}

/** Build and sign a legacy transaction with one Memo instruction. Returns the wire bytes. */
export function buildMemoTx(key: Throwaway, memo: string, recentBlockhash: string): Uint8Array {
  const payer = decodeBase58(key.address);
  const program = decodeBase58(MEMO_PROGRAM);
  const data = Buffer.from(memo, "utf8");
  if (data.length > 500) throw new Error("memo too long (keep it under 500 bytes)");
  const message = Uint8Array.from([
    1, 0, 1, // header: 1 signature, 0 read-only signed, 1 read-only unsigned (the Memo program)
    ...compact(2), ...payer, ...program,
    ...decodeBase58(recentBlockhash),
    ...compact(1), 1, ...compact(1), 0, ...compact(data.length), ...data, // instruction: program #1, accounts [payer], data
  ]);
  const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(key.seed)]);
  const signature = sign(null, message, createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" }));
  void createPublicKey;
  return Uint8Array.from([...compact(1), ...signature, ...message]);
}

export async function writeMemo(memo: string): Promise<{ address: string; signature: string; slot: number }> {
  const key = loadThrowaway();
  const url = DEVNET_RPC;
  const bal = await rpcCall<{ value: number }>("getBalance", [key.address], { url, retries: 2 });
  if (bal.value < 10_000) {
    console.log(`  asking the devnet faucet for 0.5 devnet SOL for ${key.address} (devnet only, no value)`);
    await rpcCall("requestAirdrop", [key.address, 500_000_000], { url, retries: 1 });
    for (let i = 0; i < 20; i++) {
      await sleep(1500);
      const b = await rpcCall<{ value: number }>("getBalance", [key.address, { commitment: "confirmed" }], { url, retries: 1 });
      if (b.value > 0) break;
    }
  }
  const bh = await rpcCall<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }], { url, retries: 2 });
  const tx = buildMemoTx(key, memo, bh.value.blockhash);
  const signature = await rpcCall<string>("sendTransaction", [Buffer.from(tx).toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }], { url, retries: 1 });
  for (let i = 0; i < 30; i++) {
    await sleep(1500);
    const st = await rpcCall<{ value: ({ confirmationStatus: string; err: unknown; slot: number } | null)[] }>("getSignatureStatuses", [[signature]], { url, retries: 1 });
    const s = st.value[0];
    if (s?.err) throw new Error(`transaction failed on devnet: ${JSON.stringify(s.err)}`);
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return { address: key.address, signature, slot: s.slot };
  }
  throw new Error("transaction was sent but not confirmed in 45 s; check the explorer");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const memo = process.argv[2] ?? "NUS build night 5 devnet evidence";
  const r = await writeMemo(memo);
  console.log(JSON.stringify(r, null, 1));
  console.log(`https://explorer.solana.com/tx/${r.signature}?cluster=devnet`);
}
