// Price impact: how much worse the price gets as the order gets bigger.
// Built from real Jupiter quotes (recorded/jupiter-impact.json) and used to cap position size.
import type { ImpactQuote, Side } from "./types.ts";

export interface RawQuote {
  side: Side;
  sizeUsd: number;
  q: { inAmount: string; outAmount: string; priceImpactPct: string; routePlan: { swapInfo: { label: string } }[] };
}

/** USDC per token actually quoted: sell = USDC out / token in, buy = USDC in / token out. */
export function execPriceOf(side: Side, inAmount: string, outAmount: string, tokenDecimals: number): number {
  const d = 10 ** tokenDecimals;
  return side === "sell" ? Number(outAmount) / 1e6 / (Number(inAmount) / d) : Number(inAmount) / 1e6 / (Number(outAmount) / d);
}

/** Impact of each quote = Jupiter's own priceImpactPct, converted to basis points (1 % = 100 bps). */
export function buildImpactQuotes(raw: RawQuote[], tokenDecimals: number): ImpactQuote[] {
  const out: ImpactQuote[] = [];
  for (const side of ["sell", "buy"] as const) {
    for (const r of raw.filter((x) => x.side === side).sort((a, b) => a.sizeUsd - b.sizeUsd)) {
      out.push({
        side,
        sizeUsd: r.sizeUsd,
        inAmount: r.q.inAmount,
        outAmount: r.q.outAmount,
        execPrice: Math.round(execPriceOf(side, r.q.inAmount, r.q.outAmount, tokenDecimals) * 1e6) / 1e6,
        impactBps: Math.round(Number(r.q.priceImpactPct) * 100 * 1000) / 1000,
        jupiterImpactPct: r.q.priceImpactPct,
        routes: [...new Set(r.q.routePlan.map((p) => p.swapInfo.label))],
      });
    }
  }
  return out;
}

/** Impact in bps for an order of `sizeUsd`, linear between the real quotes, linear extrapolation beyond the last one. */
export function impactBpsFor(file: { quotes: ImpactQuote[] }, side: Side, sizeUsd: number): number {
  const pts = file.quotes.filter((q) => q.side === side).sort((a, b) => a.sizeUsd - b.sizeUsd);
  if (pts.length < 2 || !(sizeUsd > 0)) return 0;
  if (sizeUsd <= pts[0]!.sizeUsd) return (pts[0]!.impactBps * sizeUsd) / pts[0]!.sizeUsd;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    if (sizeUsd <= b.sizeUsd) return a.impactBps + ((b.impactBps - a.impactBps) * (sizeUsd - a.sizeUsd)) / (b.sizeUsd - a.sizeUsd);
  }
  const a = pts.at(-2)!, b = pts.at(-1)!;
  return Math.max(0, b.impactBps + ((b.impactBps - a.impactBps) * (sizeUsd - b.sizeUsd)) / (b.sizeUsd - a.sizeUsd));
}

/** Largest order (USD) whose impact stays at or under `maxBps`. Searches the interpolated curve. */
export function maxSizeForImpact(file: { quotes: ImpactQuote[] }, side: Side, maxBps: number, limitUsd = 1_000_000): number {
  if (impactBpsFor(file, side, limitUsd) <= maxBps) return limitUsd;
  let lo = 0, hi = limitUsd;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (impactBpsFor(file, side, mid) <= maxBps) lo = mid;
    else hi = mid;
  }
  return lo;
}
