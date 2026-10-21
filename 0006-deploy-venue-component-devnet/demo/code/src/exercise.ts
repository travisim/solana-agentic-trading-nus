// Run the scripted order sequence against a deployed mini_book program (DEVNET or a local validator) and write the evidence.
//   node src/exercise.ts --keypair <payer.json> --program <programId> [--url https://api.devnet.solana.com] [--out recorded/devnet-run.json]
// The payer key is read from disk and never printed. The book account's one-time key is created in memory and thrown away.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { ASK, BID, BOOK_LEN, apply, decodeBook, newBook, ProgramError, ixPlace } from "./book.ts";
import { DEVNET_RPC, rpcCall, sleep } from "./rpc.ts";
import { generateKeypairFile, loadKeypair, sendAndTrack, assertWritable, type SendResult } from "./tx.ts";
import { cancelIx, explorerTx, explorerAddr, initBookIxs, placeIx, rentFor } from "./venue.ts";
import { getAccount } from "./rpc.ts";
import os from "node:os";
import path from "node:path";

function arg(name: string, d?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : d;
  if (!v) throw new Error(`missing --${name}`);
  return v;
}

export interface Step {
  label: string;
  kind: "init" | "place" | "cancel";
  side?: "bid" | "ask";
  price?: number;
  qty?: number;
  cancelId?: number;
  expectError?: number;
}
/** The scripted session. Prices are in cents of a toy market (101 = 1.01). Step 7 is rejected on purpose. */
export const SCRIPT: Step[] = [
  { label: "init: create the book account and initialize it", kind: "init" },
  { label: "ask 5 @ 101 rests", kind: "place", side: "ask", price: 101, qty: 5 },
  { label: "ask 4 @ 102 rests", kind: "place", side: "ask", price: 102, qty: 4 },
  { label: "bid 6 @ 99 rests", kind: "place", side: "bid", price: 99, qty: 6 },
  { label: "bid 3 @ 98 rests", kind: "place", side: "bid", price: 98, qty: 3 },
  { label: "bid 7 @ 101 crosses: fills 5 @ 101, rests 2", kind: "place", side: "bid", price: 101, qty: 7 },
  { label: "ask 9 @ 99 crosses: price priority, then rests 1", kind: "place", side: "ask", price: 99, qty: 9 },
  { label: "bid with quantity 0 is rejected (fee still paid)", kind: "place", side: "bid", price: 100, qty: 0, expectError: 5 },
  { label: "cancel order 4", kind: "cancel", cancelId: 4 },
];

