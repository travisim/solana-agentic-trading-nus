// Devnet Memo logger: write one short line per agent decision into a devnet transaction using the Memo program,
// so a label can be checked against an on-chain record instead of a local file. DEVNET ONLY. No real funds.
//
// No libraries: the transaction is built by hand (legacy message, one signer, one Memo instruction) and signed with Node's
// built-in ed25519. Three things you can do:
//   node src/memo.ts --build        print the first 3 memo lines and the size of the transaction they would make (no network)
//   node src/memo.ts --simulate     ask devnet to dry-run those transactions (simulateTransaction, signatures not checked)
//                                   using --payer <a devnet address that holds some SOL>; nothing is sent or signed
//   node src/memo.ts --send         sign and send them with a throwaway key kept in code/.keys/ (git-ignored).
//                                   The key needs a few thousand lamports of devnet SOL. The public devnet faucet rate-limits hard
//                                   (often HTTP 429); if the airdrop is refused the script prints the address to fund by hand.
// Memo line format (kept short): {"app":"labeler","i":<step>,"t":<unix>,"side":"buy|sell","label":1|-1|0,"h":"<16 hex>"}
// where h = first 16 hex characters of sha256 of the decision's JSON record (out/agent.json), so anyone can recompute it.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { base58 } from "./base58.ts";
import { rpcOnce, sleep } from "./rpc.ts";
import type { Decision } from "./agent.ts";

export const DEVNET_URL = "https://api.devnet.solana.com";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"; // Memo program v2

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`not base58: ${ch}`);
    n = n * 58n + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const ch of s) { if (ch === "1") bytes.unshift(0); else break; }
  return Uint8Array.from(bytes);
}

/** Memo text for one decision. */
export function memoLine(d: Decision): string {
  const h = createHash("sha256").update(JSON.stringify(d)).digest("hex").slice(0, 16);
  return JSON.stringify({ app: "labeler", i: d.i, t: d.t, side: d.side === 1 ? "buy" : "sell", label: d.label, h });
}

function compactU16(n: number): number[] {
  const out: number[] = [];
  let v = n;
  for (;;) {
    const b = v & 0x7f;
    v >>= 7;
    if (v === 0) { out.push(b); return out; }
    out.push(b | 0x80);
  }
}

/** The message a signer signs: header, 2 accounts (payer, Memo program), blockhash, one Memo instruction. */
export function buildMessage(payer: Uint8Array, memo: string, blockhash: Uint8Array): Uint8Array {
  if (payer.length !== 32 || blockhash.length !== 32) throw new Error("payer and blockhash must be 32 bytes");
  const data = Buffer.from(memo, "utf8");
  if (data.length > 566) throw new Error("memo too long for one transaction");
  return Uint8Array.from([
    1, 0, 1, // 1 required signature, 0 read-only signed accounts, 1 read-only unsigned account (the Memo program)
    ...compactU16(2), ...payer, ...base58Decode(MEMO_PROGRAM),
    ...blockhash,
    ...compactU16(1), // one instruction
    1, // program id index (Memo program)
    ...compactU16(1), 0, // one account: the payer as signer, which is what the Memo program checks
    ...compactU16(data.length), ...data,
  ]);
}

export function serializeTx(signature: Uint8Array, message: Uint8Array): Uint8Array {
  if (signature.length !== 64) throw new Error("signature must be 64 bytes");
  return Uint8Array.from([...compactU16(1), ...signature, ...message]);
}

// ---- throwaway key (git-ignored folder, never committed, never printed) --------------------------------
const KEY_FILE = new URL("../.keys/devnet-throwaway.json", import.meta.url).pathname;

function loadOrCreateKey(): { pub: Uint8Array; priv: ReturnType<typeof createPrivateKey>; created: boolean } {
  let created = false;
  if (!existsSync(KEY_FILE)) {
    const { privateKey } = generateKeyPairSync("ed25519");
    mkdirSync(new URL("../.keys/", import.meta.url).pathname, { recursive: true });
    writeFileSync(KEY_FILE, JSON.stringify(privateKey.export({ format: "jwk" })), { mode: 0o600 });
    created = true;
  }
  const jwk = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  const priv = createPrivateKey({ key: jwk, format: "jwk" });
  const pub = Uint8Array.from(Buffer.from(createPublicKey(priv).export({ format: "jwk" }).x as string, "base64url"));
  return { pub, priv, created };
}

