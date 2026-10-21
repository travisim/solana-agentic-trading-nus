import { test } from "node:test";
import assert from "node:assert/strict";
import { fit, predict, tally, type Row } from "../src/meta.ts";

test("the gate learns a clean rule: high first feature means win", () => {
  const X = Array.from({ length: 60 }, (_, i) => [i / 10, 0, 1]);
  const y = X.map((r) => ((r[0] as number) > 3 ? 1 : 0));
  const m = fit(X, y);
  assert.ok(predict(m, [5.5, 0, 1]) > 0.8);
  assert.ok(predict(m, [0.5, 0, 1]) < 0.2);
});

test("a constant feature does not break the fit (std floor)", () => {
  const m = fit([[1, 5], [2, 5], [3, 5], [4, 5]], [0, 0, 1, 1]);
  assert.ok(m.std.every((s) => s > 0 && Number.isFinite(s)));
  assert.ok(Number.isFinite(predict(m, [2.5, 5])));
});

test("the fit is repeatable", () => {
  const X = [[1, 0], [2, 1], [3, 0], [4, 1], [5, 0]];
  const y = [0, 0, 1, 1, 1];
  assert.deepEqual(fit(X, y), fit(X, y));
});

test("tally counts wins and gives a wide +/- when there are few trades", () => {
  const rows = [{ win: 1 }, { win: 0 }, { win: 1 }, { win: 0 }] as Row[];
  const t = tally(rows);
  assert.deepEqual([t.trades, t.wins, t.hitRatePct], [4, 2, 50]);
  assert.ok(t.ci95Pct! > 40);
  assert.equal(tally([]).hitRatePct, null);
});
