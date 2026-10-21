import type { PythRead, Swap } from "../src/types.ts";

/** A constructed swap for tests: [t, price, usdc]. */
export function swapsOf(rows: [number, number, number][]): Swap[] {
  return rows.map(([t, price, usdc], i) => ({ t, slot: 1000 + i, side: i % 2 ? "sell" : "buy", solAmount: usdc / price, usdcAmount: usdc, price, sig: `sig${i}` }));
}

/** Constructed oracle reads, one per `every` seconds, flat price, publishTime = t - age. */
export function readsOf(from: number, to: number, price: number, age = 3, every = 5): PythRead[] {
  const out: PythRead[] = [];
  for (let t = from; t <= to; t += every) out.push({ t, price, confBps: 2, publishTime: t - age, postedSlot: 100 + t, currentSlot: 110 + t });
  return out;
}
