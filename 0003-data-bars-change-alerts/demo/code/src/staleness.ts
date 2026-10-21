// Staleness check: is this oracle price still fresh?
// A Pyth price comes with a publish time (seconds) and the slot it was posted at. Compare them with "now":
//   ageSec       = now - publishTime            (seconds the price has been sitting there)
//   slotsBehind  = currentSlot - postedSlot     (chain slots since it was posted; one slot is about 0.4 s)
// If either is over its limit the price is stale and an agent must not trade on it.
import type { PythReads } from "./types.ts";

export interface StalenessLimits { maxAgeSec: number; maxSlotsBehind: number }
export interface StalenessPoint {
  t: number;
  currentSlot: number;
  postedSlot: number;
  publishTime: number;
  ageSec: number;
  slotsBehind: number;
  ok: boolean;
  /** true on points produced by the simulated frozen-feed fault (the time and slot columns are real, the frozen values are repeated). */
  simulated: boolean;
}

/** The check itself. Pure: a few comparisons. */
export function isFresh(ageSec: number, slotsBehind: number, limits: StalenessLimits): boolean {
  return ageSec <= limits.maxAgeSec && slotsBehind <= limits.maxSlotsBehind;
}

export interface BuildOptions extends StalenessLimits {
  /** Fraction (0..1) of the series after which the simulated frozen-feed fault starts. Default 0.6. */
  faultAtFraction?: number;
}

export interface StalenessFile {
  maxAgeSec: number;
  maxSlotsBehind: number;
  source: string;
  points: StalenessPoint[];
  injectedFault: { startT: number; kind: string; simulated: true; note: string };
  stats: { points: number; realPoints: number; simulatedPoints: number; realStaleCount: number; maxRealAgeSec: number; maxRealSlotsBehind: number; firstStaleDetectedAfterFaultSec: number | null };
}

export const FAULT_KIND = "frozen feed (simulated by repeating the last value)";

export function buildStaleness(reads: PythReads["reads"], opts: BuildOptions): StalenessFile {
  if (reads.length < 3) throw new Error("need at least 3 Pyth reads");
  const faultIdx = Math.max(1, Math.min(reads.length - 1, Math.floor(reads.length * (opts.faultAtFraction ?? 0.6))));
  const frozen = reads[faultIdx - 1]!; // last real read before the fault
  const points: StalenessPoint[] = reads.map((r, i) => {
    const simulated = i >= faultIdx;
    const publishTime = simulated ? frozen.publishTime : r.publishTime;
    const postedSlot = simulated ? frozen.postedSlot : r.postedSlot;
    const ageSec = Math.max(0, r.t - publishTime);
    const slotsBehind = Math.max(0, r.currentSlot - postedSlot);
    return { t: r.t, currentSlot: r.currentSlot, postedSlot, publishTime, ageSec, slotsBehind, ok: isFresh(ageSec, slotsBehind, opts), simulated };
  });
  const real = points.filter((p) => !p.simulated);
  const startT = reads[faultIdx]!.t;
  const firstStale = points.find((p) => p.simulated && !p.ok);
  return {
    maxAgeSec: opts.maxAgeSec,
    maxSlotsBehind: opts.maxSlotsBehind,
    source: "real Pyth SOL/USD PriceUpdateV2 reads over public RPC; points with simulated=true are the frozen-feed fault",
    points,
    injectedFault: {
      startT,
      kind: FAULT_KIND,
      simulated: true,
      note: "SIMULATED on top of real data: from startT the publishTime and postedSlot are repeated from the last real read; t and currentSlot stay real. Nothing in the real feed froze.",
    },
    stats: {
      points: points.length,
      realPoints: real.length,
      simulatedPoints: points.length - real.length,
      realStaleCount: real.filter((p) => !p.ok).length,
      maxRealAgeSec: Math.max(...real.map((p) => p.ageSec)),
      maxRealSlotsBehind: Math.max(...real.map((p) => p.slotsBehind)),
      firstStaleDetectedAfterFaultSec: firstStale ? firstStale.t - startT : null,
    },
  };
}
