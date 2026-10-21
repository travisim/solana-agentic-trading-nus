// The 3-minute demo: four parts with a time budget each, a timing verdict, and the pass/fail check list used by listeners.
export interface Segment { id: "problem" | "what" | "proof" | "next"; label: string; budgetSec: number; goal: string }

export const SEGMENTS: Segment[] = [
  { id: "problem", label: "Problem", budgetSec: 30, goal: "Who has the problem, in one sentence" },
  { id: "what", label: "What it does", budgetSec: 35, goal: "The idea and the parts, no jargon" },
  { id: "proof", label: "Live proof", budgetSec: 75, goal: "Live fix, failure test, devnet evidence" },
  { id: "next", label: "Limit and next", budgetSec: 40, goal: "One limitation, what is untested, what comes next" },
];
export const TOTAL_SEC = SEGMENTS.reduce((a, s) => a + s.budgetSec, 0); // 180
export const QA_SEC = 120;
export const OVER_TOLERANCE_SEC = 10;

export type SegStatus = "ok" | "short" | "over" | "way-over" | "missing";
export interface SegVerdict { id: Segment["id"]; label: string; budgetSec: number; usedSec: number | null; status: SegStatus }
export interface TimingVerdict { segments: SegVerdict[]; totalSec: number; underTotal: boolean; noWayOver: boolean; pass: boolean }

/** Status of one part: on budget, rushed (under half), a little over (up to 10 s), or way over. */
export function segStatus(used: number | null | undefined, budget: number): SegStatus {
  if (used === null || used === undefined || !Number.isFinite(used)) return "missing";
  if (used > budget + OVER_TOLERANCE_SEC) return "way-over";
  if (used > budget) return "over";
  if (used < budget / 2) return "short";
  return "ok";
}

export function timingVerdict(log: Partial<Record<Segment["id"], number>>): TimingVerdict {
  const segments = SEGMENTS.map((s) => ({ id: s.id, label: s.label, budgetSec: s.budgetSec, usedSec: log[s.id] ?? null, status: segStatus(log[s.id], s.budgetSec) }));
  const totalSec = segments.reduce((a, s) => a + (s.usedSec ?? 0), 0);
  const underTotal = totalSec <= TOTAL_SEC;
  const noWayOver = segments.every((s) => s.status !== "way-over");
  return { segments, totalSec, underTotal, noWayOver, pass: underTotal && noWayOver && segments.every((s) => s.status !== "missing") };
}

export interface Check { id: string; kind: "timing" | "content"; text: string }
export const CHECKS: Check[] = [
  { id: "t-total", kind: "timing", text: "Finished within 3:00" },
  { id: "t-parts", kind: "timing", text: "No part ran more than 10 s over its budget" },
  { id: "c-problem", kind: "content", text: "Said who has the problem in the first 30 seconds" },
  { id: "c-live", kind: "content", text: "Showed one live action, not only a slide" },
  { id: "c-failure", kind: "content", text: "Ran the failure test and showed the refusal" },
  { id: "c-devnet", kind: "content", text: "Opened a devnet link, or said there is none and why" },
  { id: "c-limit", kind: "content", text: "Said one limitation out loud" },
  { id: "c-returns", kind: "content", text: "Made no return or profit claim" },
  { id: "c-restate", kind: "content", text: "A listener can restate the claim in one sentence" },
];

export interface CheckResult { id: string; text: string; pass: boolean | null }
/** Timing checks come from the timer; content checks come from the listeners (true, false or not yet answered = null). */
export function evaluateChecks(log: Partial<Record<Segment["id"], number>>, answers: Record<string, boolean | undefined>) {
  const tv = timingVerdict(log);
  const results: CheckResult[] = CHECKS.map((c) => ({
    id: c.id,
    text: c.text,
    pass: c.id === "t-total" ? tv.underTotal : c.id === "t-parts" ? tv.noWayOver : answers[c.id] ?? null,
  }));
  const failed = results.filter((r) => r.pass === false).length;
  const open = results.filter((r) => r.pass === null).length;
  return { results, failed, open, passed: results.filter((r) => r.pass === true).length, verdict: failed ? "fix and rerun" : open ? "not finished" : "ready" } as const;
}
