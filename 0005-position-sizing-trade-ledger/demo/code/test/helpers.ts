import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import type { Bet, ImpactQuote, Series } from "../src/types.ts";

/** Real account bytes captured from public mainnet RPC (see recorded/SOURCES.md). */
export function fixtureBytes(address: string): { bytes: Uint8Array; owner: string; slot: number; amountFromRpc?: string } {
  const j = JSON.parse(readFileSync(new URL(`./fixtures/${address}.rpc.json`, import.meta.url), "utf8"));
  return { bytes: Uint8Array.from(Buffer.from(j.result.value.data[0], "base64")), owner: j.result.value.owner, slot: j.result.context.slot };
}

export const recorded = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../recorded/${file}`, import.meta.url), "utf8")) as T;
/** Runs the demo once into a temporary folder (so the tests do not depend on a previous run) and reads its output. */
let outDir: string | null = null;
export function demoOutDir(): string {
  if (!outDir) {
    outDir = mkdtempSync(`${tmpdir()}/ledger-sizer-out-`) + "/";
    execFileSync(process.execPath, [new URL("../src/demo.ts", import.meta.url).pathname, "--recorded", "--out", outDir], { stdio: "pipe" });
  }
  return outDir;
}
export const outFile = <T>(file: string): T => JSON.parse(readFileSync(demoOutDir() + file, "utf8")) as T;

/** A flat price series with a constructed ramp, 5 s apart. */
export function seriesOf(prices: number[]): Series {
  return { pair: "SOL/USDC", intervalSec: 5, points: prices.map((p, i) => ({ t: 1000 + i * 5, jupiter: p, pyth: p, orca: p })) };
}

export const bet = (id: number, tOpen: number, tClose: number, m: number): Bet => ({ id, tOpen, tClose, side: m >= 0 ? 1 : -1, p: 0.7, m });

/** A tiny impact curve: 0 bps at 100 USD, 2 at 1,000, 10 at 10,000, 50 at 100,000. */
export const toyQuotes: ImpactQuote[] = [100, 1000, 10_000, 100_000].flatMap((sizeUsd, i) =>
  (["buy", "sell"] as const).map((side) => ({
    side, sizeUsd, inAmount: "0", outAmount: "0", execPrice: 100, impactBps: [0, 2, 10, 50][i]!, jupiterImpactPct: "0", routes: ["toy"],
  })),
);
