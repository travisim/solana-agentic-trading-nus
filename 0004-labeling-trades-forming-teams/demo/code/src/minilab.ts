// Mini-lab sheet: ten decisions to label BY HAND, and an answer key to compare with afterwards.
// For each decision the sheet gives the starting price, the two barrier prices and the next prices one step at a time (the time limit
// is `horizon` steps). The student writes +1 (upper barrier first), -1 (lower first) or 0 (time ran out), then checks the key.
// The ten are picked from the real labels: a fixed mix (3 up, 3 down, 4 time-outs when there are enough) in a fixed shuffled order.
import { roll } from "./agent.ts";
import type { Label } from "./labels.ts";

export interface MiniDecision { n: number; i: number; t: number; price: number; up: number; dn: number; widthBps: number; next: number[]; label: 1 | -1 | 0; exitStep: number; touch: Label["touch"] }

export function pickTen(labels: Label[], prices: number[], horizon: number, seed = 11): MiniDecision[] {
  const take = (pred: (l: Label) => boolean, k: number) => {
    const pool = labels.filter(pred);
    // spread the picks over the recording instead of taking the first k
    return Array.from({ length: Math.min(k, pool.length) }, (_, j) => pool[Math.floor(((j + 0.5) * pool.length) / Math.min(k, pool.length))]!);
  };
  let chosen = [...take((l) => l.label === 1, 3), ...take((l) => l.label === -1, 3), ...take((l) => l.label === 0, 4)];
  for (const l of labels) { if (chosen.length >= 10) break; if (!chosen.includes(l)) chosen.push(l); }
  chosen = chosen.slice(0, 10).sort((a, b) => roll(a.i, seed) - roll(b.i, seed));
  return chosen.map((l, k) => ({
    n: k + 1, i: l.i, t: l.t, price: l.price, up: l.up, dn: l.dn, widthBps: l.widthBps,
    next: prices.slice(l.i + 1, l.i + 1 + horizon), label: l.label, exitStep: l.exitI - l.i, touch: l.touch,
  }));
}

export function sheetMarkdown(d: MiniDecision[], horizon: number, stepText: string): string {
  const out = [
    "# Mini-lab: label ten decisions by hand",
    "",
    `Real SOL/USDC prices (recorded). For each decision, walk through the next ${horizon} prices (one every ${stepText}). Write **+1** if the price reaches the upper barrier first, **-1** if it reaches the lower barrier first, **0** if neither is touched in ${horizon} steps. "Reaches" means at or beyond the barrier. Then compare with \`out/minilab-answers.md\`.`,
    "",
    "Then run `npm run demo -- --mult 1.5` and label decision 1 again: what changed?",
    "",
  ];
  for (const x of d) {
    out.push(`## Decision ${x.n}`, "", `start price ${x.price.toFixed(4)}  |  upper barrier ${x.up.toFixed(4)}  |  lower barrier ${x.dn.toFixed(4)}  |  width ${x.widthBps.toFixed(2)} bps`, "", "next prices:", "", "```", ...chunk(x.next.map((p) => p.toFixed(4)), 6).map((r) => r.join("  ")), "```", "", "your label: ____", "");
  }
  return out.join("\n");
}

export function answersMarkdown(d: MiniDecision[]): string {
  return ["# Mini-lab answer key", "", "| Decision | Label | What happened |", "|---|---|---|", ...d.map((x) => `| ${x.n} | ${x.label > 0 ? "+1" : x.label} | ${x.touch === "up" ? `upper barrier ${x.up.toFixed(4)} reached at step ${x.exitStep}` : x.touch === "down" ? `lower barrier ${x.dn.toFixed(4)} reached at step ${x.exitStep}` : `no barrier touched in ${x.exitStep} steps`} |`), ""].join("\n");
}

function chunk<T>(a: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n));
  return r;
}
