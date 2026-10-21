import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answersMarkdown, pickTen, sheetMarkdown } from "../src/minilab.ts";
import { DEFAULT_PARAMS, tripleBarrier } from "../src/labels.ts";

const series = JSON.parse(readFileSync(new URL("../recorded/series.json", import.meta.url), "utf8")).points as { t: number; orca: number }[];
const prices = series.map((p) => p.orca);
const { labels } = tripleBarrier(prices, series.map((p) => p.t), DEFAULT_PARAMS);

test("ten decisions with a mix of labels, and the key agrees with a by-hand scan of the sheet", () => {
  const ten = pickTen(labels, prices, DEFAULT_PARAMS.horizon);
  assert.equal(ten.length, 10);
  assert.ok(new Set(ten.map((x) => x.label)).size === 3, "all three labels appear");
  for (const x of ten) {
    // label it by hand from the sheet's numbers only
    let hand: number = 0;
    for (const p of x.next) { if (p >= x.up) { hand = 1; break; } if (p <= x.dn) { hand = -1; break; } }
    assert.equal(hand, x.label, `decision ${x.n}`);
    assert.equal(x.next.length, DEFAULT_PARAMS.horizon);
  }
});

test("sheet and key are plain markdown with no NaN or undefined", () => {
  const ten = pickTen(labels, prices, DEFAULT_PARAMS.horizon);
  for (const t of [sheetMarkdown(ten, 24, "5 seconds"), answersMarkdown(ten)]) assert.ok(!/NaN|undefined/.test(t));
  assert.match(sheetMarkdown(ten, 24, "5 seconds"), /Decision 10/);
});
