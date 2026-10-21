import { test } from "node:test";
import assert from "node:assert/strict";
import { dollarBars, totalVolumeUsd } from "../src/bars.ts";
import { cusum } from "../src/cusum.ts";
import { swapsOf } from "./helpers.ts";

test("dollar bars conserve volume and close on the swap that crosses the threshold", () => {
  const sw = swapsOf([[1, 100, 600], [2, 101, 600], [3, 99, 300], [4, 100, 900], [5, 100, 100]]);
  const bars = dollarBars(sw, 1000);
  assert.deepEqual(bars.map((b) => b.volumeUsd), [1200, 1200, 100]);
  assert.equal(bars.reduce((a, b) => a + b.volumeUsd, 0), totalVolumeUsd(sw));
});
test("CUSUM fires when a bucket passes the threshold (smoke test of the piece reused from build night 2)", () => {
  const r = cusum([{ t: 0, price: 100 }, { t: 1, price: 100.16 }], 15);
  assert.equal(r.events.length, 1);
});
