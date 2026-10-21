// The judging rubric: one source for the deck, the scorecard demo and the tests.
// Weights are a proposal for the leads to confirm. Simulated returns are never scored.
export interface Criterion {
  id: "utility" | "tests" | "devnet" | "explanation" | "contribution";
  label: string;
  weight: number;
  question: string;
  anchors: [string, string, string, string, string];
}

export const SCALE = { min: 0, max: 4 } as const;

export const CRITERIA: Criterion[] = [
  {
    id: "utility",
    label: "Utility",
    weight: 30,
    question: "Would someone else use this, or learn from it?",
    anchors: ["0 Nothing runs", "1 Runs, no clear user", "2 Useful to the builders", "3 A stranger could use it", "4 A stranger would choose it"],
  },
  {
    id: "tests",
    label: "Reproducible tests",
    weight: 25,
    question: "Can a stranger run the tests from a clean clone and get the same result?",
    anchors: ["0 No tests", "1 Tests exist, do not run", "2 Run on the builder's laptop", "3 Pass from a clean clone", "4 Clean clone, and a test for a failure"],
  },
  {
    id: "devnet",
    label: "Devnet evidence",
    weight: 25,
    question: "Is there a devnet transaction or program anyone can check?",
    anchors: ["0 None", "1 Claimed, not shown", "2 Signature shown", "3 Signature checks out on devnet", "4 Checks out, and the code that sent it is in the repo"],
  },
  {
    id: "explanation",
    label: "Clear explanation",
    weight: 10,
    question: "Problem, failed attempt, useful change, test, limitation: was the story clear?",
    anchors: ["0 Could not follow", "1 Parts were clear", "2 Clear problem and result", "3 Clear, with the failed attempt", "4 Clear, and a limitation named"],
  },
  {
    id: "contribution",
    label: "Sustained contribution",
    weight: 10,
    question: "Did the work grow over the semester, with commits from the whole team?",
    anchors: ["0 One late commit", "1 A few commits", "2 Steady commits", "3 Steady, shared by the team", "4 Steady, shared, and helped others"],
  },
];

export const NOT_SCORED = ["simulated returns", "profit claims", "a backtest return chart"];

export const TOTAL = CRITERIA.reduce((a, c) => a + c.weight, 0);

/** scores: criterion id -> whole number SCALE.min..SCALE.max. Returns points out of TOTAL (one decimal). */
export function total(scores: Record<string, number>): number {
  let pts = 0;
  for (const c of CRITERIA) {
    const s = Math.min(SCALE.max, Math.max(SCALE.min, Math.round(scores[c.id] ?? 0)));
    pts += (c.weight * s) / SCALE.max;
  }
  return Math.round(pts * 10) / 10;
}

export function rubricJson() {
  return { criteria: CRITERIA, scale: SCALE, notScored: NOT_SCORED, total: TOTAL };
}

/** Starting scores drawn from evidence only: tests and devnet. The judge sets the rest. Never uses returns. */
export function suggestScores(p: { tests?: { passing: number; total: number }; devnetSignature?: string; programId?: string; evidence?: { devnet: string } }): Record<string, number> {
  const out: Record<string, number> = { utility: 2, tests: 0, devnet: 0, explanation: 2, contribution: 2 };
  if (p.tests && p.tests.total > 0) out["tests"] = p.tests.passing === p.tests.total ? 3 : p.tests.passing / p.tests.total >= 0.8 ? 2 : 1;
  const d = p.evidence?.devnet ?? "";
  if (/^(finalized|confirmed|processed) on devnet/.test(d)) out["devnet"] = 3;
  else if (/not found|failed/.test(d)) out["devnet"] = 1;
  else if (p.devnetSignature) out["devnet"] = 2;
  else if (p.programId) out["devnet"] = 1;
  return out;
}
