import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { decodeBase58, encodeBase58 } from "../src/base58.ts";
import { MEMO_PROGRAM, buildMemoTx } from "../src/devnet.ts";

function throwaway() {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" }) as { d: string; x: string };
  const pub = Uint8Array.from(Buffer.from(jwk.x, "base64url"));
  return { key: { address: encodeBase58(pub), seed: Uint8Array.from(Buffer.from(jwk.d, "base64url")) }, pub };
}
const blockhash = encodeBase58(Uint8Array.from({ length: 32 }, (_, i) => i + 1));

test("base58 round trip, including leading zero bytes", () => {
  for (const bytes of [[0, 0, 1, 2, 3], [255, 254, 253], Array.from({ length: 32 }, (_, i) => i * 7)]) {
    assert.deepEqual([...decodeBase58(encodeBase58(Uint8Array.from(bytes)))], bytes);
  }
  assert.equal(decodeBase58(MEMO_PROGRAM).length, 32);
  assert.throws(() => decodeBase58("0OIl"), /not a base58 character/);
});

test("the memo transaction is one signature plus a message, and the signature verifies against the signer", () => {
  const { key, pub } = throwaway();
  const tx = buildMemoTx(key, "hello devnet", blockhash);
  assert.equal(tx[0], 1); // one signature
  const sig = tx.slice(1, 65);
  const msg = tx.slice(65);
  assert.deepEqual([...msg.slice(0, 3)], [1, 0, 1]); // header
  assert.equal(msg[3], 2); // two accounts: signer and the Memo program
  assert.deepEqual([...msg.slice(4, 36)], [...pub]);
  assert.deepEqual([...msg.slice(36, 68)], [...decodeBase58(MEMO_PROGRAM)]);
  assert.deepEqual([...msg.slice(68, 100)], [...decodeBase58(blockhash)]);
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]);
  assert.equal(verify(null, msg, createPublicKey({ key: spki, format: "der", type: "spki" }), sig), true);
  assert.equal(Buffer.from(msg.slice(-12)).toString("utf8"), "hello devnet");
});

test("a changed message no longer verifies (this is what the devnet node rejects as SignatureFailure)", () => {
  const { key, pub } = throwaway();
  const tx = buildMemoTx(key, "a", blockhash);
  const msg = Uint8Array.from(tx.slice(65));
  msg[msg.length - 1] = msg[msg.length - 1]! ^ 1;
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(pub)]);
  assert.equal(verify(null, msg, createPublicKey({ key: spki, format: "der", type: "spki" }), tx.slice(1, 65)), false);
});

test("an over-long memo is refused before anything is built", () => {
  assert.throws(() => buildMemoTx(throwaway().key, "x".repeat(501), blockhash), /memo too long/);
});
