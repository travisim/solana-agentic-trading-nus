// Reading and checking a ledger file. Your own ledger must look like out/ledger.json:
//   { "capitalUsd": 10000, "windowStartT": ..., "windowEndT": ..., "intervalSec": 5, "trades": [ { ...see LedgerTrade in types.ts } ] }
import type { Ledger, LedgerTrade } from "./types.ts";

const REQUIRED_NUM = ["openT", "closeT", "entry", "exit", "notionalUsd", "grossUsd", "legs"] as const;

export function validateLedger(x: unknown): Ledger {
  if (typeof x !== "object" || x === null) throw new Error("ledger must be a JSON object");
  const l = x as Record<string, unknown>;
  for (const k of ["capitalUsd", "windowStartT", "windowEndT", "intervalSec"]) {
    if (typeof l[k] !== "number" || !Number.isFinite(l[k] as number)) throw new Error(`ledger.${k} must be a number`);
  }
  if ((l["capitalUsd"] as number) <= 0) throw new Error("ledger.capitalUsd must be above 0");
  if ((l["intervalSec"] as number) <= 0) throw new Error("ledger.intervalSec must be above 0");
  if ((l["windowEndT"] as number) <= (l["windowStartT"] as number)) throw new Error("ledger.windowEndT must be after windowStartT");
  if (typeof l["note"] !== "string") l["note"] = "Your ledger.";
  if (l["pair"] === undefined) l["pair"] = "SOL/USDC";
  if (!Array.isArray(l["trades"])) throw new Error("ledger.trades must be an array");
  (l["trades"] as unknown[]).forEach((t, i) => {
    const r = t as Record<string, unknown>;
    if (typeof t !== "object" || t === null) throw new Error(`trades[${i}] must be an object`);
    if (typeof r["strategy"] !== "string") throw new Error(`trades[${i}].strategy must be a string`);
    if (r["side"] !== "long" && r["side"] !== "short") throw new Error(`trades[${i}].side must be "long" or "short"`);
    for (const k of REQUIRED_NUM) if (typeof r[k] !== "number" || !Number.isFinite(r[k] as number)) throw new Error(`trades[${i}].${k} must be a number`);
    if ((r["closeT"] as number) < (r["openT"] as number)) throw new Error(`trades[${i}] closes before it opens`);
    if (typeof r["paysSlippage"] !== "boolean") r["paysSlippage"] = true;
    if (typeof r["id"] !== "number") r["id"] = i + 1;
  });
  return l as unknown as Ledger;
}

export function byStrategy(trades: LedgerTrade[]): Record<string, LedgerTrade[]> {
  const out: Record<string, LedgerTrade[]> = {};
  for (const t of trades) (out[t.strategy] ??= []).push(t);
  return out;
}
