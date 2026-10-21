// Presenter script: send real DEVNET deposits to a vault address while the watcher listens, and record what the watcher saw.
//   node src/deposit-run.ts --keypair <funded devnet payer.json> [--url https://api.devnet.solana.com] [--out recorded/deposit-run.json]
// Sends: two small deposits, then one that fails on chain (more lamports than the sender holds). The failed one must NOT be credited.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEVNET_RPC, rpcOnce, sleep } from "./rpc.ts";
import { generateKeypairFile, loadKeypair, sendAndTrack, systemTransfer, assertWritable } from "./tx.ts";
import { explorerTx, explorerAddr } from "./venue.ts";
import { watch, type DepositRow } from "./watcher.ts";

function arg(name: string, d?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : d;
  if (!v) throw new Error(`missing --${name}`);
  return v;
}

const url = arg("url", DEVNET_RPC);
assertWritable(url);
const payer = loadKeypair(arg("keypair"));
const out = arg("out", "recorded/deposit-run.json");
const tmp = path.join(os.tmpdir(), `vault-${process.pid}.json`);
const vault = generateKeypairFile(tmp);
fs.rmSync(tmp); // the vault only ever RECEIVES in this demo; its key is discarded
const cluster = url.includes("devnet") ? "devnet" : "local";
const bal = (await rpcOnce<{ value: number }>("getBalance", [payer.publicKey, { commitment: "confirmed" }], url)).value;
console.log(`sender ${payer.publicKey} (${bal / 1e9} SOL)  vault ${vault.publicKey}`);

const w = watch(vault.publicKey, { url, onState: (s) => console.log("watcher:", s), onRow: (r: DepositRow, lv) => console.log(`  watcher saw ${r.signature.slice(0, 10)}... ${lv}${r.ok ? "" : " (FAILED)"}`) });
await sleep(2500);
const sent: Array<{ label: string; signature: string; sentAtMs: number; lamports: number; expectFail: boolean; slot?: number }> = [];
const plan = [
  { label: "deposit 1", lamports: 1_000_000, expectFail: false },
  { label: "deposit 2", lamports: 1_500_000, expectFail: false },
  { label: "failing deposit (more than the sender holds)", lamports: bal + 1_000_000_000, expectFail: true },
];
for (const p of plan) {
  const r = await sendAndTrack([systemTransfer(payer.publicKey, vault.publicKey, BigInt(p.lamports))], payer, [], { url, until: "confirmed", skipPreflight: p.expectFail });
  sent.push({ label: p.label, signature: r.signature, sentAtMs: r.sentAtMs, lamports: p.lamports, expectFail: p.expectFail, slot: r.slot });
  console.log(`sent ${p.label}: ${r.signature.slice(0, 12)}... ${r.err ? "failed on chain " + JSON.stringify(r.err) : "confirmed"}`);
  await sleep(1500);
}
// wait for finalized notifications
const deadline = Date.now() + 90_000;
while (Date.now() < deadline && sent.some((s) => !w.ledger.rows.get(s.signature)?.seenAtMs.finalized)) await sleep(1000);
w.close();
const rows = sent.map((s) => {
  const r = w.ledger.rows.get(s.signature);
  const rel = (t?: number) => (t ? t - s.sentAtMs : null);
  return {
    label: s.label,
    signature: s.signature,
    explorer: cluster === "devnet" ? explorerTx(s.signature) : null,
    sentLamports: s.expectFail ? null : s.lamports,
    attemptedLamports: s.lamports,
    slot: r?.slot ?? s.slot ?? null,
    ok: r?.ok ?? null,
    err: r?.err ?? null,
    amountLamports: r?.amountLamports ?? null,
    credited: r?.credited ?? false,
    processedAfterMs: rel(r?.seenAtMs.processed),
    confirmedAfterMs: rel(r?.seenAtMs.confirmed),
    finalizedAfterMs: rel(r?.seenAtMs.finalized),
  };
});
const result = {
  cluster,
  rpcHost: new URL(url).host,
  capturedAt: new Date().toISOString(),
  sender: payer.publicKey,
  vault: vault.publicKey,
  vaultExplorer: cluster === "devnet" ? explorerAddr(vault.publicKey) : null,
  rule: "credit at confirmed, only if the transaction did not fail; mark final at finalized",
  rows,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`wrote ${out}`);
console.log(rows.map((r) => `${r.label}: credited=${r.credited} amount=${r.amountLamports} processed ${r.processedAfterMs} ms, confirmed ${r.confirmedAfterMs} ms, finalized ${r.finalizedAfterMs} ms`).join("\n"));
process.exit(0);
