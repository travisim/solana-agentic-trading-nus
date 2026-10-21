// Minimal Solana client for DEVNET writes. No dependencies: Node's built-in crypto signs (ed25519), fetch sends.
// A keypair file is the standard Solana CLI format: a JSON array of 64 numbers (32-byte seed + 32-byte public key).
// Keypair files are read from disk and NEVER printed or logged. Writes are refused on any cluster that is not devnet or local.
import { createPrivateKey, createPublicKey, sign as edSign, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import { base58, base58Decode } from "./base58.ts";
import { DEVNET_RPC, rpcCall, sleep, wsUrlFor } from "./rpc.ts";

export const SYSTEM_PROGRAM = "11111111111111111111111111111111";
export const MEMO_PROGRAM = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo";
const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

export interface Keypair {
  publicKey: string;
  pub: Uint8Array;
  signBytes(msg: Uint8Array): Uint8Array;
  toJSON(): never;
}

export function keypairFromBytes(b: Uint8Array): Keypair {
  if (b.length !== 64) throw new Error("a keypair file must hold 64 bytes");
  const seed = b.slice(0, 32);
  const priv = createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, seed]), format: "der", type: "pkcs8" });
  const pub = new Uint8Array(createPublicKey(priv).export({ format: "der", type: "spki" }).subarray(-32));
  if (base58(pub) !== base58(b.slice(32))) throw new Error("keypair file is corrupt (public key does not match the seed)");
  return {
    publicKey: base58(pub),
    pub,
    signBytes: (msg) => new Uint8Array(edSign(null, Buffer.from(msg), priv)),
    toJSON() {
      throw new Error("refusing to serialize a keypair");
    },
  };
}

export function loadKeypair(path: string): Keypair {
  return keypairFromBytes(Uint8Array.from(JSON.parse(fs.readFileSync(path, "utf8")) as number[]));
}

/** Create a new keypair and write it to `path` with owner-only permissions. Returns the public key only. */
export function generateKeypairFile(path: string): Keypair {
  const { privateKey } = generateKeyPairSync("ed25519");
  const der = privateKey.export({ format: "der", type: "pkcs8" });
  const seed = new Uint8Array(der.subarray(-32));
  const pub = new Uint8Array(createPublicKey(privateKey).export({ format: "der", type: "spki" }).subarray(-32));
  fs.writeFileSync(path, JSON.stringify([...seed, ...pub]), { mode: 0o600 });
  return loadKeypair(path);
}

export interface Instruction {
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
  data: Uint8Array;
}

const shortvec = (n: number): number[] => {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const low = v & 0x7f;
    v >>= 7;
    if (v === 0) {
      out.push(low);
      return out;
    }
    out.push(low | 0x80);
  }
};

/** Compile a legacy message: fee payer first, then signers (writable first), then the rest (writable first). */
export function compileMessage(feePayer: string, ixs: Instruction[], blockhash: string): { message: Uint8Array; signers: string[] } {
  const meta = new Map<string, { signer: boolean; writable: boolean }>();
  const touch = (k: string, signer: boolean, writable: boolean) => {
    const m = meta.get(k) ?? { signer: false, writable: false };
    meta.set(k, { signer: m.signer || signer, writable: m.writable || writable });
  };
  touch(feePayer, true, true);
  for (const ix of ixs) {
    for (const a of ix.accounts) touch(a.pubkey, a.isSigner, a.isWritable);
    touch(ix.programId, false, false);
  }
  const keys = [...meta.keys()];
  const rank = (k: string) => {
    const m = meta.get(k)!;
    return k === feePayer ? 0 : m.signer && m.writable ? 1 : m.signer ? 2 : m.writable ? 3 : 4;
  };
  keys.sort((a, b) => rank(a) - rank(b));
  const signers = keys.filter((k) => meta.get(k)!.signer);
  const roSigners = keys.filter((k) => meta.get(k)!.signer && !meta.get(k)!.writable).length;
  const roUnsigned = keys.filter((k) => !meta.get(k)!.signer && !meta.get(k)!.writable).length;
  const bytes: number[] = [signers.length, roSigners, roUnsigned, ...shortvec(keys.length)];
  for (const k of keys) bytes.push(...base58Decode(k));
  bytes.push(...base58Decode(blockhash));
  bytes.push(...shortvec(ixs.length));
  for (const ix of ixs) {
    bytes.push(keys.indexOf(ix.programId), ...shortvec(ix.accounts.length), ...ix.accounts.map((a) => keys.indexOf(a.pubkey)), ...shortvec(ix.data.length), ...ix.data);
  }
  return { message: Uint8Array.from(bytes), signers };
}

export function buildTransaction(message: Uint8Array, signers: string[], keypairs: Keypair[]): { raw: Uint8Array; signature: string } {
  const sigs = signers.map((s) => {
    const kp = keypairs.find((k) => k.publicKey === s);
    if (!kp) throw new Error(`missing signer ${s}`);
    return kp.signBytes(message);
  });
  const raw = Uint8Array.from([...shortvec(sigs.length), ...sigs.flatMap((s) => [...s]), ...message]);
  return { raw, signature: base58(sigs[0]!) };
}

