// Order-book and trade-flow measures. Spread, depth, imbalance and order flow imbalance are standard market-microstructure
// measures. The tick rule and the Roll estimate are classic trade-based estimators. No dependencies.
export interface Level {
  price: number;
  size: number; // base units
}

export interface TopOfBook {
  bestBid: number | null;
  bestAsk: number | null;
  bidSize: number;
  askSize: number;
  mid: number | null;
  spread: number | null;
  spreadBps: number | null;
  crossed: boolean;
}

export function topOfBook(bids: Level[], asks: Level[]): TopOfBook {
  const b = bids[0];
  const a = asks[0];
  const both = b && a;
  const mid = both ? (b.price + a.price) / 2 : null;
  const spread = both ? a.price - b.price : null;
  return {
    bestBid: b?.price ?? null,
    bestAsk: a?.price ?? null,
    bidSize: b?.size ?? 0,
    askSize: a?.size ?? 0,
    mid,
    spread,
    spreadBps: spread !== null && mid ? (spread / mid) * 1e4 : null,
    crossed: both ? b.price >= a.price : false,
  };
}

/** Size (base units) resting within `bps` of `ref` on one side. */
export function depthWithin(levels: Level[], side: "bid" | "ask", ref: number, bps: number): number {
  const lim = ref * (bps / 1e4);
  return levels.reduce((s, l) => s + (side === "bid" ? (l.price >= ref - lim ? l.size : 0) : l.price <= ref + lim ? l.size : 0), 0);
}

/** Book imbalance (bid - ask) / (bid + ask), from -1 (all asks) to +1 (all bids). Null when both are empty. */
export function imbalance(bidDepth: number, askDepth: number): number | null {
  const t = bidDepth + askDepth;
  return t > 0 ? (bidDepth - askDepth) / t : null;
}

/** Size-weighted price between the best bid and ask: leans toward the side with less size. */
export function microprice(t: TopOfBook): number | null {
  if (t.bestBid === null || t.bestAsk === null || t.bidSize + t.askSize === 0) return null;
  return (t.bestBid * t.askSize + t.bestAsk * t.bidSize) / (t.bidSize + t.askSize);
}

/**
 * Order flow imbalance between two snapshots of the best bid and ask (Cont, Kukanov, Stoikov 2014):
 * positive when buying pressure rose (bid got bigger or higher, ask got smaller or higher up the ladder is removed).
 */
export function ofiStep(prev: TopOfBook, cur: TopOfBook): number | null {
  if (prev.bestBid === null || prev.bestAsk === null || cur.bestBid === null || cur.bestAsk === null) return null;
  const bidPart = (cur.bestBid >= prev.bestBid ? cur.bidSize : 0) - (cur.bestBid <= prev.bestBid ? prev.bidSize : 0);
  const askPart = (cur.bestAsk <= prev.bestAsk ? cur.askSize : 0) - (cur.bestAsk >= prev.bestAsk ? prev.askSize : 0);
  return bidPart - askPart;
}

export interface Walk {
  filled: number;
  cost: number; // quote units spent (buy) or received (sell)
  vwap: number | null;
  slippageBps: number | null; // versus the best price on that side
  levelsUsed: number;
  complete: boolean;
}
/** Walk the book with a market order of `qty` base units. `levels` is the opposite side, best first. */
export function walkBook(levels: Level[], qty: number, side: "buy" | "sell"): Walk {
  let left = qty;
  let cost = 0;
  let used = 0;
  for (const l of levels) {
    if (left <= 0) break;
    const take = Math.min(left, l.size);
    cost += take * l.price;
    left -= take;
    used++;
  }
  const filled = qty - left;
  const vwap = filled > 0 ? cost / filled : null;
  const best = levels[0]?.price;
  const slip = vwap !== null && best ? ((side === "buy" ? vwap / best - 1 : 1 - vwap / best) * 1e4) : null;
  return { filled, cost, vwap, slippageBps: slip, levelsUsed: used, complete: left <= 1e-12 };
}

export interface Trade {
  t: number;
  price: number;
  size: number; // base units
  side?: "buy" | "sell"; // as reported (aggressor), when known
}

/** Signed volume imbalance of a window of trades: (buy - sell) / (buy + sell). */
export function tradeImbalance(trades: Trade[]): { buy: number; sell: number; imbalance: number | null } {
  let buy = 0;
  let sell = 0;
  for (const x of trades) {
    if (x.side === "buy") buy += x.size;
    else if (x.side === "sell") sell += x.size;
  }
  return { buy, sell, imbalance: buy + sell > 0 ? (buy - sell) / (buy + sell) : null };
}

/** Tick rule: +1 if the price rose since the last different price, -1 if it fell, otherwise the previous sign. First trade: 0. */
export function tickRule(prices: number[]): number[] {
  const out: number[] = [];
  let last = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i > 0) {
      if (prices[i]! > prices[i - 1]!) last = 1;
      else if (prices[i]! < prices[i - 1]!) last = -1;
    }
    out.push(last);
  }
  return out;
}

/** Share of trades where the tick rule agrees with the reported side. Trades with sign 0 are skipped. */
export function tickRuleAccuracy(trades: Trade[]): { agree: number; total: number; share: number } {
  const signs = tickRule(trades.map((x) => x.price));
  let agree = 0;
  let total = 0;
  trades.forEach((x, i) => {
    if (!x.side || signs[i] === 0) return;
    total++;
    if ((x.side === "buy" ? 1 : -1) === signs[i]) agree++;
  });
  return { agree, total, share: total ? agree / total : 0 };
}

/** Roll (1984) effective spread estimate from price changes: 2 * sqrt(-cov(dp_t, dp_t-1)); null when the covariance is not negative. */
export function rollSpread(prices: number[]): number | null {
  const d: number[] = [];
  for (let i = 1; i < prices.length; i++) d.push(prices[i]! - prices[i - 1]!);
  if (d.length < 3) return null;
  const a = d.slice(1);
  const b = d.slice(0, -1);
  const ma = a.reduce((s, x) => s + x, 0) / a.length;
  const mb = b.reduce((s, x) => s + x, 0) / b.length;
  let cov = 0;
  for (let i = 0; i < a.length; i++) cov += (a[i]! - ma) * (b[i]! - mb);
  cov /= a.length;
  return cov < 0 ? 2 * Math.sqrt(-cov) : null;
}
