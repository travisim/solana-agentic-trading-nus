import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { base58 } from "../src/base58.ts";
import { base58Decode, buildMessage, MEMO_PROGRAM, memoLine, serializeTx } from "../src/memo.ts";
import type { Decision } from "../src/agent.ts";

const decision: Decision = {
  i: 40, t: 1792604891, side: 1, momBps: 4.1, z: 1.8, gapBps: 0.6, reason: "x", injected: "none", outcome: "win", label: 1, sideRetBps: 3.2,
};

test("base58 decode inverts base58 encode (including the Memo program id and leading zeros)", () => {
  assert.equal(base58(base58Decode(MEMO_PROGRAM)), MEMO_PROGRAM);
  assert.equal(base58Decode(MEMO_PROGRAM).length, 32);
  const b = Uint8Array.from([0, 0, 7, 255, 1]);
  assert.deepEqual(base58Decode(base58(b)), b);
});

test("memo line is short JSON with a recomputable hash", () => {
  const m = memoLine(decision);
  const j = JSON.parse(m);
  assert.equal(j.app, "labeler");
  assert.equal(j.side, "buy");
  assert.match(j.h, /^[0-9a-f]{16}$/);
  assert.equal(memoLine(decision), m);
  assert.ok(Buffer.byteLength(m) < 200);
});

test("the message has the Solana legacy layout: header, 2 accounts, blockhash, 1 Memo instruction", () => {
  const payer = new Uint8Array(32).fill(9);
  const bh = new Uint8Array(32).fill(3);
  const m = buildMessage(payer, "hello", bh);
  assert.deepEqual([...m.slice(0, 4)], [1, 0, 1, 2]);
  assert.deepEqual([...m.slice(4, 36)], [...payer]);
  assert.deepEqual([...m.slice(36, 68)], [...base58Decode(MEMO_PROGRAM)]);
  assert.deepEqual([...m.slice(68, 100)], [...bh]);
  assert.deepEqual([...m.slice(100, 105)], [1, 1, 1, 0, 5]); // 1 instruction, program index 1, 1 account (index 0), 5 data bytes
  assert.equal(Buffer.from(m.slice(105)).toString(), "hello");
});

test("a signature made with Node's ed25519 verifies and the transaction is signature + message", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = Uint8Array.from(Buffer.from(publicKey.export({ format: "jwk" }).x as string, "base64url"));
  const msg = buildMessage(pub, memoLine(decision), new Uint8Array(32).fill(1));
  const sig = sign(null, Buffer.from(msg), privateKey);
  assert.equal(verify(null, Buffer.from(msg), createPublicKey(publicKey.export({ format: "pem", type: "spki" })), sig), true);
  const tx = serializeTx(sig, msg);
  assert.equal(tx[0], 1);
  assert.equal(tx.length, 1 + 64 + msg.length);
  assert.ok(tx.length <= 1232, "fits in one packet");
});
