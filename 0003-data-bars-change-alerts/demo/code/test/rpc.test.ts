import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { getJson, rpcCall, RateLimitError } from "../src/rpc.ts";

test("HTTP 429 raises a clear RateLimitError, never a silent failure", async () => {
  const server = createServer((_req, res) => { res.statusCode = 429; res.end("slow down"); }).listen(0);
  try {
    const { port } = server.address() as { port: number };
    await assert.rejects(getJson(`http://127.0.0.1:${port}/x`), (e: Error) => {
      assert.ok(e instanceof RateLimitError);
      assert.match(e.message, /429.*--recorded/s);
      return true;
    });
  } finally {
    server.close();
  }
});
test("rpcCall backs off on 429 and then succeeds", async () => {
  let n = 0;
  const server = createServer((_req, res) => {
    if (n++ < 1) { res.statusCode = 429; res.end("slow"); return; }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: 42 }));
  }).listen(0);
  try {
    const { port } = server.address() as { port: number };
    assert.equal(await rpcCall<number>("x", [], { url: `http://127.0.0.1:${port}/`, retries: 3 }), 42);
    assert.equal(n, 2);
  } finally {
    server.close();
  }
});
