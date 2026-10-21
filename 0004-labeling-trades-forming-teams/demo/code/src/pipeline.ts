// The whole labeling pipeline as one pure function: path -> triple-barrier labels -> pretend agent -> checker -> overlap -> gate.
// demo.ts prints it and writes out/*.json; the tests call it directly.
import { DEFAULT_AGENT, decide, truthAt, type AgentParams, type Decision } from "./agent.ts";
import { checkReason } from "./explain.ts";
import { DEFAULT_PARAMS, tripleBarrier, type Label, type LabelParams } from "./labels.ts";
import { FEATURES, featuresOf, fit, predict, round, tally, type Model, type Row } from "./meta.ts";
import { leaking, overlapStats } from "./overlap.ts";
import type { PathResult } from "./path.ts";

export interface Options {
  labels: LabelParams;
  agent: AgentParams;
  trainFrac: number;
}
export const DEFAULT_OPTIONS: Options = { labels: DEFAULT_PARAMS, agent: DEFAULT_AGENT, trainFrac: 0.6 };

/** Round-trip trading cost assumed when we ask "would this win survive fees": 2 x the 0.04% Orca pool fee. Ignores slippage and network fees. */
export const ROUND_TRIP_COST_BPS = 8;

export function runPipeline(path: PathResult, opts: Options, crossPrices: Record<string, number[]> = {}) {
  const prices = path.points.map((p) => p.price);
  const times = path.points.map((p) => p.t);
  const others = path.points.map((p) => p.other);
  const N = prices.length;

  // 1. labels
  const { vol, labels, dropped } = tripleBarrier(prices, times, opts.labels);
  if (labels.length < 10) throw new Error(`only ${labels.length} labels: too few for this data and these settings (horizon ${opts.labels.horizon})`);
  const count = (touch: Label["touch"]) => labels.filter((l) => l.touch === touch).length;
  const fixedDisagree = labels.filter((l) => l.fixed !== l.label).length;
  const labelStats: Record<string, number | null | object> = {
    steps: N, decisions: labels.length, droppedAtEnd: dropped,
    up: count("up"), down: count("down"), time: count("time"),
    meanHoldSteps: round(labels.reduce((a, l) => a + (l.exitI - l.i), 0) / labels.length, 2),
    meanWidthBps: round(labels.reduce((a, l) => a + l.widthBps, 0) / labels.length, 2),
    fixedDisagree, fixedDisagreePct: round((100 * fixedDisagree) / labels.length, 1),
  };
  const crossCheck: { against: string; n: number; agreePct: number }[] = [];
  for (const [name, cp] of Object.entries(crossPrices)) {
    const cross = tripleBarrier(cp, times, opts.labels).labels;
    const byI = new Map(cross.map((l) => [l.i, l.label]));
    const both = labels.filter((l) => byI.has(l.i));
    crossCheck.push({ against: name, n: both.length, agreePct: round((100 * both.filter((l) => byI.get(l.i) === l.label).length) / Math.max(1, both.length), 1) });
  }
  labelStats["crossCheck"] = crossCheck;

  // 2. agent decisions and the explanation checker
  const decisions: (Decision & { check: { ok: boolean; problems: string[] } })[] = [];
  for (const l of labels) {
    const d = decide(prices, times, others, vol, l, opts.agent, path.stepSec);
    if (!d) continue;
    const truth = truthAt(prices, others, vol, l.i, opts.agent.lookback)!;
    const c = checkReason(d.reason, truth);
    decisions.push({ ...d, check: { ok: c.ok, problems: c.problems } });
  }
  const trades = decisions.filter((d) => d.side !== 0);
  const labelAtI = new Map(labels.map((l) => [l.i, l]));
  const flagged = decisions.filter((d) => !d.check.ok);
  const inj = decisions.filter((d) => d.injected !== "none");
  const okTrades = trades.filter((d) => d.check.ok);
  const badTrades = trades.filter((d) => !d.check.ok);
  const wr = (a: typeof trades) => (a.length ? round((100 * a.filter((d) => d.outcome === "win").length) / a.length, 1) : null);
  const agentStats = {
    decisions: decisions.length, holds: decisions.length - trades.length, trades: trades.length,
    wins: trades.filter((d) => d.outcome === "win").length, losses: trades.filter((d) => d.outcome === "loss").length, timeouts: trades.filter((d) => d.outcome === "timeout").length,
    hitRatePct: wr(trades),
    injected: inj.length, flagged: flagged.length,
    caught: inj.filter((d) => !d.check.ok).length, missed: inj.filter((d) => d.check.ok).length, falseAlarms: flagged.filter((d) => d.injected === "none").length,
    reasonsOkTrades: okTrades.length, reasonsBadTrades: badTrades.length,
    hitRateWhenReasonOkPct: wr(okTrades), hitRateWhenReasonBadPct: wr(badTrades),
    roundTripCostBps: ROUND_TRIP_COST_BPS,
    winsThatCoverCost: trades.filter((d) => d.outcome === "win" && labelAtI.get(d.i)!.widthBps >= ROUND_TRIP_COST_BPS).length,
  };

  // 3. overlap and leakage (over ALL labels, the agent's holds included: labels exist for every decision point)
  const ov = overlapStats(labels, N);
  const cutStep = labels[Math.floor(opts.trainFrac * labels.length)]!.i;
  const leakCurve = Array.from({ length: N }, (_, c) => leaking(labels, c));

  // 4. the gate (trades only)
  const labelAt = new Map(labels.map((l) => [l.i, l]));
  const tradeLabels = trades.map((d) => labelAt.get(d.i)!);
  const rawRows = trades.map((d, k) => ({ d, l: tradeLabels[k]! }));
  const train = rawRows.filter(({ l }) => l.i < cutStep);
  const test = rawRows.filter(({ l }) => l.i >= cutStep);
  const trainClean = train.filter(({ l }) => l.exitI < cutStep);
  const X = (a: typeof rawRows) => a.map(({ d, l }) => featuresOf(d, l));
  const Y = (a: typeof rawRows) => a.map(({ d }) => (d.outcome === "win" ? 1 : 0));
  const model: Model = fit(X(trainClean), Y(trainClean));
  const naive: Model = fit(X(train), Y(train));
  const baseRate = trainClean.length ? trainClean.reduce((a, { d }) => a + (d.outcome === "win" ? 1 : 0), 0) / trainClean.length : 0.5;
  const toRow = (r: { d: Decision; l: Label }, m: Model, set: Row["set"]): Row => {
    const x = featuresOf(r.d, r.l);
    return { i: r.d.i, side: r.d.side as 1 | -1, win: r.d.outcome === "win" ? 1 : 0, x: x.map((v) => round(v, 4)), p: round(predict(m, x), 4), set };
  };
  const rows: Row[] = rawRows.map((r) => (r.l.i >= cutStep ? toRow(r, model, "test") : r.l.exitI >= cutStep ? toRow(r, model, "purged") : toRow(r, model, "train")));
  const testRows = rows.filter((r) => r.set === "test");
  const thr = round(baseRate, 4);
  const acted = testRows.filter((r) => r.p >= thr);
  const blocked = testRows.filter((r) => r.p < thr);
  const naiveActed = test.filter((r) => predict(naive, featuresOf(r.d, r.l)) >= thr);
  const naiveTally = tally(naiveActed.map((r) => ({ win: r.d.outcome === "win" ? 1 : 0 }) as Row));
  const meta = {
    features: [...FEATURES],
    split: { cutStep, trainFrac: opts.trainFrac, trainTrades: trainClean.length, purgedTrades: train.length - trainClean.length, testTrades: test.length },
    model: { mean: model.mean.map((v) => round(v, 6)), std: model.std.map((v) => round(v, 6)), w: model.w.map((v) => round(v, 6)), b: round(model.b, 6) },
    defaultThreshold: thr,
    thresholdNote: "the win rate of the training trades: act only when the gate thinks the odds beat the average trade",
    rows,
    stats: {
      trainBaseRatePct: round(100 * baseRate, 1),
      testNoGate: tally(testRows),
      testWithGate: tally(acted),
      blocked: { trades: blocked.length, wouldHaveWon: blocked.reduce((a, r) => a + r.win, 0) },
      testWithGateNaiveSplit: naiveTally,
      note: "small samples: compare hit rates only together with the +/- column",
    },
  };

  return {
    labels: { vol: vol.map((v) => (v === null ? null : round(v, 4))), labels, stats: labelStats },
    agent: { decisions, stats: agentStats },
    overlap: { conc: ov.conc, uniq: ov.uniq.map((u) => round(u, 4)), stats: ov.stats, leak: { cutStep, leaking: leaking(labels, cutStep), curve: leakCurve } },
    meta,
  };
}
