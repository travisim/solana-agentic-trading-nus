import { test } from "node:test";
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { base58, base58Decode } from "../src/base58.ts";
import { assertWritable, buildTransaction, compileMessage, generateKeypairFile, keypairFromBytes, systemTransfer, MEMO_PROGRAM, memoIx } from "../src/tx.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const hex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));

test("base58 round trip, including leading zero bytes", () => {
  const b = Uint8Array.of(0, 0, 1, 2, 255);
  assert.deepEqual(base58Decode(base58(b)), b);
  assert.equal(base58(new Uint8Array(32)), "11111111111111111111111111111111");
  assert.equal(base58Decode("11111111111111111111111111111111").length, 32);
});

test("ed25519 signing matches RFC 8032 test vector 1 (empty message)", () => {
  const seed = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
  const pub = hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
  const kp = keypairFromBytes(Uint8Array.from([...seed, ...pub]));
  assert.equal(Buffer.from(kp.pub).toString("hex"), "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a");
  const sig = kp.signBytes(new Uint8Array(0));
  assert.equal(Buffer.from(sig).toString("hex"), "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b");
});

test("a keypair whose public half does not match its seed is refused", () => {
  const seed = hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60");
  assert.throws(() => keypairFromBytes(Uint8Array.from([...seed, ...new Uint8Array(32)])), /corrupt/);
});

test("a generated keypair file is private (mode 600) and never serializes", () => {
  const p = path.join(os.tmpdir(), `kp-test-${process.pid}.json`);
  const kp = generateKeypairFile(p);
  try {
    assert.equal(fs.statSync(p).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(p, "utf8")).length, 64);
    assert.throws(() => JSON.stringify(kp), /refusing/);
  } finally {
    fs.rmSync(p);
  }
});

test("a transfer message has the legacy layout and a valid signature", () => {
  const payer = keypairFromBytes(Uint8Array.from([...hex("9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60"), ...hex("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a")]));
  const to = "11111111111111111111111111111112"; // any valid 32-byte key
  const bh = base58(new Uint8Array(32).fill(7));
  const { message, signers } = compileMessage(payer.publicKey, [systemTransfer(payer.publicKey, to, 5n)], bh);
  assert.deepEqual([...message.slice(0, 4)], [1, 0, 1, 3]); // 1 signer, 0 readonly signed, 1 readonly unsigned (system program), 3 keys
  assert.equal(signers[0], payer.publicKey);
  const { raw, signature } = buildTransaction(message, signers, [payer]);
  assert.equal(raw[0], 1); // one signature
  assert.equal(base58(raw.slice(1, 65)), signature);
  const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(payer.pub)]);
  assert.equal(verify(null, Buffer.from(message), createPublicKey({ key: spki, format: "der", type: "spki" }), Buffer.from(raw.slice(1, 65))), true);
  // instruction data: transfer = 2 (u32) + lamports (u64)
  assert.deepEqual([...systemTransfer(payer.publicKey, to, 5n).data], [2, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0]);
});

test("a memo instruction names the memo program and carries the text", () => {
  const ix = memoIx("hi", "11111111111111111111111111111112");
  assert.equal(ix.programId, MEMO_PROGRAM);
  assert.equal(new TextDecoder().decode(ix.data), "hi");
});

test("writes are refused on anything but devnet or a local validator", () => {
  assert.throws(() => assertWritable("https://api.mainnet-beta.solana.com"), /devnet only/);
  assert.throws(() => assertWritable("https://solana-rpc.publicnode.com"), /devnet only/);
  assert.doesNotThrow(() => assertWritable("https://api.devnet.solana.com"));
  assert.doesNotThrow(() => assertWritable("http://127.0.0.1:8899"));
});
