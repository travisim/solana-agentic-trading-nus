// Presenter tool: record what transactions cost on Solana mainnet right now (read only, public RPC, no keys).
//   node src/collectCosts.ts            -> recorded/solana-costs.json
// Students do not need this: the repo ships the capture. It answers one question for the scorecard:
// how big are Solana's own costs (base fee, priority fee) and failure rate, next to venue fees and slippage?
import { writeFileSync, readFileSync } from "node:fs";
import { RPC_URL, getJson } from "./rpc.ts";

const VOTE = "Vote111111111111111111111111111111111111111";
const BASE_FEE_PER_SIGNATURE = 5000; // lamports, fixed by the protocol
const recordedDir = new URL("../recorded/", import.meta.url).pathname;

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const j = (await getJson(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message}`);
  return j.result as T;
}

const q = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0;
};

type Block = {
  blockTime: number | null;
  transactions: { meta: { err: unknown; fee: number } | null; transaction: { signatures: string[]; accountKeys: ({ pubkey: string } | string)[] } }[];
};
const slot = await rpc<number>("getSlot", [{ commitment: "finalized" }]);
const BLOCKS = 5; // five blocks, about 40 slots (16 s) apart, so one odd block does not decide the numbers
const slots = Array.from({ length: BLOCKS }, (_, i) => slot - 40 * (i + 1));
const perBlock: { slot: number; userTransactions: number; failedRate: number }[] = [];
const user: Block["transactions"] = [];
let blockTransactions = 0;
let blockTime: number | null = null;
for (const target of slots) {
  const block = await rpc<Block>("getBlock", [target, { transactionDetails: "accounts", rewards: false, maxSupportedTransactionVersion: 1, commitment: "finalized" }]);
  blockTime ??= block.blockTime;
  blockTransactions += block.transactions.length;
  const u = block.transactions.filter((t) => t.meta && !t.transaction.accountKeys.some((k) => (typeof k === "string" ? k : k.pubkey) === VOTE));
  perBlock.push({ slot: target, userTransactions: u.length, failedRate: Math.round((u.filter((t) => t.meta!.err !== null).length / u.length) * 1e4) / 1e4 });
  user.push(...u);
}
const failed = user.filter((t) => t.meta!.err !== null).length;
const prio = user.map((t) => Math.max(0, t.meta!.fee - BASE_FEE_PER_SIGNATURE * t.transaction.signatures.length));
const fees = user.map((t) => t.meta!.fee);

const recent = await rpc<{ slot: number; prioritizationFee: number }[]>("getRecentPrioritizationFees", []);
const nz = recent.map((x) => x.prioritizationFee).filter((x) => x > 0);

const snap = JSON.parse(readFileSync(`${recordedDir}snapshot.json`, "utf8")) as { venues: { id: string; price: number }[] };
const solUsd = snap.venues.find((v) => v.id === "pyth")!.price;
const usd = (lamports: number) => (lamports / 1e9) * solUsd;

const out = {
  capturedAt: new Date().toISOString(),
  source: `${new URL(RPC_URL).host} getBlock x${BLOCKS} (slots ${slots[BLOCKS - 1]}..${slots[0]}, transactionDetails=accounts) and getRecentPrioritizationFees`,
  slots,
  perBlock,
  blockTime,
  blockTransactions,
  userTransactions: user.length,
  failedUserTransactions: failed,
  failedRate: Math.round((failed / user.length) * 1e4) / 1e4,
  baseFeeLamportsPerSignature: BASE_FEE_PER_SIGNATURE,
  feeLamports: { median: q(fees, 0.5), p90: q(fees, 0.9), max: Math.max(...fees) },
  priorityFeeLamports: { median: q(prio, 0.5), p90: q(prio, 0.9), max: Math.max(...prio), shareWithPriorityFee: Math.round((prio.filter((x) => x > 0).length / user.length) * 1e4) / 1e4 },
  recentPrioritization: { note: "getRecentPrioritizationFees with no addresses: the lowest fee that landed in each slot; 0 means the slot had spare room", slots: recent.length, slotsWithNonZeroFee: nz.length, medianNonZeroMicroLamportsPerCu: q(nz, 0.5), maxMicroLamportsPerCu: Math.max(0, ...nz) },
  solUsdFromRecordedPyth: solUsd,
  medianFeeUsd: Math.round(usd(q(fees, 0.5)) * 1e6) / 1e6,
  p90FeeUsd: Math.round(usd(q(fees, 0.9)) * 1e6) / 1e6,
  medianFeeBpsOf1000UsdTrade: Math.round((usd(q(fees, 0.5)) / 1000) * 1e4 * 1e4) / 1e4,
  p90FeeBpsOf1000UsdTrade: Math.round((usd(q(fees, 0.9)) / 1000) * 1e4 * 1e4) / 1e4,
  notCaptured: ["Jito tips (they are ordinary transfers to tip accounts; not decoded here)"],
};
writeFileSync(`${recordedDir}solana-costs.json`, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
