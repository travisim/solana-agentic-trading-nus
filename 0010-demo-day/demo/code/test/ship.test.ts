import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHECKS, checkShip } from "../src/ship.ts";
import { root } from "./helpers.ts";

const tmp = mkdtempSync(join(tmpdir(), "ship-test-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));
const copy = (name: "ready" | "gaps") => {
  const d = join(tmp, name + "-" + Math.random().toString(36).slice(2, 7));
  cpSync(`${root}recorded/ship-fixtures/${name}`, d, { recursive: true });
  return d;
};
const status = (dir: string) => Object.fromEntries(checkShip(dir).results.map((r) => [r.id, r.ok]));

test("the ready example passes every check", () => {
  const r = checkShip(copy("ready"));
  assert.equal(r.ready, true);
  assert.equal(r.passed, CHECKS.length);
});

test("the gaps example fails the required checks it should", () => {
  const s = status(copy("gaps"));
  for (const id of ["run", "test-command", "mainnet-write", "devnet-evidence", "recorded-backup"]) assert.equal(s[id], false, id);
  assert.equal(s["lockfile"], true);
  assert.equal(checkShip(copy("gaps")).ready, false);
});

test("a keypair-shaped file (64 numbers) and a .env are caught; .env.example is not", () => {
  const d = copy("ready");
  assert.equal(status(d)["secrets"], true);
  writeFileSync(join(d, ".env.example"), "RPC_URL=\n");
  assert.equal(status(d)["secrets"], true);
  writeFileSync(join(d, "wallet-backup.json"), JSON.stringify(new Array(64).fill(7)));
  assert.equal(status(d)["secrets"], false);
  rmSync(join(d, "wallet-backup.json"));
  writeFileSync(join(d, ".env"), "X=1\n");
  assert.equal(status(d)["secrets"], false);
});

test("a short number array is not mistaken for a keypair", () => {
  const d = copy("ready");
  writeFileSync(join(d, "data.json"), JSON.stringify([1, 2, 3]));
  assert.equal(status(d)["secrets"], true);
});

test("the folder's own path does not change the result (tests/ in the path above is ignored)", () => {
  const d = join(tmp, "tests", "recorded", "x");
  mkdirSync(d, { recursive: true });
  cpSync(`${root}recorded/ship-fixtures/gaps`, d, { recursive: true });
  const s = status(d);
  assert.equal(s["recorded-backup"], false);
});

test("a private key block is caught", () => {
  const d = copy("ready");
  writeFileSync(join(d, "notes.txt"), "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n");
  assert.equal(status(d)["secrets"], false);
});

test("a missing folder throws a clear error", () => {
  assert.throws(() => checkShip(join(tmp, "nope")), /not a folder/);
});
