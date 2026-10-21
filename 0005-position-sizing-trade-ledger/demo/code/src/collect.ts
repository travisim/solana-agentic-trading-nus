// Recorder: captures REAL data into recorded/ (presenter task; students use the bundled copies).
//   node src/collect.ts impact     -> recorded/jupiter-impact.json  (Jupiter quotes for 9 sizes x 2 sides)
//   node src/collect.ts balances   -> recorded/token-balances.json  (Orca SOL/USDC vault token accounts)
import { writeFileSync } from "node:fs";
import { getJson, sleep } from "./rpc.ts";
import { readTokenAccount } from "./tokens.ts";
import { buildImpactQuotes, type RawQuote } from "./impact.ts";
import type { BalancesFile, ImpactFile, ImpactPair } from "./types.ts";

const root = new URL("../", import.meta.url).pathname;
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SIZES = [100, 1000, 10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];
const RPC = process.env["SOLANA_RPC_URL"] ?? "https://solana-rpc.publicnode.com";
const TOKENS = [
  { id: "SOL/USDC", mint: SOL, decimals: 9, note: "the pair this session trades; the deepest market on Solana" },
  { id: "ORCA/USDC", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", decimals: 6, note: "a thinner token, captured to show what the cap does when a pool is shallower" },
];

type Quote = { inAmount: string; outAmount: string; priceImpactPct: string; routePlan: { swapInfo: { label: string } }[] };

async function quote(inMint: string, outMint: string, amount: number): Promise<Quote> {
  const url = `https://lite-api.jup.ag/swap/v1/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${amount}&slippageBps=50`;
  for (let attempt = 0; ; attempt++) {
    try {
      return (await getJson(url)) as Quote;
    } catch (e) {
      if (attempt >= 5) throw e;
      console.log(`  ${(e as Error).message.slice(0, 60)}; waiting ${3 * (attempt + 1)} s`);
      await sleep(3000 * (attempt + 1));
    }
  }
}

async function collectImpact() {
  const pairs: ImpactPair[] = [];
  for (const tk of TOKENS) {
    console.log(`\n${tk.id}`);
    // Token amount per USD comes from a 100 USD buy quote, so sells are sized in tokens.
    const probe = await quote(USDC, tk.mint, 100 * 1e6);
    const tokensPerUsd = Number(probe.outAmount) / 100;
    const raw: RawQuote[] = [];
    for (const side of ["buy", "sell"] as const) {
      for (const sizeUsd of SIZES) {
        await sleep(1500); // Jupiter's free API throttles quickly; stay slow
        const q = side === "buy" ? await quote(USDC, tk.mint, sizeUsd * 1e6) : await quote(tk.mint, USDC, Math.round(tokensPerUsd * sizeUsd));
        raw.push({ side, sizeUsd, q });
        console.log(`  ${side.padEnd(4)} ${String(sizeUsd).padStart(8)} USD  impact ${q.priceImpactPct}`);
      }
    }
    pairs.push({ id: tk.id, note: tk.note, quotes: buildImpactQuotes(raw, tk.decimals) });
  }
  const file: ImpactFile = { capturedAt: new Date().toISOString(), source: "Jupiter lite-api /swap/v1/quote, slippageBps=50, token<->USDC", pairs };
  writeFileSync(`${root}recorded/jupiter-impact.json`, JSON.stringify(file, null, 1) + "\n");
  console.log("wrote recorded/jupiter-impact.json");
}

async function collectBalances() {
  const targets = [
    ["Orca SOL/USDC pool: SOL vault", "EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9"],
    ["Orca SOL/USDC pool: USDC vault", "2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP"],
  ] as const;
  const balances = [];
  for (const [label, address] of targets) balances.push(await readTokenAccount(address, label, RPC));
  const file: BalancesFile = {
    capturedAt: new Date().toISOString(),
    source: `getAccountInfo on ${new URL(RPC).host}, SPL token account layout (amount at bytes 64..72)`,
    balances,
  };
  writeFileSync(`${root}recorded/token-balances.json`, JSON.stringify(file, null, 1) + "\n");
  for (const b of balances) console.log(`  ${b.label}: ${b.amount.toLocaleString("en-US")} (slot ${b.slot})`);
  console.log("wrote recorded/token-balances.json");
}

const what = process.argv[2];
if (what === "impact") await collectImpact();
else if (what === "balances") await collectBalances();
else console.log("usage: node src/collect.ts impact | balances");
