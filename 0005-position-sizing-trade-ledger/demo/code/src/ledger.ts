// The trade ledger: append-only, hash-chained, replayable. Every order and every decision is a row,
// including the ones the risk hook rejected. Cash and position are never edited, only recomputed from fills.
import { createHash } from "node:crypto";
import { appendFileSync, writeFileSync } from "node:fs";
import type { LedgerRow } from "./types.ts";

export const GENESIS = "0".repeat(64);
export type RowInput = Omit<LedgerRow, "seq" | "prevHash" | "hash">;

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Hash of a row = sha256(prevHash + "\n" + the row's JSON without prevHash and hash). */
export function hashRow(prevHash: string, row: Omit<LedgerRow, "prevHash" | "hash">): string {
  return sha256(prevHash + "\n" + JSON.stringify(row));
}

export class Ledger {
  readonly #rows: LedgerRow[] = [];
  readonly #file: string | null;
  constructor(file: string | null = null) {
    this.#file = file;
    if (file) writeFileSync(file, ""); // a new run starts a new file; after that it is append only
  }
  /** The only way to change the ledger. There is no update and no delete. */
  append(input: RowInput): LedgerRow {
    const prevHash = this.#rows.at(-1)?.hash ?? GENESIS;
    const head = { seq: this.#rows.length + 1, ...input };
    const row: LedgerRow = { ...head, prevHash, hash: hashRow(prevHash, head) };
    this.#rows.push(row);
    if (this.#file) appendFileSync(this.#file, JSON.stringify(row) + "\n");
    return row;
  }
  get rows(): readonly LedgerRow[] {
    return this.#rows;
  }
  get headHash(): string {
    return this.#rows.at(-1)?.hash ?? GENESIS;
  }
}

export interface ReplayResult {
  ok: boolean;
  errors: string[];
  rows: number;
  fills: number;
  rejected: number;
  cashUsd: number;
  posSol: number;
  feesUsd: number;
  headHash: string;
}

const EPS = 1e-6;

/**
 * Replay a ledger from the starting balance. Checks: sequence numbers, the hash chain, and that every
 * row's cash and position equal what the fills add up to. If someone edits a row, a hash or a balance
 * stops matching and the first bad row is named.
 */
export function replay(rows: readonly LedgerRow[], startUsd: number): ReplayResult {
  const errors: string[] = [];
  let cash = startUsd, pos = 0, fees = 0, fills = 0, rejected = 0;
  let prev = GENESIS;
  rows.forEach((r, i) => {
    const bad = (msg: string) => errors.length < 10 && errors.push(`row ${r.seq}: ${msg}`);
    if (r.seq !== i + 1) bad(`sequence is ${r.seq}, expected ${i + 1}`);
    if (r.prevHash !== prev) bad("prevHash does not match the previous row's hash");
    const { prevHash: _p, hash: _h, ...body } = r;
    if (hashRow(r.prevHash, body) !== r.hash) bad("hash does not match the row's contents (row was changed)");
    if (r.fill) {
      const sign = r.order.side === "buy" ? 1 : -1;
      cash -= sign * r.fill.qtySol * r.fill.price + r.fill.feeUsd;
      pos += sign * r.fill.qtySol;
      fees += r.fill.feeUsd;
      fills++;
    } else rejected++;
    if (Math.abs(cash - r.cashUsd) > EPS) bad(`cash is ${r.cashUsd} but the fills add up to ${cash.toFixed(6)}`);
    if (Math.abs(pos - r.posSol) > 1e-9) bad(`position is ${r.posSol} SOL but the fills add up to ${pos.toFixed(9)}`);
    prev = r.hash;
  });
  return { ok: errors.length === 0, errors, rows: rows.length, fills, rejected, cashUsd: cash, posSol: pos, feesUsd: fees, headHash: prev };
}

/** Compare a replayed ledger with balances read from real token accounts (for example your devnet wallet). */
export function reconcileWith(result: ReplayResult, actual: { cashUsd: number; posSol: number }, tolUsd = 0.01) {
  const dCash = actual.cashUsd - result.cashUsd;
  const dPos = actual.posSol - result.posSol;
  return { ok: Math.abs(dCash) <= tolUsd && Math.abs(dPos) <= 1e-6, cashDiffUsd: dCash, posDiffSol: dPos };
}
