import { test } from "node:test";
import assert from "node:assert/strict";
import { CRITERIA, checks, score, type DemoPack } from "../src/rubric.ts";

const full: DemoPack = {
  name: "x", lane: "tooling", problemStatement: "Agents send bad orders.", cleanCheckout: true, endToEndExample: true, limitations: ["recorded data only"],
  testReport: { passing: 10, failing: 0 }, failureTest: true, testsRunOnRecorded: true, testReportMatchesFrozenCommit: true,
  devnetAddressOrNoneStated: true, devnetTxLinkOpens: true, claimMatchesLink: true, readsLabelledMainnetWritesDevnet: true, simulatedReturnClaimed: false,
};

test("three criteria, four checks each", () => {
  assert.deepEqual(CRITERIA.map((c) => c.id), ["utility", "tests", "devnet"]);
  const cs = checks(full);
  assert.equal(cs.length, 12);
  for (const k of CRITERIA) assert.equal(cs.filter((c) => c.criterion === k.id).length, 4);
});

test("a complete pack scores 12 of 12 with nothing missing", () => {
  const s = score(full);
  assert.equal(s.points, 12);
  assert.deepEqual(s.missing, []);
});

test("an empty pack scores 0", () => {
  const s = score({ ...full, problemStatement: null, cleanCheckout: false, endToEndExample: false, limitations: [], testReport: null, failureTest: false, testsRunOnRecorded: false, testReportMatchesFrozenCommit: false, devnetAddressOrNoneStated: false, devnetTxLinkOpens: false, claimMatchesLink: false, readsLabelledMainnetWritesDevnet: false });
  assert.equal(s.points, 0);
  assert.equal(s.missing.length, 12);
});

test("failing tests do not count as a passing report", () => {
  assert.equal(checks({ ...full, testReport: { passing: 9, failing: 1 } }).find((c) => c.id === "t1")!.pass, false);
  assert.equal(checks({ ...full, testReport: { passing: 0, failing: 0 } }).find((c) => c.id === "t1")!.pass, false);
});

test("a blank problem statement does not count", () => {
  assert.equal(checks({ ...full, problemStatement: "   " }).find((c) => c.id === "u1")!.pass, false);
});

test("a simulated return claim never changes the score; it only adds a note", () => {
  const a = score(full);
  const b = score({ ...full, simulatedReturnClaimed: true });
  assert.equal(a.points, b.points);
  assert.match(b.returnsNote, /not scored/);
  assert.match(a.returnsNote, /No return claim/);
});
