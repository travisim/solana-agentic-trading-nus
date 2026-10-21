// Presenter option (--live): one fresh Pyth SOL/USD read over public mainnet RPC (owner and feed id are checked).
import { readPyth } from "./pyth.ts";

export async function readPythOnce(): Promise<{ price: number; ageSec: number; currentSlot: number; postedSlot: number }> {
  const p = await readPyth();
  return { price: p.price, ageSec: Math.max(0, Math.floor(Date.now() / 1000) - p.publishTime), currentSlot: p.currentSlot, postedSlot: p.postedSlot };
}
