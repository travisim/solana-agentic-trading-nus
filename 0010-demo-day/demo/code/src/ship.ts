// Ship-readiness check: can a stranger clone this folder, run it, and trust what it shows?
// Run:  npm run ship -- --dir ../my-project
// Reads files only. Never runs the project's code, never touches the network.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface ShipCheck {
  id: string;
  label: string;
  level: "required" | "recommended";
  hint: string;
}
export interface ShipResult {
  id: string;
  ok: boolean;
  detail: string;
}
export interface ShipReport {
  name: string;
  ready: boolean;
  passed: number;
  total: number;
  requiredPassed: number;
  requiredTotal: number;
  results: ShipResult[];
}

export const CHECKS: ShipCheck[] = [
  { id: "run", label: "README says how to run it", level: "required", hint: "Add the exact commands, for example npm install then npm run demo." },
  { id: "test-command", label: "A test command exists", level: "required", hint: "Add a test script to package.json (or pytest, cargo test)." },
  { id: "test-files", label: "Test files exist", level: "required", hint: "Add at least one test, ideally one for a failure case." },
  { id: "secrets", label: "No keys or secrets in the folder", level: "required", hint: "Remove keypair files and .env, add them to .gitignore, and rotate anything real." },
  { id: "mainnet-write", label: "No transaction is sent on mainnet", level: "required", hint: "Every write is devnet only. Point sending code at devnet." },
  { id: "devnet-evidence", label: "A devnet signature or link is written down", level: "required", hint: "Put the transaction signature or explorer link in README.md or DEVNET.md." },
  { id: "recorded-backup", label: "A recorded backup of the demo exists", level: "required", hint: "Add a recorded/ folder or a short screen recording in case the network fails." },
  { id: "lockfile", label: "Dependencies are locked", level: "recommended", hint: "Commit package-lock.json (or your tool's lockfile)." },
  { id: "gitignore", label: ".gitignore covers .env and node_modules", level: "recommended", hint: "Add a .gitignore with .env and node_modules/." },
  { id: "limitations", label: "README names a limitation", level: "recommended", hint: "Add a Limitations heading. A clear negative result is valuable." },
  { id: "license", label: "A license file is present", level: "recommended", hint: "Add a LICENSE so others know they may reuse it." },
];

const SKIP = new Set(["node_modules", ".git", "out", "dist", ".next"]);
function walk(root: string, maxDepth = 4, maxFiles = 3000): string[] {
  const files: string[] = [];
  const go = (dir: string, depth: number) => {
    for (const name of readdirSync(dir)) {
      if (files.length >= maxFiles) return;
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP.has(name) && depth < maxDepth) go(full, depth + 1);
      } else files.push(full);
    }
  };
  go(root, 0);
  return files;
}
const read = (f: string, max = 200_000): string => {
  try {
    return statSync(f).size > max ? "" : readFileSync(f, "utf8");
  } catch {
    return "";
  }
};
const base = (f: string) => f.slice(f.lastIndexOf("/") + 1);
const SIG = /\b[1-9A-HJ-NP-Za-km-z]{86,88}\b/;

function looksLikeKeypair(text: string): boolean {
  try {
    const j = JSON.parse(text);
    return Array.isArray(j) && j.length === 64 && j.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  } catch {
    return false;
  }
}

