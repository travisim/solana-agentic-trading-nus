import { test } from "node:test";
import assert from "node:assert/strict";
import { filterSwaps } from "../src/clean.ts";
import { swapsOf } from "./helpers.ts";

test("drops duplicate signatures, dust and a price outlier; keeps the rest in order", () => {
  const rows: [number, number, number][] = Array.from({ length: 30 }, (_, i) => [i, 100 + (i % 3) * 0.01, 500]);
  const sw = swapsOf(rows);
  sw.push({ ...sw[3]! }); // duplicate signature
  sw[10] = { ...sw[10]!, price: 5753, usdcAmount: 500 }; // wrong price (52x)
  sw[12] = { ...sw[12]!, usdcAmount: 0.4 }; // dust
  const r = filterSwaps(sw.sort((a, b) => a.t - b.t));
  assert.equal(r.duplicates, 1);
  assert.equal(r.dust, 1);
  assert.equal(r.outliers, 1);
  assert.equal(r.kept.length, sw.length - 3);
  assert.ok(r.kept.every((s, i, a) => i === 0 || a[i - 1]!.t <= s.t));
});
