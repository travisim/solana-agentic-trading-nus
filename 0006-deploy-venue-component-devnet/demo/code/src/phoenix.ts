// Phoenix (v1, "Phoenix Legacy") market account decoder. No SDK, no dependencies.
//
// Layout verified against the official TypeScript SDK @ellipsis-labs/phoenix-sdk 2.0.3 (MIT) source
// (deserializeMarketData in src/utils/market.ts), then checked on live mainnet and devnet markets.
//   header 576 bytes | 256 bytes padding | 48 bytes (lots per unit, tick, sequence, fees) |
//   bids tree | asks tree | traders tree
//   tree = 16 byte header + 8 allocator size + bump u32 + free-list head u32 + nodes of
//          (16 bytes links + key 16 bytes + value 32 bytes) = 64 bytes per node
//   key = priceInTicks u64, sequence u64 (bids store the sequence bit-inverted)
//   value = traderIndex u64, numBaseLots u64, lastValidSlot u64, lastValidUnixTimestamp u64
import { base58 } from "./base58.ts";

export const PHOENIX_PROGRAM = "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY";
export const HEADER_LEN = 576;
const NODE_LEN = 64;

export interface Level {
  price: number;
  size: number; // base units
}
export interface Order {
  price: number;
  size: number;
  seq: bigint; // display sequence number: lower = earlier
  traderIndex: number;
  lastValidSlot: number; // 0 = never expires
  lastValidUnixTimestamp: number; // 0 = never expires
}
export interface PhoenixMarket {
  base: { mint: string; decimals: number };
  quote: { mint: string; decimals: number };
  baseLotSize: number;
  quoteLotSize: number;
  tickSizeQuoteAtomsPerBaseUnit: number;
  rawBaseUnitsPerBaseUnit: number;
  baseLotsPerBaseUnit: number;
  quoteLotsPerBaseUnitPerTick: number;
  takerFeeBps: number;
  numBidsCapacity: number;
  numAsksCapacity: number;
  bids: Order[]; // best first (highest price, earliest)
  asks: Order[]; // best first (lowest price, earliest)
}

function dv(b: Uint8Array): DataView {
  return new DataView(b.buffer, b.byteOffset, b.byteLength);
}

function readTree(buf: Uint8Array, capacity: number, isBid: boolean): Array<{ ticks: bigint; seq: bigint; trader: number; lots: bigint; slot: bigint; ts: bigint }> {
  const v = dv(buf);
  const bump = v.getInt32(24, true);
  const freeHead = v.getInt32(28, true);
  const nodes: Array<{ ticks: bigint; seq: bigint; trader: number; lots: bigint; slot: bigint; ts: bigint; next: number }> = [];
  for (let i = 0; 32 + (i + 1) * NODE_LEN <= buf.length && i < bump - 1 && i < capacity; i++) {
    const o = 32 + i * NODE_LEN;
    nodes.push({
      next: v.getInt32(o, true),
      ticks: v.getBigUint64(o + 16, true),
      seq: v.getBigUint64(o + 24, true),
      trader: Number(v.getBigUint64(o + 32, true)),
      lots: v.getBigUint64(o + 40, true),
      slot: v.getBigUint64(o + 48, true),
      ts: v.getBigUint64(o + 56, true),
    });
  }
  const free = new Set<number>();
  let head = freeHead;
  let guard = 0;
  while (head < bump) {
    const n = nodes[head - 1];
    if (!n) break;
    free.add(head - 1);
    head = n.next;
    if (++guard > bump + 2) throw new Error("corrupt free list");
  }
  void isBid;
  return nodes.filter((_, i) => !free.has(i));
}