export function checkShip(dir: string, name = base(dir)): ShipReport {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`${dir} is not a folder`);
  const files = walk(dir);
  const rel = (f: string) => relative(dir, f);
  const readme = read(join(dir, "README.md"));
  const pkgText = read(join(dir, "package.json"));
  let pkg: { scripts?: Record<string, string> } | null = null;
  try {
    pkg = pkgText ? JSON.parse(pkgText) : null;
  } catch {
    pkg = null;
  }
  const has = (n: string) => existsSync(join(dir, n));
  const out: Record<string, ShipResult> = {};
  const put = (id: string, ok: boolean, detail: string) => (out[id] = { id, ok, detail });

  // run
  const runRe = /(npm (run|start|install|ci)|npx |pnpm |yarn |bun |node \S|python3? \S|uv run|cargo (run|build)|anchor )/;
  put("run", runRe.test(readme), readme ? (runRe.test(readme) ? "README.md has a run command" : "README.md has no run command") : "no README.md");

  // tests
  const testScript = pkg?.scripts?.["test"];
  const testCmd = (!!testScript && !/no test specified/i.test(testScript)) || has("Cargo.toml") || has("pytest.ini") || has("pyproject.toml");
  put("test-command", testCmd, testCmd ? "test command found" : "no test script in package.json (and no Cargo.toml or pytest config)");
  const testFiles = files.filter((f) => /(\.test\.|\.spec\.|_test\.|\/test_[^/]*$)/.test("/" + rel(f)) || /\/(tests?|__tests__)\/[^/]+/.test("/" + rel(f)));
  put("test-files", testFiles.length > 0, testFiles.length ? `${testFiles.length} test file(s), for example ${rel(testFiles[0]!)}` : "no test files found");

  // secrets
  const bad: string[] = [];
  for (const f of files) {
    const b = base(f);
    if (b === ".env" || (/^\.env\./.test(b) && !/example|sample|template/.test(b)) || /\.pem$/.test(b) || b === "id.json" || /(keypair|wallet|secret).*\.json$/i.test(b)) bad.push(rel(f));
    else if (/\.(json)$/.test(b) && looksLikeKeypair(read(f, 5000))) bad.push(rel(f) + " (looks like a keypair)");
    else if (/\.(md|ts|js|mjs|py|rs|txt|json|toml)$/.test(b) && /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(read(f))) bad.push(rel(f) + " (private key block)");
  }
  put("secrets", bad.length === 0, bad.length ? `found: ${bad.slice(0, 3).join(", ")}` : "no key files, .env or private key blocks found");

  // mainnet write (heuristic)
  const src = files.filter((f) => /\.(ts|js|mjs|py|rs)$/.test(f));
  const mw = src.filter((f) => {
    const t = read(f);
    return /(sendTransaction|sendAndConfirmTransaction|sendRawTransaction|signAndSend|send_transaction)/.test(t) && /(mainnet-beta|api\.mainnet|clusterApiUrl\(["']mainnet)/.test(t);
  });
  put("mainnet-write", mw.length === 0, mw.length ? `${rel(mw[0]!)} sends transactions and mentions mainnet` : "no file combines sending transactions with mainnet (heuristic)");

  // devnet evidence
  const evFiles = files.filter((f) => /^\/?(README|DEVNET|DEMO-PACK)\.md$/i.test(rel(f)) || /^docs\/[^/]+\.md$/.test(rel(f)));
  const ev = evFiles.find((f) => SIG.test(read(f)) || /explorer\.solana\.com\/tx\/[^\s)]*cluster=devnet/.test(read(f)));
  put("devnet-evidence", !!ev, ev ? `signature or devnet link in ${rel(ev)}` : "no transaction signature or devnet explorer link in README.md, DEVNET.md or DEMO-PACK.md");

  // recorded backup
  const rb = files.find((f) => /\.(mp4|mov|webm|gif)$/i.test(f) || /\/(recorded|demo-pack|backup|recordings?)\//i.test("/" + rel(f)));
  put("recorded-backup", !!rb, rb ? `found ${rel(rb)}` : "no recorded/ folder and no screen recording found");

  // recommended
  const lock = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lock", "Cargo.lock", "uv.lock", "poetry.lock"].find(has);
  put("lockfile", !!lock, lock ? `${lock} present` : "no lockfile");
  const gi = read(join(dir, ".gitignore"));
  const giOk = !!gi && /(^|\n)\.env/.test(gi) && (!pkg || /node_modules/.test(gi));
  put("gitignore", giOk, giOk ? ".gitignore covers .env and node_modules" : gi ? ".gitignore is missing .env or node_modules" : "no .gitignore");
  const lim = /^#+\s*(limitations?|known issues|what (this|it) does not)/im.test(readme);
  put("limitations", lim, lim ? "README has a Limitations section" : "no Limitations heading in README.md");
  const lic = readdirSync(dir).find((n) => /^(LICENSE|LICENCE|COPYING)/i.test(n));
  put("license", !!lic, lic ? `${lic} present` : "no LICENSE file");

  const results = CHECKS.map((c) => out[c.id]!);
  const req = CHECKS.filter((c) => c.level === "required");
  const requiredPassed = req.filter((c) => out[c.id]!.ok).length;
  return { name, ready: requiredPassed === req.length, passed: results.filter((r) => r.ok).length, total: results.length, requiredPassed, requiredTotal: req.length, results };
}

export function printReport(r: ShipReport): void {
  console.log(`\n${r.name}: ${r.ready ? "READY TO SHIP" : "NOT READY"}  (${r.passed}/${r.total} checks, ${r.requiredPassed}/${r.requiredTotal} required)`);
  for (const c of CHECKS) {
    const x = r.results.find((q) => q.id === c.id)!;
    console.log(`  ${x.ok ? "pass" : "FAIL"}  ${c.level === "required" ? "req" : "rec"}  ${c.label}: ${x.detail}`);
    if (!x.ok) console.log(`              fix: ${c.hint}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--dir");
  const dir = i >= 0 ? process.argv[i + 1] : undefined;
  if (!dir) {
    console.error("Usage: npm run ship -- --dir PATH_TO_YOUR_PROJECT");
    process.exit(2);
  }
  const r = checkShip(dir);
  printReport(r);
  process.exit(r.ready ? 0 : 1);
}
