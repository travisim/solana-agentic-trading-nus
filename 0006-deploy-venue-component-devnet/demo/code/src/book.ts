// A TypeScript mirror of the on-chain program (program/src/lib.rs). It works on the SAME 272-byte layout,
// so a book read from the chain and a book built here can be compared byte for byte.
//
//   header 16 bytes: magic "MBK1" | next order id u32 | fills u32 | last fill price u32
//   16 slots of 16 bytes: id u32 | side u8 (0 empty, 1 bid, 2 ask) | pad 3 | price u32 | qty u32
export const BOOK_LEN = 272;
export const SLOTS = 16;
export const HEADER = 16;
export const SLOT_LEN = 16;
export const BID = 1;
export const ASK = 2;

export const ERRORS: Record<number, string> = {
  1: "InvalidInstruction",
  2: "BadAccount (not writable or not owned by the program)",
  3: "NotInitialized",
  4: "InvalidSide",
  5: "ZeroPriceOrQty",
  6: "BookFull",
  7: "OrderNotFound",
  8: "AlreadyInitialized",
};

export class ProgramError extends Error {
  code: number;
  constructor(code: number) {
    super(`custom program error ${code} (${ERRORS[code] ?? "unknown"})`);
    this.code = code;
  }
}

export interface RestingOrder {
  id: number;
  side: "bid" | "ask";
  price: number;
  qty: number;
}
export interface BookView {
  nextId: number;
  fills: number;
  lastFillPrice: number;
  orders: RestingOrder[]; // slot order
  bids: RestingOrder[]; // best first
  asks: RestingOrder[]; // best first
}

const u32 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(o, true);
const w32 = (b: Uint8Array, o: number, v: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).setUint32(o, v >>> 0, true);

export function newBook(): Uint8Array {
  return new Uint8Array(BOOK_LEN);
}
export function isInitialized(b: Uint8Array): boolean {
  return b.length >= BOOK_LEN && b[0] === 0x4d && b[1] === 0x42 && b[2] === 0x4b && b[3] === 0x31;
}
export function init(b: Uint8Array): void {
  if (b.length < BOOK_LEN) throw new ProgramError(2);
  if (isInitialized(b)) throw new ProgramError(8);
  b.set([0x4d, 0x42, 0x4b, 0x31], 0);
  w32(b, 4, 1);
}

export function decodeBook(b: Uint8Array): BookView {
  if (!isInitialized(b)) throw new Error("not a mini_book account (magic MBK1 missing)");
  const orders: RestingOrder[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const o = HEADER + i * SLOT_LEN;
    const side = b[o + 4];
    if (side === BID || side === ASK) orders.push({ id: u32(b, o), side: side === BID ? "bid" : "ask", price: u32(b, o + 8), qty: u32(b, o + 12) });
  }
  const bids = orders.filter((x) => x.side === "bid").sort((a, c) => c.price - a.price || a.id - c.id);
  const asks = orders.filter((x) => x.side === "ask").sort((a, c) => a.price - c.price || a.id - c.id);
  return { nextId: u32(b, 4), fills: u32(b, 8), lastFillPrice: u32(b, 12), orders, bids, asks };
}

/** Place a limit order. Mutates `b`. Returns the log lines the program writes. Throws ProgramError (book unchanged). */
export function place(b: Uint8Array, side: number, price: number, qty: number): { id: number; logs: string[] } {
  const work = b.slice(); // the chain discards writes when a transaction fails; so do we
  const logs: string[] = [];
  if (!isInitialized(work)) throw new ProgramError(3);
  if (side !== BID && side !== ASK) throw new ProgramError(4);
  if (!Number.isInteger(price) || !Number.isInteger(qty) || price < 0 || qty <= 0 || price > 0xffffffff || qty > 0xffffffff || (side === BID && price === 0)) throw new ProgramError(5);
  const id = u32(work, 4);
  w32(work, 4, id + 1);
  logs.push(`ORDER id=${id} ${side === BID ? "BID" : "ASK"} px=${price} qty=${qty}`);
  const opp = side === BID ? ASK : BID;
  let left = qty;
  while (left > 0) {
    let best = -1;
    for (let i = 0; i < SLOTS; i++) {
      const o = HEADER + i * SLOT_LEN;
      if (work[o + 4] !== opp) continue;
      const p = u32(work, o + 8);
      if (side === BID ? p > price : p < price) continue;
      if (best < 0) {
        best = i;
        continue;
      }
      const bo = HEADER + best * SLOT_LEN;
      const bp = u32(work, bo + 8);
      const better = side === BID ? p < bp : p > bp;
      if (better || (p === bp && u32(work, o) < u32(work, bo))) best = i;
    }
    if (best < 0) break;
    const mo = HEADER + best * SLOT_LEN;
    const mq = u32(work, mo + 12);
    const mp = u32(work, mo + 8);
    const mid = u32(work, mo);
    const fill = Math.min(left, mq);
    logs.push(`FILL taker=${id} maker=${mid} px=${mp} qty=${fill}`);
    left -= fill;
    if (fill === mq) work.fill(0, mo, mo + SLOT_LEN);
    else w32(work, mo + 12, mq - fill);
    w32(work, 8, u32(work, 8) + 1);
    w32(work, 12, mp);
  }
  if (left > 0) {
    let free = -1;
    for (let i = 0; i < SLOTS; i++) {
      if (work[HEADER + i * SLOT_LEN + 4] === 0) {
        free = i;
        break;
      }
    }
    if (free < 0) throw new ProgramError(6);
    const o = HEADER + free * SLOT_LEN;
    w32(work, o, id);
    work[o + 4] = side;
    w32(work, o + 8, price);
    w32(work, o + 12, left);
    logs.push(`REST id=${id} qty=${left}`);
  }
  b.set(work);
  return { id, logs };
}

export function cancel(b: Uint8Array, id: number): string[] {
  if (!isInitialized(b)) throw new ProgramError(3);
  for (let i = 0; i < SLOTS; i++) {
    const o = HEADER + i * SLOT_LEN;
    if (b[o + 4] !== 0 && u32(b, o) === id) {
      b.fill(0, o, o + SLOT_LEN);
      return [`CANCEL id=${id}`];
    }
  }
  throw new ProgramError(7);
}

/** Instruction data builders (what goes on the wire). */
export const ixInit = () => Uint8Array.of(0);
export function ixPlace(side: number, price: number, qty: number): Uint8Array {
  const d = new Uint8Array(10);
  d[0] = 1;
  d[1] = side;
  w32(d, 2, price);
  w32(d, 6, qty);
  return d;
}
export function ixCancel(id: number): Uint8Array {
  const d = new Uint8Array(5);
  d[0] = 2;
  w32(d, 1, id);
  return d;
}

/** Apply one instruction (as the program does). Returns the log lines. */
export function apply(b: Uint8Array, data: Uint8Array): string[] {
  if (data[0] === 0 && data.length === 1) {
    init(b);
    return [];
  }
  if (data[0] === 1 && data.length === 10) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    return place(b, data[1] as number, dv.getUint32(2, true), dv.getUint32(6, true)).logs;
  }
  if (data[0] === 2 && data.length === 5) return cancel(b, new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(1, true));
  throw new ProgramError(1);
}
