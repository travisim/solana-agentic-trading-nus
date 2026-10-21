// What the judge sees: three criteria, four checks each. Utility, tests, devnet evidence. Simulated returns are never scored.
export interface DemoPack {
  name: string;
  lane: "agent" | "exchange" | "tooling";
  problemStatement: string | null;
  cleanCheckout: boolean;
  endToEndExample: boolean;
  limitations: string[];
  testReport: { passing: number; failing: number } | null;
  failureTest: boolean;
  testsRunOnRecorded: boolean;
  testReportMatchesFrozenCommit: boolean;
  devnetAddressOrNoneStated: boolean;
  devnetTxLinkOpens: boolean;
  claimMatchesLink: boolean;
  readsLabelledMainnetWritesDevnet: boolean;
  /** A simulated return or profit number in the pitch. Never scored; flagged. */
  simulatedReturnClaimed: boolean;
}

export type CriterionId = "utility" | "tests" | "devnet";
export interface RubricCheck { id: string; criterion: CriterionId; text: string; evidence: string; pass: boolean }

export const CRITERIA: { id: CriterionId; label: string; question: string }[] = [
  { id: "utility", label: "Utility", question: "Is there a real user, a real problem and a decision I can follow?" },
  { id: "tests", label: "Tests", question: "Do tests pass, including the failure case, from the frozen commit?" },
  { id: "devnet", label: "Devnet evidence", question: "Can I open a transaction or address and see what the slide says?" },
];

export function checks(p: DemoPack): RubricCheck[] {
  const c = (id: string, criterion: CriterionId, text: string, evidence: string, pass: boolean): RubricCheck => ({ id, criterion, text, evidence, pass });
  return [
    c("u1", "utility", "Names a user and a problem in one sentence", "first slide and first 30 seconds", !!p.problemStatement && p.problemStatement.trim().length > 0),
    c("u2", "utility", "Runs from a clean checkout using only the README", "a fresh clone, the README commands", p.cleanCheckout),
    c("u3", "utility", "Shows one decision end to end: input, rule, result", "the live proof part", p.endToEndExample),
    c("u4", "utility", "States what it does not do", "limitations in the README and said aloud", p.limitations.length > 0),
    c("t1", "tests", "npm test passes and the report is attached", "test report file in the demo pack", !!p.testReport && p.testReport.passing > 0 && p.testReport.failing === 0),
    c("t2", "tests", "A test covers the failure case (a bad input is refused)", "a named test for the bad input", p.failureTest),
    c("t3", "tests", "Tests run offline on recorded data", "run with Wi-Fi off", p.testsRunOnRecorded),
    c("t4", "tests", "The test report is from the frozen commit", "commit hash in the report matches the pack", p.testReportMatchesFrozenCommit),
    c("d1", "devnet", "Shows a devnet address, or says there is none and why", "address on the slide or a stated reason", p.devnetAddressOrNoneStated),
    c("d2", "devnet", "At least one devnet transaction link opens", "explorer link with cluster=devnet", p.devnetTxLinkOpens),
    c("d3", "devnet", "What the slide claims matches what the link shows", "the transaction shows the claimed action", p.claimMatchesLink),
    c("d4", "devnet", "Reads labelled public mainnet; writes labelled devnet only", "labels on the slide and in the README", p.readsLabelledMainnetWritesDevnet),
  ];
}

export function score(p: DemoPack) {
  const cs = checks(p);
  const per = CRITERIA.map((k) => {
    const mine = cs.filter((x) => x.criterion === k.id);
    return { id: k.id, label: k.label, points: mine.filter((x) => x.pass).length, outOf: mine.length };
  });
  const points = per.reduce((a, k) => a + k.points, 0);
  const missing = cs.filter((x) => !x.pass).map((x) => x.id);
  return {
    checks: cs,
    perCriterion: per,
    points,
    outOf: cs.length,
    missing,
    // Returns are never part of the score. If the pitch leads with one, the judge is told to ignore it and the presenter to cut it.
    returnsNote: p.simulatedReturnClaimed ? "A simulated return was claimed. It is not scored. Cut it from the pitch." : "No return claim. Good.",
  };
}
