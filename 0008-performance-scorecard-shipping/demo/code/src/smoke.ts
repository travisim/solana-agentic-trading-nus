// npm run smoke   -> the clean-checkout test. Copies this project to a fresh temp folder WITHOUT node_modules or out/,
// then does only what the README says: npm install, npm test, npm run demo -- --recorded. Tells you the first step that breaks.
// Run it before you ask a peer to try your project; then ask the peer to do the same by hand, with your README only.
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

const src = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
const tmp = mkdtempSync(join(tmpdir(), "smoke-"));
const dest = join(tmp, basename(src));
cpSync(src, dest, { recursive: true, filter: (p) => !/(^|\/)(node_modules|out|\.git)(\/|$)/.test(p.slice(src.length)) });
const steps: { cmd: string[]; expect?: string[] }[] = [
  { cmd: ["npm", "install", "--no-audit", "--no-fund"] },
  { cmd: ["npm", "test"] },
  { cmd: ["npm", "run", "demo", "--", "--recorded"], expect: ["out/scorecard.json", "out/ledger.json", "out/dashboard.html"] },
];
// npm run sets npm_* variables for its children; a clean checkout should not inherit them.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.toLowerCase().startsWith("npm_")));
let ok = true;
console.log(`Clean checkout in ${dest}\n`);
for (const s of steps) {
  const t0 = Date.now();
  const r = spawnSync(s.cmd[0]!, s.cmd.slice(1), { cwd: dest, encoding: "utf8", env });
  const missing = (s.expect ?? []).filter((f) => !existsSync(join(dest, f)));
  const pass = r.status === 0 && missing.length === 0;
  console.log(`${pass ? "PASS" : "FAIL"}  ${s.cmd.join(" ")}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!pass) {
    ok = false;
    console.log(missing.length ? `      missing after running: ${missing.join(", ")}` : (r.stdout + r.stderr).split("\n").slice(-15).join("\n"));
    break;
  }
}
rmSync(tmp, { recursive: true, force: true });
console.log(ok ? "\nSMOKE TEST PASSED: a fresh copy installs, tests and runs from the README commands." : "\nSMOKE TEST FAILED: fix the first FAIL above, then run it again.");
process.exit(ok ? 0 : 1);