export const systemTransfer = (from: string, to: string, lamports: bigint): Instruction => {
  const d = new Uint8Array(12);
  const v = new DataView(d.buffer);
  v.setUint32(0, 2, true);
  v.setBigUint64(4, lamports, true);
  return { programId: SYSTEM_PROGRAM, accounts: [{ pubkey: from, isSigner: true, isWritable: true }, { pubkey: to, isSigner: false, isWritable: true }], data: d };
};
export const systemCreateAccount = (from: string, newAccount: string, lamports: bigint, space: bigint, owner: string): Instruction => {
  const d = new Uint8Array(52);
  const v = new DataView(d.buffer);
  v.setUint32(0, 0, true);
  v.setBigUint64(4, lamports, true);
  v.setBigUint64(12, space, true);
  d.set(base58Decode(owner), 20);
  return { programId: SYSTEM_PROGRAM, accounts: [{ pubkey: from, isSigner: true, isWritable: true }, { pubkey: newAccount, isSigner: true, isWritable: true }], data: d };
};
export const memoIx = (text: string, signer: string): Instruction => ({
  programId: MEMO_PROGRAM,
  accounts: [{ pubkey: signer, isSigner: true, isWritable: false }],
  data: new TextEncoder().encode(text),
});

/** Guard: this tool only writes to devnet or a local validator. */
export function assertWritable(url: string): void {
  const u = new URL(url);
  const ok = /(^|\.)devnet\./.test(u.host) || u.hostname === "127.0.0.1" || u.hostname === "localhost";
  if (!ok) throw new Error(`refusing to send a transaction to ${u.host}: writes are devnet only`);
}

export interface SendResult {
  signature: string;
  sentAtMs: number;
  processedAtMs?: number;
  confirmedAtMs?: number;
  finalizedAtMs?: number;
  slot?: number;
  err: unknown;
  /** resolves when the finalized notification arrives (or after 2 minutes, with finalizedAtMs left empty) */
  finalized: Promise<void>;
}

/**
 * Send, and watch the signature over the websocket (signatureSubscribe at processed, confirmed and finalized).
 * This is how long a transaction REALLY takes to reach each level, and it needs far fewer HTTP calls than polling.
 * Resolves when `until` ("processed" or "confirmed") is reached or the transaction failed.
 */
export async function sendAndTrack(
  ixs: Instruction[],
  payer: Keypair,
  extraSigners: Keypair[] = [],
  opts: { url?: string; until?: "processed" | "confirmed"; skipPreflight?: boolean; timeoutMs?: number } = {},
): Promise<SendResult> {
  const url = opts.url ?? DEVNET_RPC;
  assertWritable(url);
  const bh = await rpcCall<{ value: { blockhash: string; lastValidBlockHeight: number } }>("getLatestBlockhash", [{ commitment: "confirmed" }], { url });
  const { message, signers } = compileMessage(payer.publicKey, ixs, bh.value.blockhash);
  const { raw, signature } = buildTransaction(message, signers, [payer, ...extraSigners]);
  const levels = ["processed", "confirmed", "finalized"] as const;
  const r: SendResult = { signature, sentAtMs: 0, err: null, finalized: Promise.resolve() };
  const ws = new WebSocket(wsUrlFor(url));
  const subToLevel = new Map<number, (typeof levels)[number]>();
  let wake: () => void = () => {};
  let wakeFinal: () => void = () => {};
  r.finalized = new Promise<void>((res) => {
    wakeFinal = res;
    setTimeout(() => {
      res();
    }, 120_000).unref();
  });
  r.finalized = r.finalized.then(() => {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
  });
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () => reject(new Error("websocket failed to open")));
  });
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(String(ev.data)) as { id?: number; result?: number; method?: string; params?: { subscription: number; result: { context: { slot: number }; value: { err: unknown } } } };
    if (m.id && typeof m.result === "number") subToLevel.set(m.result, levels[m.id - 1]!);
    if (m.method === "signatureNotification" && m.params) {
      const lv = subToLevel.get(m.params.subscription);
      const now = Date.now();
      r.slot ??= m.params.result.context.slot;
      if (lv === "processed") r.processedAtMs ??= now;
      if (lv === "confirmed") {
        r.processedAtMs ??= now;
        r.confirmedAtMs ??= now;
      }
      if (lv === "finalized") {
        r.processedAtMs ??= now;
        r.confirmedAtMs ??= now;
        r.finalizedAtMs ??= now;
        wakeFinal();
      }
      if (m.params.result.value.err) r.err = m.params.result.value.err;
      wake();
    }
  });
  levels.forEach((lv, i) => ws.send(JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "signatureSubscribe", params: [signature, { commitment: lv }] })));
  await sleep(150); // let the subscriptions register before sending
  r.sentAtMs = Date.now();
  await rpcCall<string>("sendTransaction", [Buffer.from(raw).toString("base64"), { encoding: "base64", skipPreflight: opts.skipPreflight ?? false, preflightCommitment: "confirmed", maxRetries: 3 }], { url }); // same signed bytes, so a retry after a 429 cannot double-send
  const until = opts.until ?? "confirmed";
  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  while (Date.now() < deadline) {
    if ((until === "confirmed" && r.confirmedAtMs) || (until === "processed" && r.processedAtMs)) return r; // a failed transaction is also confirmed (and charged a fee)
    await new Promise<void>((res) => {
      wake = res;
      setTimeout(res, 500).unref();
    });
  }
  wakeFinal();
  throw new Error(`transaction ${signature} not ${until} within the timeout (sent is not confirmed)`);
}
