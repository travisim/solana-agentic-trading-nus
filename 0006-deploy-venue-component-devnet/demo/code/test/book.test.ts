import { test } from "node:test";
import assert from "node:assert/strict";
import { ASK, BID, BOOK_LEN, ProgramError, apply, cancel, decodeBook, init, isInitialized, ixCancel, ixInit, ixPlace, newBook, place } from "../src/book.ts";

const fresh = () => {
  const b = newBook();
  init(b);
  return b;
};

test("init writes the magic and refuses a second init", () => {
  const b = newBook();
  assert.equal(isInitialized(b), false);
  init(b);
  assert.equal(isInitialized(b), true);
  assert.equal(b.length, BOOK_LEN);
  assert.throws(() => init(b), (e: ProgramError) => e.code === 8);
});

test("fills happen at the resting price, best price first, then oldest first", () => {
  const b = fresh();
  place(b, ASK, 101, 5); // id 1
  place(b, ASK, 100, 3); // id 2 better price
  place(b, ASK, 100, 4); // id 3 same price, later
  const r = place(b, BID, 101, 8); // id 4
  assert.deepEqual(r.logs, ["ORDER id=4 BID px=101 qty=8", "FILL taker=4 maker=2 px=100 qty=3", "FILL taker=4 maker=3 px=100 qty=4", "FILL taker=4 maker=1 px=101 qty=1"]);
  const v = decodeBook(b);
  assert.equal(v.fills, 3);
  assert.equal(v.lastFillPrice, 101);
  assert.deepEqual(v.asks, [{ id: 1, side: "ask", price: 101, qty: 4 }]);
  assert.deepEqual(v.bids, []);
});

test("an order that does not cross rests; leftover after a partial fill rests at its own limit", () => {
  const b = fresh();
  place(b, ASK, 105, 2);
  const r = place(b, BID, 104, 3);
  assert.deepEqual(r.logs, ["ORDER id=2 BID px=104 qty=3", "REST id=2 qty=3"]);
  const r2 = place(b, BID, 106, 5);
  assert.deepEqual(r2.logs, ["ORDER id=3 BID px=106 qty=5", "FILL taker=3 maker=1 px=105 qty=2", "REST id=3 qty=3"]);
  const v = decodeBook(b);
  assert.deepEqual(v.bids.map((o) => [o.id, o.price, o.qty]), [[3, 106, 3], [2, 104, 3]]);
});

test("a market order is a limit order at an extreme price", () => {
  const b = fresh();
  place(b, ASK, 100, 1);
  place(b, ASK, 110, 1);
  const r = place(b, BID, 0xffffffff, 2);
  assert.equal(r.logs.filter((l) => l.startsWith("FILL")).length, 2);
});

test("rejected orders change nothing, even the next id", () => {
  const b = fresh();
  place(b, BID, 99, 1);
  const before = b.slice();
  assert.throws(() => place(b, 3, 10, 1), (e: ProgramError) => e.code === 4);
  assert.throws(() => place(b, BID, 10, 0), (e: ProgramError) => e.code === 5);
  assert.throws(() => place(b, BID, 0, 1), (e: ProgramError) => e.code === 5);
  assert.deepEqual(b, before);
});

test("a full book rejects a resting order and leaves the book unchanged", () => {
  const b = fresh();
  for (let k = 0; k < 16; k++) place(b, BID, 10 + k, 1);
  const before = b.slice();
  assert.throws(() => place(b, BID, 5, 1), (e: ProgramError) => e.code === 6);
  assert.deepEqual(b, before);
  // but an order that fully fills against the book needs no slot
  assert.doesNotThrow(() => place(b, ASK, 10, 1));
});

test("cancel removes one order; cancelling twice fails with OrderNotFound", () => {
  const b = fresh();
  place(b, BID, 99, 1);
  assert.deepEqual(cancel(b, 1), ["CANCEL id=1"]);
  assert.throws(() => cancel(b, 1), (e: ProgramError) => e.code === 7);
  assert.throws(() => cancel(newBook(), 1), (e: ProgramError) => e.code === 3);
});

test("instruction data is exactly what the program expects", () => {
  assert.deepEqual([...ixInit()], [0]);
  assert.deepEqual([...ixPlace(BID, 101, 7)], [1, 1, 101, 0, 0, 0, 7, 0, 0, 0]);
  assert.deepEqual([...ixCancel(258)], [2, 2, 1, 0, 0]);
  const b = newBook();
  apply(b, ixInit());
  assert.deepEqual(apply(b, ixPlace(ASK, 5, 2)), ["ORDER id=1 ASK px=5 qty=2", "REST id=1 qty=2"]);
  assert.throws(() => apply(b, Uint8Array.of(9)), (e: ProgramError) => e.code === 1);
});

test("the byte layout is stable: header, then 16 byte slots", () => {
  const b = fresh();
  place(b, ASK, 0x01020304, 0x0a0b0c0d);
  assert.deepEqual([...b.slice(0, 4)], [0x4d, 0x42, 0x4b, 0x31]); // MBK1
  assert.deepEqual([...b.slice(16, 32)], [1, 0, 0, 0, 2, 0, 0, 0, 0x04, 0x03, 0x02, 0x01, 0x0d, 0x0c, 0x0b, 0x0a]);
});