export function decodePhoenixMarket(bytes: Uint8Array): PhoenixMarket {
  if (bytes.length < HEADER_LEN + 256 + 48) throw new Error(`Phoenix market account too short: ${bytes.length} bytes`);
  const v = dv(bytes);
  const bidsSize = Number(v.getBigUint64(16, true));
  const asksSize = Number(v.getBigUint64(24, true));
  const numSeats = Number(v.getBigUint64(32, true));
  const baseDecimals = v.getUint32(40, true);
  const baseMint = base58(bytes.slice(48, 80));
  const baseLotSize = Number(v.getBigUint64(112, true));
  const quoteDecimals = v.getUint32(120, true);
  const quoteMint = base58(bytes.slice(128, 160));
  const quoteLotSize = Number(v.getBigUint64(192, true));
  const tickSize = Number(v.getBigUint64(200, true));
  const rawBasePerBase = v.getUint32(312, true);
  let o = HEADER_LEN + 256;
  const baseLotsPerBaseUnit = Number(v.getBigUint64(o, true));
  const quoteLotsPerBaseUnitPerTick = Number(v.getBigUint64(o + 8, true));
  const takerFeeBps = Number(v.getBigUint64(o + 24, true));
  o += 48;
  const treeLen = (n: number) => 16 + 16 + (16 + 16 + 32) * n;
  const bidBuf = bytes.slice(o, o + treeLen(bidsSize));
  const askBuf = bytes.slice(o + treeLen(bidsSize), o + treeLen(bidsSize) + treeLen(asksSize));
  void numSeats;
  const toPrice = (ticks: bigint) => (Number(ticks) * quoteLotsPerBaseUnitPerTick * quoteLotSize) / (10 ** quoteDecimals * rawBasePerBase);
  const toSize = (lots: bigint) => (Number(lots) * baseLotSize) / 10 ** baseDecimals;
  const mask = (1n << 64n) - 1n;
  const uiSeq = (s: bigint) => {
    const signed = s >= 1n << 63n ? s - (1n << 64n) : s;
    return signed < 0n ? -signed - 1n : signed;
  };
  const mk = (n: ReturnType<typeof readTree>[number]): Order => ({
    price: toPrice(n.ticks),
    size: toSize(n.lots),
    seq: uiSeq(n.seq & mask),
    traderIndex: n.trader,
    lastValidSlot: Number(n.slot),
    lastValidUnixTimestamp: Number(n.ts),
  });
  const bids = readTree(bidBuf, bidsSize, true).map((n) => ({ n, o: mk(n) }));
  const asks = readTree(askBuf, asksSize, false).map((n) => ({ n, o: mk(n) }));
  bids.sort((a, b) => (a.n.ticks === b.n.ticks ? Number(a.o.seq - b.o.seq) : a.n.ticks > b.n.ticks ? -1 : 1));
  asks.sort((a, b) => (a.n.ticks === b.n.ticks ? Number(a.o.seq - b.o.seq) : a.n.ticks < b.n.ticks ? -1 : 1));
  return {
    base: { mint: baseMint, decimals: baseDecimals },
    quote: { mint: quoteMint, decimals: quoteDecimals },
    baseLotSize,
    quoteLotSize,
    tickSizeQuoteAtomsPerBaseUnit: tickSize,
    rawBaseUnitsPerBaseUnit: rawBasePerBase,
    baseLotsPerBaseUnit,
    quoteLotsPerBaseUnitPerTick,
    takerFeeBps,
    numBidsCapacity: bidsSize,
    numAsksCapacity: asksSize,
    bids: bids.map((x) => x.o),
    asks: asks.map((x) => x.o),
  };
}

/** Aggregate resting orders into price levels (best first), up to `levels` levels. */
export function toLadder(orders: Order[], levels = 10): Level[] {
  const out: Level[] = [];
  for (const o of orders) {
    const last = out[out.length - 1];
    if (last && last.price === o.price) last.size += o.size;
    else if (out.length < levels) out.push({ price: o.price, size: o.size });
    else break;
  }
  return out;
}

/** Drop orders that have expired (an expired order can still sit in the account until someone removes it). */
export function liveOrders(orders: Order[], slot: number, unixTime: number): Order[] {
  return orders.filter((o) => (o.lastValidSlot === 0 || o.lastValidSlot >= slot) && (o.lastValidUnixTimestamp === 0 || o.lastValidUnixTimestamp >= unixTime));
}
