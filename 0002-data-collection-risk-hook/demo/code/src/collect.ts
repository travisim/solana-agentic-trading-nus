// Presenter tool: record real data from all three venues every N seconds.
//   node src/collect.ts --minutes 35 --interval 5
// Writes recorded/series.json (grows as it runs) and recorded/snapshot.json (latest full sample).
// Students do not need this: the repo already ships real recorded data.
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { jupiterQuote } from "./collectors/jupiter.ts";
import { pythOnChain } from "./collectors/pyth.ts";
import { orcaPool } from "./collectors/orca.ts";
import { buildPrices } from "./collectors/index.ts";
import { RateLimitError } from "./rpc.ts";
import type { Series, SeriesPoint } from "./types.ts";

const arg = (name: string, dflt: number): number => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : dflt;
};
const minutes = arg("minutes", 35);
const intervalSec = arg("interval", 5);
const dir = new URL("../recorded/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const save = (name: string, data: unknown) => {
  const tmp = `${dir}${name}.tmp`;
  writeFileSync(tmp, JSON.stringify(data) + "\n");
  renameSync(tmp, `${dir}${name}`);
};

const points: SeriesPoint[] = [];
const started = Date.now();
let failures = 0;
let backoffUntil = 0;
console.log(`recording ${minutes} min every ${intervalSec}s -> ${dir}`);

for (let tick = 0; Date.now() - started < minutes * 60_000; tick++) {
  const due = started + tick * intervalSec * 1000;
  await new Promise((r) => setTimeout(r, Math.max(0, due - Date.now())));
  if (Date.now() < backoffUntil) continue;
  const t = Math.floor(Date.now() / 1000);
  try {
    const venues = await Promise.all([jupiterQuote(), pythOnChain(), orcaPool()]);
    const [j, p, o] = venues as [typeof venues[0], typeof venues[1], typeof venues[2]];
    points.push({ t, jupiter: round(j.price), pyth: round(p.price), orca: round(o.price) });
    if (points.length % 6 === 1) {
      save("snapshot.json", buildPrices(venues, "recorded", new Date(t * 1000).toISOString()));
      save("series.json", { pair: "SOL/USDC", intervalSec, points } satisfies Series);
      console.log(`${new Date().toISOString()} points=${points.length} failures=${failures}`);
    }
  } catch (e) {
    failures++;
    console.log(`${new Date().toISOString()} skip: ${(e as Error).message}`);
    if (e instanceof RateLimitError) backoffUntil = Date.now() + 30_000;
  }
}
save("series.json", { pair: "SOL/USDC", intervalSec, points } satisfies Series);
console.log(`done: ${points.length} points, ${failures} failed ticks`);

function round(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}
