// Recorder for the one thing this session captures itself: DEVNET reads and a devnet signature check.
//   node src/collect.ts devnet     -> recorded/devnet-reads.json
// (The swaps and Pyth reads in recorded/ were captured for build night 2; see recorded/SOURCES.md.)
// Reads only, plus one simulateTransaction call, which asks the devnet node to check a signed transaction WITHOUT sending it.
import { writeFileSync } from "node:fs";
import { buildMemoTx, DEVNET_RPC, loadThrowaway, MEMO_PROGRAM } from "./devnet.ts";
import { rpcCall } from "./rpc.ts";

const what = process.argv[2];
if (what !== "devnet") {
  console.log("usage: node src/collect.ts devnet");
  process.exit(1);
}
const url = DEVNET_RPC;
const call = <T>(m: string, p: unknown[] = []) => rpcCall<T>(m, p, { url, retries: 3 });
const version = await call<{ "solana-core": string }>("getVersion");
const slot = await call<number>("getSlot", [{ commitment: "confirmed" }]);
const genesisHash = await call<string>("getGenesisHash");
const memo = await call<{ value: { executable: boolean; owner: string } | null }>("getAccountInfo", [MEMO_PROGRAM, { encoding: "base64" }]);
const key = loadThrowaway(); // throwaway DEVNET key, gitignored; only its public address is recorded
const bh = await call<{ value: { blockhash: string } }>("getLatestBlockhash", [{ commitment: "confirmed" }]);
const tx = buildMemoTx(key, "NUS build night 5 signature check", bh.value.blockhash);
const sim = async (bytes: Uint8Array) =>
  (await call<{ value: { err: unknown } }>("simulateTransaction", [Buffer.from(bytes).toString("base64"), { encoding: "base64", sigVerify: true, commitment: "confirmed" }])).value.err;
const okErr = await sim(tx);
const bad = Uint8Array.from(tx);
bad[5] = bad[5]! ^ 1; // flip one bit of the signature
const badErr = await sim(bad);
const out = {
  cluster: "devnet",
  rpc: url,
  capturedAt: new Date().toISOString(),
  version: version["solana-core"],
  slot,
  genesisHash,
  memoProgram: { address: MEMO_PROGRAM, exists: !!memo.value, executable: memo.value?.executable ?? false },
  throwawayAddress: key.address,
  signatureCheck: {
    note: "simulateTransaction with sigVerify. The faucet refused an airdrop (HTTP 429, daily limit), so the account has no funds and nothing was sent.",
    validSignature: okErr, // expected "AccountNotFound": the signature passed, the account is just empty
    flippedBit: badErr, // expected "SignatureFailure"
  },
  faucet: { requested: "0.5 devnet SOL then 0.1 devnet SOL", result: "HTTP 429: airdrop limit reached", sent: false },
};
writeFileSync(new URL("../recorded/devnet-reads.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out, null, 1));
