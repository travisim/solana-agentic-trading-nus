// Presenter tool: record real data. Students do not need this: the repo already ships real recorded data.
//   node src/collect.ts pyth  --minutes 25 --interval 5      -> recorded/pyth-reads.json
//   node src/collect.ts swaps --count 1500 [--before SIG]    -> recorded/swaps.json (see swaps.ts)
// Both write the file after every few steps (atomic rename), so a stopped run still leaves valid real data.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readPyth } from "./pyth.ts";
import { RateLimitError, sleep } from "./rpc.ts";
import { collectSwaps } from "./swaps.ts";
import type { PythReads, RawSwapFile } from "./types.ts";

const mode = process.argv[2];
const arg = (name: string, dflt: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const strArg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const dir = new URL("../recorded/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const save = (name: string, data: unknown) => {
  const tmp = `${dir}${name}.tmp`;
  writeFileSync(tmp, JSON.stringify(data) + "\n");
  renameSync(tmp, `${dir}${name}`);
};

if (mode === "pyth") {
  const minutes = arg("minutes", 25);
  const intervalSec = arg("interval", 5);
  const reads: PythReads["reads"] = [];
  const started = Date.now();
  let failures = 0;
  console.log(`recording Pyth SOL/USD every ${intervalSec}s for ${minutes} min -> ${dir}pyth-reads.json`);
  for (let tick = 0; Date.now() - started < minutes * 60_000; tick++) {
    const due = started + tick * intervalSec * 1000;
    await sleep(Math.max(0, due - Date.now()));
    const t = Math.floor(Date.now() / 1000);
    try {
      const p = await readPyth();
      reads.push({ t, price: p.price, confBps: Math.round(p.confBps * 100) / 100, publishTime: p.publishTime, postedSlot: p.postedSlot, currentSlot: p.currentSlot });
    } catch (e) {
      failures++;
      console.log(`${new Date().toISOString()} skip: ${(e as Error).message}`);
      if (e instanceof RateLimitError) await sleep(20_000);
    }
    if (tick % 6 === 0) {
      save("pyth-reads.json", { pair: "SOL/USD", intervalSec, account: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE", failures, reads } satisfies PythReads);
      console.log(`${new Date().toISOString()} reads=${reads.length} failures=${failures}`);
    }
  }
  save("pyth-reads.json", { pair: "SOL/USD", intervalSec, account: "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE", failures, reads } satisfies PythReads);
  console.log(`done: ${reads.length} reads, ${failures} failed ticks`);
} else if (mode === "swaps") {
  const count = arg("count", 1500);
  const before = strArg("before");
  // --append: continue further back in time from the oldest swap already in recorded/swaps.json and merge (same pool, contiguous window).
  const prev: RawSwapFile | null = process.argv.includes("--append") && existsSync(`${dir}swaps.json`) ? (JSON.parse(readFileSync(`${dir}swaps.json`, "utf8")) as RawSwapFile) : null;
  const merge = (r: RawSwapFile): RawSwapFile => {
    if (!prev) return r;
    const swaps = [...r.swaps, ...prev.swaps].sort((a, b) => a.t - b.t || a.slot - b.slot);
    const sc = (k: "listed" | "failedTx" | "notSwaps") => (r.scanned?.[k] ?? 0) + (prev.scanned?.[k] ?? 0);
    return { ...r, swaps, scanned: { listed: sc("listed"), failedTx: sc("failedTx"), notSwaps: sc("notSwaps") } };
  };
  const toFile = (r: RawSwapFile) => ({ ...merge(r), mode: "recorded" as const });
  const start = before ?? prev?.swaps[0]?.sig;
  const out: RawSwapFile = await collectSwaps({
    count,
    ...(start ? { before: start } : {}),
    onProgress: (partial) => save("swaps.json", toFile(partial)),
  });
  save("swaps.json", toFile(out));
  const all = merge(out).swaps;
  console.log(`done: ${all.length} swaps from ${all[0]?.t} to ${all.at(-1)?.t}`);
} else {
  console.log("usage: node src/collect.ts pyth [--minutes 25] [--interval 5]\n       node src/collect.ts swaps [--count 1500] [--before SIGNATURE]");
  process.exit(1);
}
