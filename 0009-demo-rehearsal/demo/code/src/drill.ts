// The live-vs-recorded switch drill: when a live call fails, what does the demo do and what does the presenter say?
// Rule (same as every lab demo): one failed call is retried; three failures in a row switch to recorded data.
export interface DrillState { mode: "live" | "recorded"; fails: number }
export type DrillAction = "continue" | "retry" | "fallback" | "none";
export const POLICY = { failuresToFallback: 3 } as const; // a failed call is tried again; the third failure in a row switches

export function nextState(s: DrillState, callOk: boolean): DrillState & { action: DrillAction } {
  if (s.mode === "recorded") return { ...s, action: "none" };
  if (callOk) return { mode: "live", fails: 0, action: "continue" };
  const fails = s.fails + 1;
  if (fails >= POLICY.failuresToFallback) return { mode: "recorded", fails, action: "fallback" };
  return { mode: "live", fails, action: "retry" };
}

/** Feed a list of call outcomes through the rule; returns the state after each call. */
export function runCalls(outcomes: boolean[]): (DrillState & { action: DrillAction })[] {
  const out: (DrillState & { action: DrillAction })[] = [];
  let s: DrillState = { mode: "live", fails: 0 };
  for (const ok of outcomes) {
    const n = nextState(s, ok);
    out.push(n);
    s = { mode: n.mode, fails: n.fails };
  }
  return out;
}

export interface DrillStep { id: string; budgetSec: number; do: string; say: string }
export function drillSteps(recordedDate: string): DrillStep[] {
  return [
    { id: "notice", budgetSec: 5, do: "Notice the live number stops changing, or the pill turns red.", say: "That call did not come back." },
    { id: "retry", budgetSec: 5, do: "Wait for the next call to answer. Do not click around.", say: "One more try." },
    { id: "switch", budgetSec: 10, do: "Third failure in a row: press Recorded. Same code, same screen.", say: `The live call is not answering, so I am switching to recorded data from ${recordedDate}. It is the same logic on data I captured earlier.` },
    { id: "carry-on", budgetSec: 10, do: "Carry on from the same step. Do not restart the pitch.", say: "Same input shape, same rule, same refusal. Here is the decision." },
    { id: "screen", budgetSec: 20, do: "Open the backup recording and narrate over it.", say: "My screen is not cooperating, so I will narrate the recording I made earlier. Everything in it is real output from this repo." },
  ];
}
export const DRILL_BUDGET_SEC = 30; // from the first failed call to carrying on, for the live-call failure (steps 1 to 4)
