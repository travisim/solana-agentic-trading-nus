// Turns recorded data into the numbers the demos and slides show. Pure functions, no network.
import { BID, ASK, apply, decodeBook, newBook, ProgramError, ixPlace, ixCancel } from "./book.ts";
import { depthWithin, imbalance, microprice, ofiStep, rollSpread, tickRuleAccuracy, tradeImbalance, topOfBook, walkBook, type Level, type TopOfBook, type Trade } from "./microstructure.ts";

export const BANDS_BPS = [25, 50, 100, 200, 500, 1000];

export type RawLevel = [number, number];
export interface RawSnapshot {
  slot: number;
  t: number;
  bids: RawLevel[];
  asks: RawLevel[];
  orders: { bids: number; asks: number; expiredBids: number; expiredAsks: number };
}
const toLevels = (l: RawLevel[]): Level[] => l.map(([price, size]) => ({ price, size }));

export function snapshotFeatures(s: RawSnapshot, refPrice: number | null) {
  const bids = toLevels(s.bids);
  const asks = toLevels(s.asks);
  const top = topOfBook(bids, asks);
  const centre = top.mid ?? refPrice ?? top.bestBid ?? top.bestAsk; // a one-sided book is measured from its only best price
  const depth = BANDS_BPS.map((bps) => ({
    bps,
    bid: centre ? depthWithin(bids, "bid", centre, bps) : 0,
    ask: centre ? depthWithin(asks, "ask", centre, bps) : 0,
  }));
  const band500 = depth.find((d) => d.bps === 500)!;
  const sizes = [1, 10, 100];
  return {
    top,
    microprice: microprice(top),
    depth,
    imbalance500: imbalance(band500.bid, band500.ask),
    midVsRefBps: top.mid && refPrice ? (top.mid / refPrice - 1) * 1e4 : null,
    buy: sizes.map((q) => ({ qty: q, ...walkBook(asks, q, "buy"), vsRefBps: null as number | null })).map((w) => ({ ...w, vsRefBps: w.vwap && refPrice ? (w.vwap / refPrice - 1) * 1e4 : null })),
    sell: sizes.map((q) => ({ qty: q, ...walkBook(bids, q, "sell") })).map((w) => ({ ...w, vsRefBps: w.vwap && refPrice ? (1 - w.vwap / refPrice) * 1e4 : null })),
  };
}

export interface PhoenixRecorded {
  capturedAt: string;
  intervalSec: number;
  failures: string[];
  reference: Array<{ t: number; slot: number; orcaPrice: number | null; pythPrice: number | null }>;
  markets: Array<{ name: string; cluster: string; address: string; snapshots: RawSnapshot[] }>;
}

export function buildLadder(rec: PhoenixRecorded) {
  const markets = rec.markets.map((m) => {
    const isSolUsdc = m.name === "SOL/USDC";
    const snaps = m.snapshots.map((s, i) => {
      const ref = isSolUsdc ? (rec.reference[i]?.orcaPrice ?? null) : null;
      const f = snapshotFeatures(s, ref);
      return { slot: s.slot, t: s.t, refPrice: ref, features: f, orders: s.orders, bids: s.bids, asks: s.asks };
    });
    const tops: TopOfBook[] = m.snapshots.map((s) => topOfBook(toLevels(s.bids), toLevels(s.asks)));
    const ofi: Array<number | null> = tops.map((t, i) => (i === 0 ? null : ofiStep(tops[i - 1]!, t)));
    const changes = m.snapshots.filter((s, i) => i > 0 && JSON.stringify([s.bids.slice(0, 5), s.asks.slice(0, 5)]) !== JSON.stringify([m.snapshots[i - 1]!.bids.slice(0, 5), m.snapshots[i - 1]!.asks.slice(0, 5)])).length;
    return {
      name: m.name,
      cluster: m.cluster,
      address: m.address,
      snapshotCount: m.snapshots.length,
      topChanges: changes, // snapshots where the top 5 levels differed from the previous one
      ofi,
      snapshots: snaps,
    };
  });
  return { capturedAt: rec.capturedAt, mode: "recorded", intervalSec: rec.intervalSec, failures: rec.failures, reference: rec.reference, markets };
}

