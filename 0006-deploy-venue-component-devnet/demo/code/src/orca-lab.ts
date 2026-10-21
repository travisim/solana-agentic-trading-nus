// Starter: Orca Whirlpool lab. Read the SOL/USDC concentrated-liquidity pool account and print its price, fee and tick.
// An AMM has no order book: one price, one liquidity number, and a fee. Compare that with the Phoenix ladder (npm run ladder).
//   npm run orca             recorded reference prices from recorded/phoenix.json (no network)
//   npm run orca -- --live   read the pool account now (public RPC, read only)
import fs from "node:fs";
import { readOrca, SOL_USDC_POOL } from "./orca.ts";

if (process.argv.includes("--live")) {
  const o = await readOrca();
  console.log(`Orca Whirlpool SOL/USDC ${SOL_USDC_POOL}\nLIVE, slot ${o.slot}\n  price ${o.price.toFixed(4)} USDC per SOL\n  fee ${o.feeRatePct}% per swap\n  tick spacing ${o.tickSpacing}, current tick index ${o.tickCurrentIndex}`);
} else {
  const rec = JSON.parse(fs.readFileSync("recorded/phoenix.json", "utf8")) as { capturedAt: string; reference: Array<{ t: number; slot: number; orcaPrice: number | null; pythPrice: number | null }> };
  const r = rec.reference.filter((x) => x.orcaPrice !== null);
  const last = r[r.length - 1]!;
  console.log(`Orca Whirlpool SOL/USDC ${SOL_USDC_POOL}\nrecorded ${rec.capturedAt}: ${r.length} reads, last at slot ${last.slot}\n  Orca price ${last.orcaPrice} USDC per SOL, Pyth oracle ${last.pythPrice}\n  gap ${(((last.orcaPrice! / last.pythPrice!) - 1) * 1e4).toFixed(1)} bps`);
}