async function main() {
  const url = arg("url", DEVNET_RPC);
  assertWritable(url);
  const payer = loadKeypair(arg("keypair"));
  const programId = arg("program");
  const out = arg("out", "recorded/devnet-run.json");
  const cluster = url.includes("devnet") ? "devnet" : "local";
  const tmp = path.join(os.tmpdir(), `book-${process.pid}.json`);
  const bookKp = generateKeypairFile(tmp);
  fs.rmSync(tmp); // the one-time book key lives in memory only
  const prog = await rpcCall<{ value: { executable: boolean; owner: string } | null }>("getAccountInfo", [programId, { encoding: "base64", dataSlice: { offset: 0, length: 0 } }], { url });
  if (!prog.value?.executable) throw new Error(`program ${programId} is not deployed on ${url}`);
  const startBalance = (await rpcCall<{ value: number }>("getBalance", [payer.publicKey, { commitment: "confirmed" }], { url })).value;
  const rent = BigInt(await rentFor(BOOK_LEN, url));
  console.log(`cluster ${cluster}  payer ${payer.publicKey}  balance ${startBalance / 1e9} SOL  book ${bookKp.publicKey}`);

  const txs: Record<string, unknown>[] = [];
  const mirror = newBook();
  const tracked: SendResult[] = [];
  for (const [i, s] of SCRIPT.entries()) {
    const ixs =
      s.kind === "init"
        ? initBookIxs(payer.publicKey, bookKp.publicKey, programId, rent)
        : s.kind === "place"
          ? [placeIx(programId, bookKp.publicKey, s.side === "bid" ? BID : ASK, s.price!, s.qty!)]
          : [cancelIx(programId, bookKp.publicKey, s.cancelId!)];
    const r = await sendAndTrack(ixs, payer, s.kind === "init" ? [bookKp] : [], { url, skipPreflight: s.expectError !== undefined, until: "confirmed" });
    tracked.push(r);
    // the same step in the local TypeScript mirror (it must agree with the chain)
    let mirrorLogs: string[] = [];
    let mirrorError: number | null = null;
    try {
      mirrorLogs = s.kind === "init" ? apply(mirror, Uint8Array.of(0)) : s.kind === "place" ? apply(mirror, ixPlace(s.side === "bid" ? BID : ASK, s.price!, s.qty!)) : apply(mirror, Uint8Array.from([2, s.cancelId!, 0, 0, 0]));
    } catch (e) {
      mirrorError = e instanceof ProgramError ? e.code : -1;
    }
    const t = await rpcCall<null | { slot: number; blockTime: number | null; meta: { err: unknown; fee: number; logMessages: string[]; computeUnitsConsumed?: number } }>(
      "getTransaction",
      [r.signature, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
      { url },
    );
    txs.push({
      step: i + 1,
      label: s.label,
      kind: s.kind,
      signature: r.signature,
      slot: t?.slot ?? r.slot ?? null,
      blockTime: t?.blockTime ?? null,
      ok: !(t?.meta.err ?? r.err),
      err: t?.meta.err ?? r.err ?? null,
      fee: t?.meta.fee ?? null,
      computeUnits: t?.meta.computeUnitsConsumed ?? null,
      logs: t?.meta.logMessages ?? [],
      mirrorLogs,
      mirrorError,
      order: s.kind === "place" ? { side: s.side, price: s.price, qty: s.qty } : undefined,
      sentAtMs: r.sentAtMs,
      processedAfterMs: r.processedAtMs ? r.processedAtMs - r.sentAtMs : null,
      confirmedAfterMs: r.confirmedAtMs ? r.confirmedAtMs - r.sentAtMs : null,
      finalizedAfterMs: null as number | null,
      explorer: cluster === "devnet" ? explorerTx(r.signature) : null,
    });
    await sleep(600); // stay well under the public devnet rate limit
    console.log(`  step ${i + 1}: ${s.label} -> ${r.err ? "FAILED on chain " + JSON.stringify(r.err) : "ok"}  ${r.signature.slice(0, 16)}...  confirmed after ${r.confirmedAtMs! - r.sentAtMs} ms`);
  }
  // wait for the finalized notification of each signature (the third commitment level)
  await Promise.all(tracked.map((t) => t.finalized));
  const pending = new Set<string>();
  tracked.forEach((t, i) => {
    if (t.finalizedAtMs) (txs[i] as Record<string, unknown>)["finalizedAfterMs"] = t.finalizedAtMs - t.sentAtMs;
    else pending.add(t.signature);
  });
  const acct = await getAccount(bookKp.publicKey, url, "finalized");
  const view = decodeBook(acct.bytes);
  const mirrorEqual = Buffer.from(acct.bytes).equals(Buffer.from(mirror));
  const endBalance = (await rpcCall<{ value: number }>("getBalance", [payer.publicKey, { commitment: "confirmed" }], { url })).value;
  const result = {
    cluster,
    rpcHost: new URL(url).host,
    capturedAt: new Date().toISOString(),
    programId,
    bookAccount: bookKp.publicKey,
    payer: payer.publicKey,
    programExplorer: cluster === "devnet" ? explorerAddr(programId) : null,
    bookExplorer: cluster === "devnet" ? explorerAddr(bookKp.publicKey) : null,
    rentLamports: Number(rent),
    payerSpentLamports: startBalance - endBalance,
    txs,
    finalBook: { slot: acct.slot, base64: Buffer.from(acct.bytes).toString("base64"), sha256: createHash("sha256").update(acct.bytes).digest("hex"), view },
    mirrorEqual,
    unfinalized: [...pending],
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`wrote ${out}; TypeScript mirror equals the chain's book bytes: ${mirrorEqual}; unfinalized: ${pending.size}`);
}
main().catch((e) => {
  console.error(String((e as Error).message ?? e));
  process.exit(1);
});