// ---------------------------------------------------------------------------------------------------------------------
export interface SwapRec {
  t: number;
  slot: number;
  side: "buy" | "sell";
  solAmount: number;
  usdcAmount: number;
  price: number;
  sig: string;
}
const pearson = (x: number[], y: number[]) => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
    syy += (y[i]! - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
};

/**
 * The recorded file lists swaps oldest first by slot, but INSIDE one slot they come newest first (the RPC returns a slot's
 * transactions in the opposite order to how we reversed the list). Put each slot's swaps back in execution order.
 * Evidence: with the file's order the tick rule is right on 39% of swaps (worse than a coin); with execution order, on 96%.
 */
export function chronological<T extends { slot: number }>(swaps: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < swaps.length; ) {
    let j = i;
    while (j < swaps.length && swaps[j]!.slot === swaps[i]!.slot) j++;
    out.push(...swaps.slice(i, j).reverse());
    i = j;
  }
  return out;
}

/** Drop dust swaps (under 0.01 SOL: rounding noise in the price) and price outliers (more than 1% from the median: multi-leg transactions). */
export function cleanSwaps(swaps: SwapRec[]) {
  const sorted = swaps.map((s) => s.price).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const dust = swaps.filter((s) => s.solAmount < 0.01).length;
  const outliers = swaps.filter((s) => s.solAmount >= 0.01 && Math.abs(s.price / median - 1) > 0.01).length;
  const kept = swaps.filter((s) => s.solAmount >= 0.01 && Math.abs(s.price / median - 1) <= 0.01);
  return { kept, dust, outliers, median };
}

export function buildFlow(allSwaps: SwapRec[], windowSec = 60) {
  const cleaned = cleanSwaps(allSwaps);
  const swaps = chronological(cleaned.kept);
  const trades: Trade[] = swaps.map((s) => ({ t: s.t, price: s.price, size: s.solAmount, side: s.side }));
  const acc = tickRuleAccuracy(trades);
  // Same measure with the swaps in the order the recorded file lists them (reversed inside each slot): the evidence for chronological().
  const accFile = tickRuleAccuracy(cleaned.kept.map((s) => ({ t: s.t, price: s.price, size: s.solAmount, side: s.side })));
  const t0 = swaps[0]!.t;
  const buckets = new Map<number, SwapRec[]>();
  for (const s of swaps) {
    const k = Math.floor((s.t - t0) / windowSec);
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(s);
  }
  const windows = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, ss]) => {
      const ti = tradeImbalance(ss.map((s) => ({ t: s.t, price: s.price, size: s.usdcAmount, side: s.side })));
      return {
        tStart: t0 + k * windowSec,
        trades: ss.length,
        buyUsd: ti.buy,
        sellUsd: ti.sell,
        imbalance: ti.imbalance,
        open: ss[0]!.price,
        close: ss[ss.length - 1]!.price,
        retBps: (ss[ss.length - 1]!.price / ss[0]!.price - 1) * 1e4,
      };
    });
  const imb = windows.map((w) => w.imbalance ?? 0);
  const ret = windows.map((w) => w.retBps);
  const closeToClose = windows.map((w, i) => (i === 0 ? 0 : (w.close / windows[i - 1]!.close - 1) * 1e4));
  const roll = rollSpread(swaps.map((s) => s.price));
  const mid = swaps.reduce((a, s) => a + s.price, 0) / swaps.length;
  return {
    windowSec,
    recordedSwaps: allSwaps.length,
    droppedDust: cleaned.dust,
    droppedOutliers: cleaned.outliers,
    medianPrice: cleaned.median,
    swaps: swaps.length,
    from: t0,
    to: swaps[swaps.length - 1]!.t,
    buyShare: swaps.filter((s) => s.side === "buy").length / swaps.length,
    tickRule: { agree: acc.agree, total: acc.total, share: acc.share },
    tickRuleFileOrder: { agree: accFile.agree, total: accFile.total, share: accFile.share },
    rollSpread: roll,
    rollSpreadBps: roll !== null ? (roll / mid) * 1e4 : null,
    corrSameWindow: pearson(imb, ret),
    corrNextWindow: pearson(imb.slice(0, -1), closeToClose.slice(1)),
    windows,
    swapsCompact: swaps.map((s) => [s.t, s.price, s.usdcAmount, s.side === "buy" ? 1 : 0, s.slot]), // [time, price, usdc, 1 = buy, slot], cleaned, in execution order
  };
}