async function latestBlockhash(): Promise<Uint8Array> {
  const r = await rpcOnce<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }], DEVNET_URL);
  return base58Decode(r.value.blockhash);
}

// ---- CLI ---------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const flag = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const has = (n: string) => process.argv.includes(`--${n}`);
  const agentFile = JSON.parse(readFileSync(new URL("../out/agent.json", import.meta.url), "utf8")) as { decisions: Decision[] };
  const trades = agentFile.decisions.filter((d) => d.side !== 0).slice(0, Number(flag("count") ?? 3));
  if (trades.length === 0) throw new Error("no trades in out/agent.json; run npm run demo first");
  const dummyHash = new Uint8Array(32);

  if (has("build") || (!has("simulate") && !has("send"))) {
    for (const d of trades) {
      const memo = memoLine(d);
      const msg = buildMessage(new Uint8Array(32), memo, dummyHash);
      console.log(`${memo}\n  message ${msg.length} bytes; with the signature the transaction is ${msg.length + 65} bytes (limit 1,232)`);
    }
    console.log("\nNothing was sent. Use --simulate (dry run on devnet) or --send (needs a funded throwaway key).");
  }

  if (has("simulate")) {
    const payer = flag("payer");
    if (!payer) throw new Error("--simulate needs --payer <devnet address with some SOL>; only the public address is used, nothing is signed or sent");
    const rows: unknown[] = [];
    for (const d of trades) {
      const memo = memoLine(d);
      const msg = buildMessage(base58Decode(payer), memo, await latestBlockhash());
      const tx = Buffer.from(serializeTx(new Uint8Array(64), msg)).toString("base64"); // all-zero signature: sigVerify is off
      const r = await rpcOnce<{ value: { err: unknown; logs: string[] | null; unitsConsumed?: number } }>(
        "simulateTransaction", [tx, { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" }], DEVNET_URL);
      console.log(`${memo}\n  err: ${JSON.stringify(r.value.err)}  units: ${r.value.unitsConsumed}\n  ${(r.value.logs ?? []).join("\n  ")}`);
      rows.push({ memo, err: r.value.err, logs: r.value.logs, unitsConsumed: r.value.unitsConsumed });
      await sleep(500);
    }
    if (has("write")) {
      writeFileSync(new URL("../recorded/devnet-simulation.json", import.meta.url), JSON.stringify({ cluster: "devnet", mode: "simulateTransaction (not sent)", capturedAt: new Date().toISOString(), payer, results: rows }, null, 1) + "\n");
      console.log("wrote recorded/devnet-simulation.json");
    }
  }

  if (has("send")) {
    const key = loadOrCreateKey();
    const addr = base58(key.pub);
    console.log(`throwaway devnet key: ${addr}${key.created ? " (new, saved in code/.keys/, git-ignored)" : ""}`);
    let bal = (await rpcOnce<{ value: number }>("getBalance", [addr], DEVNET_URL)).value;
    if (bal < 20_000) {
      try {
        await rpcOnce("requestAirdrop", [addr, 100_000_000], DEVNET_URL);
        await sleep(4000);
        bal = (await rpcOnce<{ value: number }>("getBalance", [addr], DEVNET_URL)).value;
      } catch (e) {
        console.log(`airdrop refused: ${(e as Error).message}`);
      }
    }
    if (bal < 20_000) {
      console.log(`Balance ${bal} lamports is too low. Send a little DEVNET SOL to ${addr} (for example from a lead's pre-funded wallet), then run --send again.`);
      process.exit(2);
    }
    const out: unknown[] = [];
    for (const d of trades) {
      const memo = memoLine(d);
      const msg = buildMessage(key.pub, memo, await latestBlockhash());
      const sig = sign(null, Buffer.from(msg), key.priv);
      const signature = await rpcOnce<string>("sendTransaction", [Buffer.from(serializeTx(sig, msg)).toString("base64"), { encoding: "base64" }], DEVNET_URL);
      console.log(`sent ${signature}\n  https://explorer.solana.com/tx/${signature}?cluster=devnet`);
      out.push({ memo, signature });
      await sleep(1500);
    }
    if (has("write")) writeFileSync(new URL("../recorded/devnet-memos.json", import.meta.url), JSON.stringify({ cluster: "devnet", payer: addr, capturedAt: new Date().toISOString(), memos: out }, null, 1) + "\n");
  }
}
