// Dashboard template: turns the scorecard numbers into ONE static HTML page (out/dashboard.html).
// Open it from disk. Copy this file, change the cards, keep the honesty line at the bottom.
import type { EquityCurve, Score } from "./scorecard.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const usd = (x: number | null) => (x === null ? "n/a" : `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`);
const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);
const num = (x: number | null, d = 2) => (x === null ? "n/a" : x.toFixed(d));

function chart(eq: EquityCurve, capital: number): string {
  const W = 900, H = 260, pad = 30;
  const lo = Math.min(...eq.equity, capital), hi = Math.max(...eq.equity, capital);
  const span = hi - lo || 1;
  const x = (i: number) => pad + ((W - 2 * pad) * i) / Math.max(1, eq.equity.length - 1);
  const y = (v: number) => H - pad - ((H - 2 * pad) * (v - lo)) / span;
  const line = eq.equity.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  // shade the gap between the running peak and the equity: that is the drawdown
  let peak = capital;
  const peaks = eq.equity.map((v) => (peak = Math.max(peak, v)));
  const area = `${peaks.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} ${eq.equity.map((_, k) => { const i = eq.equity.length - 1 - k; return `L${x(i).toFixed(1)},${y(eq.equity[i]!).toFixed(1)}`; }).join(" ")} Z`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Equity curve with drawdown shaded"><path d="${area}" fill="#ff7a85" fill-opacity=".35"/><line x1="${pad}" x2="${W - pad}" y1="${y(capital)}" y2="${y(capital)}" stroke="#4a4670" stroke-dasharray="4 4"/><path d="${line}" fill="none" stroke="#3ddc97" stroke-width="2.5"/></svg>`;
}

export function dashboardHtml(title: string, s: Score, eq: EquityCurve, capital: number, costs: { feeBps: number; slippageBps: number }, note: string): string {
  const cards: [string, string, string][] = [
    ["Net P&L (USD)", usd(s.netUsd), `gross ${usd(s.grossUsd)}, costs -${s.costsUsd.toFixed(2)}`],
    ["Hit rate", pct(s.hitRate), `break-even ${pct(s.breakEvenHitRate)}`],
    ["Average win / loss (USD)", `${usd(s.avgWinUsd)} / ${usd(s.avgLossUsd)}`, `payoff ratio ${num(s.payoffRatio)}`],
    ["Max drawdown (USD)", `-${s.maxDrawdownUsd.toFixed(2)}`, `${s.maxDrawdownPct.toFixed(2)}% of peak equity`],
    ["Time under water", pct(s.timeUnderwaterShare), `longest stretch ${Math.round(s.longestUnderwaterSec / 60)} min`],
    ["Turnover", `${num(s.turnoverX)}x capital`, `${s.tradedUsd.toFixed(0)} USD traded`],
    ["Trades", String(s.trades), s.enoughTrades ? "enough to read" : "FEW TRADES: read with care"],
    ["Chance the true hit rate is below break-even", pct(s.probFailure), "normal approximation"],
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;background:#000;color:#f4f4f6;font:300 16px "Helvetica Neue",Helvetica,Arial,sans-serif}main{max-width:1000px;margin:0 auto;padding:24px}h1{font-weight:300;font-size:32px;margin:0 0 4px}
.sub{color:#b3a5ff}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:20px 0}.c{border:1.5px solid #4a4670;border-radius:14px;padding:12px 16px}
.c b{display:block;font-weight:300;font-size:26px;color:#3ddc97}.c span{color:#9a9aa2;font-size:13px}.c i{display:block;color:#b3a5ff;font-style:normal;font-size:14px}svg{width:100%;height:auto}footer{color:#9a9aa2;font-size:13px;margin-top:20px}</style></head>
<body><main><h1>${esc(title)}</h1><div class="sub">Costs: ${costs.feeBps} bps fee + ${costs.slippageBps} bps slippage per leg. Starting capital ${capital} USD.</div>
<div class="grid">${cards.map(([a, b, c]) => `<div class="c"><i>${esc(a)}</i><b>${esc(b)}</b><span>${esc(c)}</span></div>`).join("")}</div>
${chart(eq, capital)}<div class="sub">Equity (green), drawdown shaded (red). Dashed line = starting capital.</div>
<footer>${esc(note)} Simulated, on recorded data; not advice. Past numbers do not predict future ones.</footer></main></body></html>
`;
}
