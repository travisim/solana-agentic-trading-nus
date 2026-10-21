import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { getJson, RateLimitError } from "../src/rpc.ts";

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
