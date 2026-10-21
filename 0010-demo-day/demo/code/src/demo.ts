// npm run demo                -> recorded (default): bundled real network and devnet reads, no network needed
// npm run demo -- --live      -> presenter option: reads the current mainnet slot and checks signatures on devnet (read only)
// Options: --projects FILE   --out DIR   --ship-dir DIR (also run the ship check on your own project)
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildGallery, renderGalleryHtml } from "./gallery.ts";
import { rubricJson } from "./rubric.ts";
import { buildSchedule } from "./schedule.ts";
import { CHECKS, checkShip, printReport } from "./ship.ts";
import { DEVNET_RPC, MAINNET_RPC, getSignatureStatuses, getSlot } from "./solana.ts";
import type { NetworkInfo, ProjectsFile, SigCheck } from "./types.ts";
import { validateProjects } from "./validate.ts";

const root = new URL("../", import.meta.url).pathname;
const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const projectsPath = flag("projects") ?? `${root}projects.json`;
const outDir = (flag("out") ?? `${root}out/`).replace(/\/?$/, "/");
const live = process.argv.includes("--live");
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const wr = (name: string, data: unknown) => writeFileSync(outDir + name, typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");

// ---- 1. validate projects.json -------------------------------------------------------------
let file: ProjectsFile;
try {
  file = readJson<ProjectsFile>(projectsPath);
} catch (e) {
  console.error(`Could not read ${projectsPath}: ${(e as Error).message}`);
  process.exit(1);
}
const v = validateProjects(file);
console.log(`1. projects.json: ${v.counts.projects} projects (agent ${v.counts.agent}, exchange ${v.counts.exchange}, tooling ${v.counts.tooling}), ${v.errors.length} errors, ${v.warnings.length} warnings`);
for (const e of v.errors) console.log(`   ERROR   ${e.id} / ${e.field}: ${e.message}`);
for (const w of v.warnings.slice(0, 8)) console.log(`   warning ${w.id} / ${w.field}: ${w.message}`);
mkdirSync(outDir, { recursive: true });
wr("validation.json", v);
if (!v.ok) {
  console.error("Fix the errors above and run again. Nothing else was written.");
  process.exit(1);
}

// ---- 2. network pulse and devnet signature checks: recorded (default) or live ---------------
let network = readJson<NetworkInfo>(`${root}recorded/network.json`);
const recChecks = readJson<{ checks: SigCheck[] }>(`${root}recorded/signature-checks.json`).checks;
let checks = new Map<string, SigCheck>(recChecks.map((c) => [c.signature, c]));
let mode: "recorded" | "live" = "recorded";
if (live) {
  try {
    console.log(`2. live: reading the mainnet slot from ${new URL(MAINNET_RPC).host} and signatures from ${new URL(DEVNET_RPC).host} (read only)...`);
    const a = await getSlot();
    const ta = Date.now();
    await new Promise((r) => setTimeout(r, 4000));
    const b = await getSlot();
    const tb = Date.now();
    const sigs = file.projects.flatMap((p) => (p.devnetSignature ? [p.devnetSignature] : []));
    const fresh = await getSignatureStatuses(sigs);
    network = { cluster: "mainnet-beta", slot: b, capturedAt: new Date(tb).toISOString(), slotsPerSecond: Math.round(((b - a) / ((tb - ta) / 1000)) * 100) / 100, source: `getSlot twice from ${new URL(MAINNET_RPC).host}`, mode: "live" };
    checks = new Map(fresh.map((c) => [c.signature, c]));
    mode = "live";
  } catch (e) {
    console.log(`   live read failed (${(e as Error).message}). Using the recorded data instead.`);
  }
}
if (mode === "recorded") console.log(`2. recorded: mainnet slot ${network.slot} and ${recChecks.length} devnet signature checks captured ${network.capturedAt}`);
else console.log(`2. live: mainnet slot ${network.slot} (about ${network.slotsPerSecond} slots/s), ${checks.size} signature checks`);

// ---- 3. gallery -----------------------------------------------------------------------------
const gallery = buildGallery(file, checks, network, mode);
wr("gallery.json", gallery);
wr("gallery.html", renderGalleryHtml(gallery));
console.log(`3. gallery: ${gallery.projects.length} cards -> out/gallery.json and out/gallery.html`);
for (const p of gallery.projects) console.log(`   [${p.lane.padEnd(8)}] ${p.name}  | tests: ${p.evidence.tests} | devnet: ${p.evidence.devnet}`);

// ---- 4. schedule and rubric -----------------------------------------------------------------
const schedule = buildSchedule({ order: file.projects.map((p) => p.id) });
wr("schedule.json", schedule);
wr("rubric.json", rubricJson());
console.log(`4. schedule: ${schedule.slots.length} slots of ${schedule.demoMin}+${schedule.qaMin} min, ${schedule.window}${schedule.overflow ? `, ${schedule.overflow} project(s) do not fit` : ""}; rubric ${rubricJson().criteria.map((c) => `${c.label} ${c.weight}`).join(", ")} (returns: not scored)`);

// ---- 5. ship-readiness check on two example repos (+ yours with --ship-dir) ----------------
const tmp = mkdtempSync(join(tmpdir(), "demo-day-ship-"));
try {
  cpSync(`${root}recorded/ship-fixtures/ready`, join(tmp, "ready-example"), { recursive: true });
  cpSync(`${root}recorded/ship-fixtures/gaps`, join(tmp, "gaps-example"), { recursive: true });
  // The gaps example also "leaks" a keypair-shaped file (64 zeros, not a real key), created only here in a temp folder.
  writeFileSync(join(tmp, "gaps-example", "id.json"), JSON.stringify(new Array(64).fill(0)));
  const reports = [checkShip(join(tmp, "ready-example"), "ready-example"), checkShip(join(tmp, "gaps-example"), "gaps-example")];
  const mine = flag("ship-dir");
  const extra = mine ? [checkShip(mine)] : [];
  wr("ship.json", { checks: CHECKS.map(({ id, label, level, hint }) => ({ id, label, level, hint })), repos: reports });
  console.log("5. ship-readiness check");
  for (const r of [...reports, ...extra]) console.log(`   ${r.name}: ${r.ready ? "READY" : "NOT READY"} (${r.passed}/${r.total} checks, ${r.requiredPassed}/${r.requiredTotal} required)`);
  if (extra[0]) printReport(extra[0]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`\nDone (${mode}). Wrote ${outDir}: validation.json gallery.json gallery.html schedule.json rubric.json ship.json`);
console.log("Reads use public mainnet data; every write is devnet only; no real funds. Nothing here sends a transaction.");
