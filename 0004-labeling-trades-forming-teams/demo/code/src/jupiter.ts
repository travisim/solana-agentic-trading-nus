// Collector 1: VENUE price. Jupiter's public quote API (no key) routes across many pools.
// Asking "what do I get for 1 SOL?" gives an executable price, fees and routing included.
import type { VenueQuote } from "./types.ts";
import { getJson } from "./rpc.ts";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const JUPITER_URL =
  `https://lite-api.jup.ag/swap/v1/quote?inputMint=${SOL}&outputMint=${USDC}&amount=1000000000&slippageBps=50`;

/** USDC has 6 decimals, so outAmount / 1e6 is the USD received for 1 SOL. */
export function priceFromQuote(quote: { outAmount: string }): number {
  return Number(quote.outAmount) / 1e6;
}

export async function jupiterQuote(): Promise<VenueQuote> {
  const quote = (await getJson(JUPITER_URL)) as { outAmount?: string };
  if (!quote.outAmount) throw new Error("Jupiter quote had no outAmount");
  return {
    id: "jupiter",
    label: "Jupiter quote",
    price: priceFromQuote({ outAmount: quote.outAmount }),
    ts: Math.floor(Date.now() / 1000),
    source: "lite-api quote, 1 SOL -> USDC",
  };
}