// ---------------------------------------------------------------------------------------------------------------------
export interface RunTx {
  step: number;
  label: string;
  kind: "init" | "place" | "cancel";
  signature: string;
  slot: number | null;
  blockTime: number | null;
  ok: boolean;
  err: unknown;
  fee: number | null;
  computeUnits: number | null;
  logs: string[];
  order?: { side: "bid" | "ask"; price: number; qty: number };
  processedAfterMs: number | null;
  confirmedAfterMs: number | null;
  finalizedAfterMs: number | null;
  explorer: string | null;
}
export interface DevnetRun {
  cluster: string;
  rpcHost: string;
  capturedAt: string;
  programId: string;
  bookAccount: string;
  payer: string;
  programExplorer: string | null;
  bookExplorer: string | null;
  rentLamports: number;
  payerSpentLamports: number;
  txs: RunTx[];
  finalBook: { slot: number; base64: string; sha256: string };
  mirrorEqual: boolean;
}
const programLogs = (logs: string[]) => logs.filter((l) => l.startsWith("Program log: ")).map((l) => l.slice("Program log: ".length));

/** Replay the recorded orders in the TypeScript engine and compare every step with what the chain logged. */
export function buildMatching(run: DevnetRun) {
  const b = newBook();
  const steps = run.txs.map((tx) => {
    let mine: string[] = [];
    let mineErr: number | null = null;
    try {
      if (tx.kind === "init") apply(b, Uint8Array.of(0));
      else if (tx.kind === "place") mine = apply(b, ixPlace(tx.order!.side === "bid" ? BID : ASK, tx.order!.price, tx.order!.qty));
      else mine = apply(b, ixCancel(Number(/order (\d+)/.exec(tx.label)![1])));
    } catch (e) {
      mineErr = e instanceof ProgramError ? e.code : -1;
    }
    const chain = programLogs(tx.logs);
    const view = decodeBook(b);
    const chainErr = tx.ok ? null : ((tx.err as { InstructionError?: [number, { Custom?: number }] })?.InstructionError?.[1]?.Custom ?? -1);
    return {
      step: tx.step,
      label: tx.label,
      kind: tx.kind,
      order: tx.order ?? null,
      signature: tx.signature,
      explorer: tx.explorer,
      chainOk: tx.ok,
      chainErrorCode: chainErr,
      chainLogs: chain,
      engineLogs: mine,
      engineErrorCode: mineErr,
      match: JSON.stringify(chain) === JSON.stringify(mine) && chainErr === mineErr,
      bookAfter: { bids: view.bids, asks: view.asks, fills: view.fills, lastFillPrice: view.lastFillPrice, nextId: view.nextId },
    };
  });
  const finalBytes = Uint8Array.from(Buffer.from(run.finalBook.base64, "base64"));
  return { source: { cluster: run.cluster, programId: run.programId, bookAccount: run.bookAccount, capturedAt: run.capturedAt }, steps, allMatch: steps.every((s) => s.match), finalBookEqualsChain: Buffer.from(newBookAfter(run)).equals(Buffer.from(finalBytes)) };
}
function newBookAfter(run: DevnetRun): Uint8Array {
  const b = newBook();
  for (const tx of run.txs) {
    try {
      if (tx.kind === "init") apply(b, Uint8Array.of(0));
      else if (tx.kind === "place") apply(b, ixPlace(tx.order!.side === "bid" ? BID : ASK, tx.order!.price, tx.order!.qty));
      else apply(b, ixCancel(Number(/order (\d+)/.exec(tx.label)![1])));
    } catch {
      /* a rejected order leaves the book unchanged, as on chain */
    }
  }
  return b;
}

