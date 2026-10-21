// Deposit watcher: watch one address with logsSubscribe at three commitment levels and keep a ledger.
// Node 24 has WebSocket built in, so there are no dependencies.
//
// The rule it teaches: a deposit is a row with a lifecycle. "processed" = a validator ran it, "confirmed" = a supermajority
// voted on it, "finalized" = it can no longer be rolled back. We CREDIT at confirmed and only if the transaction did not fail.
// A failed transaction still shows up in logsSubscribe (it paid a fee), so the watcher must check `err`.
import { DEVNET_RPC, rpcOnce, sleep, wsUrlFor } from "./rpc.ts";

export { wsUrlFor };
export type Level = "processed" | "confirmed" | "finalized";
export interface DepositRow {
  signature: string;
  slot: number;
  ok: boolean;
  err: unknown;
  amountLamports: number | null; // balance change of the watched address, from the transaction's pre/post balances
  credited: boolean; // true once confirmed and not failed
  seenAtMs: Partial<Record<Level, number>>; // wall-clock time the watcher first heard about it at each level
}


export function createLedger() {
  const rows = new Map<string, DepositRow>();
  return {
    rows,
    /** apply one notification; returns the row */
    onLog(sig: string, slot: number, err: unknown, level: Level, nowMs: number): DepositRow {
      const row = rows.get(sig) ?? { signature: sig, slot, ok: !err, err, amountLamports: null, credited: false, seenAtMs: {} };
      row.seenAtMs[level] ??= nowMs;
      row.slot = slot;
      row.ok = !err;
      row.err = err;
      // THE RULE: credit at confirmed (or finalized), and only if the transaction did not fail.
      if ((level === "confirmed" || level === "finalized") && row.ok) row.credited = true;
      rows.set(sig, row);
      return row;
    },
  };
}

/** Balance change of `address` in a transaction (lamports), from getTransaction's pre/post balances. */
export async function depositAmount(sig: string, address: string, url: string): Promise<number | null> {
  for (let i = 0; i < 8; i++) {
    const t = await rpcOnce<null | { transaction: { message: { accountKeys: string[] } }; meta: { preBalances: number[]; postBalances: number[] } }>(
      "getTransaction",
      [sig, { encoding: "json", commitment: "confirmed", maxSupportedTransactionVersion: 0 }],
      url,
    );
    if (t) {
      const k = t.transaction.message.accountKeys.indexOf(address);
      return k < 0 ? null : t.meta.postBalances[k]! - t.meta.preBalances[k]!;
    }
    await sleep(500);
  }
  return null;
}

export function watch(address: string, opts: { url?: string; onRow?: (row: DepositRow, level: Level) => void; onState?: (s: string) => void } = {}) {
  const url = opts.url ?? DEVNET_RPC;
  const ledger = createLedger();
  const ws = new WebSocket(wsUrlFor(url));
  const levels: Level[] = ["processed", "confirmed", "finalized"];
  const subToLevel = new Map<number, Level>();
  const asked = new Set<string>();
  ws.addEventListener("open", () => {
    opts.onState?.("SUBSCRIBED");
    levels.forEach((lv, i) => ws.send(JSON.stringify({ jsonrpc: "2.0", id: i + 1, method: "logsSubscribe", params: [{ mentions: [address] }, { commitment: lv }] })));
  });
  ws.addEventListener("error", () => opts.onState?.("WEBSOCKET ERROR"));
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(String(ev.data)) as { id?: number; result?: number; method?: string; params?: { subscription: number; result: { context: { slot: number }; value: { signature: string; err: unknown } } } };
    if (msg.id && typeof msg.result === "number") subToLevel.set(msg.result, levels[msg.id - 1]!);
    if (msg.method === "logsNotification" && msg.params) {
      const lv = subToLevel.get(msg.params.subscription);
      if (!lv) return;
      const { signature, err } = msg.params.result.value;
      const row = ledger.onLog(signature, msg.params.result.context.slot, err, lv, Date.now());
      if (row.amountLamports === null && !asked.has(signature)) {
        asked.add(signature); // ask once, at the first level we hear about it
        void depositAmount(signature, address, url).then((a) => {
          row.amountLamports = a;
          opts.onRow?.(row, lv);
        });
      } else opts.onRow?.(row, lv);
    }
  });
  return { ledger, close: () => ws.close() };
}

if (process.argv[1]?.endsWith("watcher.ts")) {
  const i = process.argv.indexOf("--address");
  const address = i >= 0 ? process.argv[i + 1] : undefined;
  if (!address) {
    console.error("usage: node src/watcher.ts --address <devnet address> [--seconds 60]");
    process.exit(1);
  }
  const s = process.argv.indexOf("--seconds");
  const secs = s >= 0 ? Number(process.argv[s + 1]) : 60;
  const w = watch(address, {
    onState: (st) => console.log(st),
    onRow: (r, lv) => console.log(`${lv.padEnd(9)} ${r.signature.slice(0, 12)}... slot ${r.slot} ${r.ok ? "ok" : "FAILED " + JSON.stringify(r.err)} amount ${r.amountLamports ?? "?"} credited ${r.credited}`),
  });
  setTimeout(() => {
    w.close();
    console.log(`${w.ledger.rows.size} transactions seen`);
    process.exit(0);
  }, secs * 1000);
}
