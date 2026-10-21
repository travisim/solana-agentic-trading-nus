// Explanation checker: read the facts an agent wrote in its reason and compare them with the data it had.
// It works on the TEXT, so you can paste the reasons of any agent (including an LLM) in the same format and grade them.
// It checks three kinds of claim:  direction ("rose" / "fell"), size ("4.1 bps", "1.8x the recent noise"), venue gap ("within 0.6 bps").
// It does not judge whether the trade idea is good; it only asks "is what you said true?".
import type { Truth } from "./agent.ts";

export interface Claims {
  word: "rose" | "fell" | null;
  momBps: number | null;
  ratio: number | null;
  gapWithinBps: number | null;
}

export function parseReason(text: string): Claims {
  const num = (m: RegExpMatchArray | null) => (m ? Number(m[1]) : null);
  const word = /\b(rose|fell)\b/i.exec(text)?.[1]?.toLowerCase() as Claims["word"] | undefined;
  return {
    word: word ?? null,
    momBps: num(/(\d+(?:\.\d+)?)\s*bps in the last/i.exec(text)),
    ratio: num(/(\d+(?:\.\d+)?)x the recent noise/i.exec(text)),
    gapWithinBps: num(/within\s+(\d+(?:\.\d+)?)\s*bps/i.exec(text)),
  };
}

export interface Check { ok: boolean; problems: string[]; claims: Claims }

/** A number claim is fine if it is within 0.1 bps (or 0.1x) or 5% of the true value; the text is rounded to one decimal. */
const close = (claim: number, truth: number) => Math.abs(claim - truth) <= Math.max(0.1, 0.05 * Math.abs(truth));

export function checkReason(text: string, t: Truth): Check {
  const c = parseReason(text);
  const problems: string[] = [];
  const trueWord = t.momBps >= 0 ? "rose" : "fell";
  if (c.word === null) problems.push("no direction stated");
  else if (c.word !== trueWord) problems.push(`says it ${c.word}, the data says it ${trueWord}`);
  if (c.momBps === null) problems.push("no size in bps stated");
  else if (!close(c.momBps, Math.abs(t.momBps))) problems.push(`says ${c.momBps} bps, the data says ${Math.abs(t.momBps).toFixed(1)} bps`);
  if (c.ratio === null) problems.push("no noise ratio stated");
  else if (!close(c.ratio, t.ratio)) problems.push(`says ${c.ratio}x the noise, the data says ${t.ratio.toFixed(1)}x`);
  if (c.gapWithinBps !== null && t.gapBps !== null && t.gapBps > c.gapWithinBps + 0.05) problems.push(`says venues agree within ${c.gapWithinBps} bps, the gap is ${t.gapBps.toFixed(1)} bps`);
  return { ok: problems.length === 0, problems, claims: c };
}