const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
export interface DeployRecord {
  programId: string;
  programDataAddress: string;
  deploySignature: string;
  deploySlot: number;
  deployBlockTime: number;
  elfBytes: number;
  elfSha256: string;
  upgradeAuthority: string;
  explorer: { program: string; deployTx: string };
}
export function buildDevnet(run: DevnetRun, deposits: DepositRun | null, deploy: DeployRecord | null = null, local: DevnetRun | null = null) {
  const nums = (k: "processedAfterMs" | "confirmedAfterMs" | "finalizedAfterMs") => run.txs.map((t) => t[k]).filter((x): x is number => typeof x === "number");
  const failed = run.txs.filter((t) => !t.ok);
  return {
    cluster: run.cluster,
    rpcHost: run.rpcHost,
    capturedAt: run.capturedAt,
    programId: run.programId,
    bookAccount: run.bookAccount,
    payer: run.payer,
    programExplorer: run.programExplorer,
    bookExplorer: run.bookExplorer,
    txCount: run.txs.length,
    failedCount: failed.length,
    totalFeeLamports: run.txs.reduce((a, t) => a + (t.fee ?? 0), 0),
    rentLamports: run.rentLamports,
    medianMs: { processed: median(nums("processedAfterMs")), confirmed: median(nums("confirmedAfterMs")), finalized: median(nums("finalizedAfterMs")) },
    computeUnits: { min: Math.min(...run.txs.filter((t) => t.ok && t.computeUnits).map((t) => t.computeUnits!)), max: Math.max(...run.txs.map((t) => t.computeUnits ?? 0)) },
    txs: run.txs.map((t) => ({ step: t.step, label: t.label, kind: t.kind, signature: t.signature, slot: t.slot, blockTime: t.blockTime, ok: t.ok, err: t.err, fee: t.fee, computeUnits: t.computeUnits, processedAfterMs: t.processedAfterMs, confirmedAfterMs: t.confirmedAfterMs, finalizedAfterMs: t.finalizedAfterMs, explorer: t.explorer, logs: programLogs(t.logs) })),
    finalBook: { ...run.finalBook, view: decodeBook(Uint8Array.from(Buffer.from(run.finalBook.base64, "base64"))) },
    mirrorEqual: run.mirrorEqual,
    deploy,
    local: local ? { cluster: local.cluster, medianMs: { processed: median(local.txs.map((t) => t.processedAfterMs).filter((x): x is number => typeof x === "number")), confirmed: median(local.txs.map((t) => t.confirmedAfterMs).filter((x): x is number => typeof x === "number")), finalized: median(local.txs.map((t) => t.finalizedAfterMs).filter((x): x is number => typeof x === "number")) } } : null,
    deposits: deposits ? { cluster: deposits.cluster, capturedAt: deposits.capturedAt, sender: deposits.sender, vault: deposits.vault, vaultExplorer: deposits.vaultExplorer, rule: deposits.rule, rows: deposits.rows } : null,
  };
}

export interface DepositRun {
  cluster: string;
  rpcHost: string;
  capturedAt: string;
  sender: string;
  vault: string;
  vaultExplorer: string | null;
  rule: string;
  rows: Array<{ label: string; signature: string; explorer: string | null; sentLamports: number | null; attemptedLamports: number; slot: number | null; ok: boolean | null; err: unknown; amountLamports: number | null; credited: boolean; processedAfterMs: number | null; confirmedAfterMs: number | null; finalizedAfterMs: number | null }>;
}
