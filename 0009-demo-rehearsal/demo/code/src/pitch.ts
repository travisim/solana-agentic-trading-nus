// The sample 3-minute script, written FROM the walk-through numbers (so every figure in it comes from out/walkthrough.json),
// and an estimate of how long each part takes to say (130 words a minute is a calm speaking pace).
import type { AgentRun } from "./agent.ts";
import { SEGMENTS, TOTAL_SEC } from "./timer.ts";

export const WORDS_PER_MINUTE = 130;
const fmt = (n: number) => n.toLocaleString("en-US");

export interface ScriptPart { id: string; label: string; budgetSec: number; text: string; words: number; estSec: number; fits: boolean }

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function buildScript(run: AgentRun, failureCount: number, devnetSimOk: boolean): ScriptPart[] {
  const sc = run.scorecard;
  const rules = Object.entries(sc.rejectedByRule).map(([r, n]) => `${n} by ${r}`).join(", ") || "none";
  const text: Record<string, string> = {
    problem:
      "An agent that can place orders will sooner or later send a bad one: too big, based on a stale price, or in the wrong unit. " +
      "Anyone building an agent on Solana needs a plain check between the idea and the action. Without it, one wrong number moves real money.",
    what:
      `This is a small agent. It reads recorded Orca SOL/USDC swaps, cuts them into ${fmt(run.params.thresholdUsd)} dollar bars, ` +
      `wakes on an ${run.params.cusumBps} basis point change alert and proposes one order per alert. ` +
      "A risk hook checks each order against the Pyth oracle and answers yes or no, with the rule that decided. Accepted orders go into a ledger.",
    proof:
      `Here it runs on ${fmt(run.window.swaps)} real swaps: ${sc.events} change alerts, ${sc.accepted} orders accepted, ${sc.rejected} refused (${rules}). ` +
      `Now the failure test: I feed it ${failureCount} bad orders, a 5,000 dollar order, a 300 second old oracle, a price in cents and a price 100 basis points off. All ${failureCount} are refused, each with its reason. ` +
      "Reads are public mainnet data; writes are devnet only. " +
      (devnetSimOk
        ? "On devnet, the node verifies my signed memo transaction, but the faucet was rate limited, so there is no funded transaction link yet."
        : "I do not have a devnet transaction to show yet."),
    next:
      "Limits: this is simulated on recorded data, about seventeen minutes of one afternoon. The order sizes and the fee are assumptions, and no order was sent anywhere. " +
      "The ledger is not evidence of returns. Next: write one funded devnet memo for every accepted order, and run the same hook on the live feed.",
  };
  return SEGMENTS.map((s) => {
    const words = wordCount(text[s.id]!);
    const estSec = Math.round((words / WORDS_PER_MINUTE) * 60);
    return { id: s.id, label: s.label, budgetSec: s.budgetSec, text: text[s.id]!, words, estSec, fits: estSec <= s.budgetSec };
  });
}

export function scriptTotalSec(parts: ScriptPart[]): number {
  return parts.reduce((a, p) => a + p.estSec, 0);
}
export const BUDGET_SEC = TOTAL_SEC;
