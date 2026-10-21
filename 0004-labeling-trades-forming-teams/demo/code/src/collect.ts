// Presenter tool: record real prices from Jupiter, Pyth and Orca every N seconds.
//   node src/collect.ts --minutes 10 --interval 5            -> recorded/series-live.json
// Students do not need this: the repo already ships real recorded data (recorded/series.json, captured in build night 1).
// Reads only, public data, no keys. Same method as build night 1's collector (0002 src/collect.ts).
import { mkdirSync, writeFileSync } from "node:fs";
import { jupiterQuote } from "./jupiter.ts";
import { readOrcaPrice } from "./orca.ts";
import { readPyth } from "./pyth.ts";
import { RateLimitError, sleep } from "./rpc.ts";
import type { Series, SeriesPoint } from "./types.ts";

const round = (x: number) => Math.round(x * 10_000) / 10_000;

/** Record `minutes` of 3-venue samples. Failed ticks are skipped and counted; a 429 pauses for 30 s. Throws if nothing was read. */
export async function collectSeries(minutes: number, intervalSec: number, log = true): Promise<{ series: Series; failures: number }> {
  const points: SeriesPoint[] = [];
  const started = Date.now();
  let failures = 0;
  let pauseUntil = 0;
  for (let tick = 0; Date.now() - started < minutes * 60_000; tick++) {
    await sleep(Math.max(0, started + tick * intervalSec * 1000 - Date.now()));
    if (Date.now() < pauseUntil) continue;
    const t = Math.floor(Date.now() / 1000);
    try {
      const [j, p, o] = await Promise.all([jupiterQuote(), readPyth(), readOrcaPrice()]);
      points.push({ t, jupiter: round(j.price), pyth: round(p.price), orca: round(o) });
      if (log && points.length % 6 === 1) console.log(`${new Date().toISOString()} points=${points.length} failures=${failures}`);
    } catch (e) {
      failures++;
      if (log) console.log(`${new Date().toISOString()} skip: ${(e as Error).message}`);
      if (e instanceof RateLimitError) pauseUntil = Date.now() + 30_000;
    }
  }
  if (points.length === 0) throw new Error("no samples could be read (offline or rate limited); use --recorded");
  return { series: { pair: "SOL/USDC", intervalSec, points }, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (n: string, d: number) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? Number(process.argv[i + 1]) : d; };
  const { series, failures } = await collectSeries(arg("minutes", 10), arg("interval", 5));
  const dir = new URL("../recorded/", import.meta.url).pathname;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}series-live.json`, JSON.stringify(series) + "\n");
  console.log(`done: ${series.points.length} points, ${failures} failed ticks -> recorded/series-live.json`);
}
