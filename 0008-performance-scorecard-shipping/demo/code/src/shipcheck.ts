// Ship-readiness check: looks at a project folder and tells you what a judge, or a teammate on a fresh laptop, would trip over.
// It reads file NAMES and the text of small files. It never uploads anything and never prints a secret it finds, only where it is.
//   npm run ship-check -- ../my-project
import { readdirSync, readFileSync, statSync, lstatSync } from "node:fs";
import { join } from "node:path";

export interface VFile {
  path: string; // relative, forward slashes
  size: number; // bytes
  text?: string; // present for small text files
}

export type Severity = "fail" | "warn";
export type Status = "pass" | Severity | "na";

export interface CheckResult {
  id: string;
  label: string;
  severity: Severity;
  status: Status;
  detail: string;
  files?: string[];
}

export interface ShipReport {
  verdict: "ready to ship" | "nearly ready" | "not ready";
  passed: number;
  applicable: number;
  fails: number;
  warns: number;
  results: CheckResult[];
}

export interface Project {
  files: VFile[];
  skippedDirs: string[]; // folders we did not read, such as node_modules
}

const SKIP = new Set([".git", "node_modules", ".next", "dist", "build", "target", ".venv", "__pycache__"]);
const TEXT_EXT = /\.(md|txt|json|ts|tsx|js|mjs|cjs|py|rs|toml|yml|yaml|env|sh|html|css|example|lock)$/i;
const TEXT_NAMES = /^(readme|license|licence|makefile|dockerfile|\.gitignore|\.env.*)$/i;
const MAX_TEXT = 200_000;
const MAX_FILES = 3000;
const B58 = "[1-9A-HJ-NP-Za-km-z]";

export function readFolder(dir: string): Project {
  const files: VFile[] = [];
  const skippedDirs: string[] = [];
  // .shipcheckignore: one path prefix per line (# for comments). For files that CONTAIN example secrets on purpose, like our own test fixtures.
  let ignore: string[] = [];
  try { ignore = readFileSync(join(dir, ".shipcheckignore"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")); } catch { /* none */ }
  const walk = (rel: string) => {
    for (const name of readdirSync(join(dir, rel))) {
      if (files.length >= MAX_FILES) return;
      const relPath = rel ? `${rel}/${name}` : name;
      const full = join(dir, relPath);
      if (ignore.some((p) => relPath === p || relPath.startsWith(p.endsWith("/") ? p : p + "/") || relPath.startsWith(p))) continue;
      const st = lstatSync(full);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (SKIP.has(name)) skippedDirs.push(relPath);
        else walk(relPath);
        continue;
      }
      const f: VFile = { path: relPath, size: st.size };
      if (st.size <= MAX_TEXT && (TEXT_EXT.test(name) || TEXT_NAMES.test(name))) f.text = readFileSync(full, "utf8");
      files.push(f);
    }
  };
  if (!statSync(dir).isDirectory()) throw new Error(`${dir} is not a folder`);
  walk("");
  return { files, skippedDirs };
}

const base = (p: string) => p.split("/").pop()!;
const rootFile = (files: VFile[], re: RegExp) => files.find((f) => !f.path.includes("/") && re.test(f.path));

export const CHECKS: { id: string; label: string; severity: Severity }[] = [
  { id: "readme-exists", label: "README at the top of the project", severity: "fail" },
  { id: "readme-run", label: "README says how to install and run", severity: "fail" },
  { id: "readme-limits", label: "README names one known limitation", severity: "warn" },
  { id: "readme-safety", label: "README says devnet only, no real funds", severity: "warn" },
  { id: "tests-exist", label: "Tests exist", severity: "fail" },
  { id: "test-script", label: "One command runs the tests", severity: "warn" },
  { id: "secret-files", label: "No .env or keypair files in the project", severity: "fail" },
  { id: "secret-content", label: "No keys or secrets inside files", severity: "fail" },
  { id: "gitignore", label: ".gitignore covers .env and node_modules", severity: "warn" },
  { id: "license", label: "Licence file", severity: "warn" },
  { id: "demo-script", label: "Demo script or pitch notes", severity: "warn" },
  { id: "devnet-evidence", label: "Devnet evidence (explorer link or signature)", severity: "warn" },
  { id: "recorded-backup", label: "Recorded backup for the demo", severity: "warn" },
  { id: "hygiene", label: "No junk or oversized files", severity: "warn" },
];

export function checkProject(p: Project): ShipReport {
  const { files } = p;
  const textOf = (re: RegExp) => files.filter((f) => re.test(f.path) && f.text !== undefined);
  const readme = rootFile(files, /^readme(\.md|\.txt)?$/i);
  const rt = readme?.text ?? "";
  const pkg = files.find((f) => f.path === "package.json");
  let scripts: Record<string, string> | null = null;
  if (pkg?.text) {
    try { scripts = (JSON.parse(pkg.text) as { scripts?: Record<string, string> }).scripts ?? {}; } catch { scripts = null; }
  }
  const gi = rootFile(files, /^\.gitignore$/)?.text ?? "";
  const out = new Map<string, Omit<CheckResult, "id" | "label" | "severity">>();
  const set = (id: string, ok: boolean, okMsg: string, badMsg: string, fl?: string[]) =>
    out.set(id, { status: ok ? "pass" : (CHECKS.find((c) => c.id === id)!.severity), detail: ok ? okMsg : badMsg, ...(fl && fl.length ? { files: fl } : {}) });

  set("readme-exists", !!readme, `found ${readme?.path}`, "no README.md at the top of the project");
  set("readme-run", /```|^\s*\$ |\bnpm (install|run|test)\b|\bpnpm\b|\bcargo run\b|\bpython3? /im.test(rt) && /(install|run|start|usage)/i.test(rt),
    "README has run commands", readme ? "README has no install or run commands (add a code block with the exact commands)" : "no README to check");
  set("readme-limits", /limitation|known issue|caveat|does not (handle|support|show)|not (yet )?(supported|handled)/i.test(rt),
    "README mentions a limitation", "no limitation named; a first-time user should see the benefit AND the limit");
  set("readme-safety", /devnet|no real funds|not real money|testnet/i.test(rt), "README states the safety line", "no mention of devnet or no real funds");

  const testFiles = files.filter((f) => /(^|\/)(tests?|__tests__)\//i.test(f.path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(f.path) || /(^|\/)test_[^/]+\.py$/.test(f.path) || /_test\.(py|rs|go)$/.test(f.path));
  set("tests-exist", testFiles.length > 0, `${testFiles.length} test file${testFiles.length === 1 ? "" : "s"}`, "no test files found (a test/ folder or *.test.ts)");
  if (scripts === null) out.set("test-script", { status: "na", detail: pkg ? "package.json could not be read" : "no package.json (check your own test command)" });
  else set("test-script", typeof scripts["test"] === "string" && !/no test specified/i.test(scripts["test"]!), `npm test runs: ${scripts["test"]}`, "package.json has no real \"test\" script");

  const secretFiles = files.filter((f) => {
    const b = base(f.path);
    if (/^\.env(\..+)?$/i.test(b) && !/\.(example|sample|template)$/i.test(b)) return true;
    return /^(id\.json|wallet\.json)$/i.test(b) || /keypair.*\.json$/i.test(b) || /\.(pem|key)$/i.test(b);
  }).map((f) => f.path);
  set("secret-files", secretFiles.length === 0, "none found", `${secretFiles.length} file${secretFiles.length === 1 ? "" : "s"} that look like secrets: remove them and rotate anything real`, secretFiles);

  const KEYARR = /\[\s*(\d{1,3}\s*,\s*){63}\d{1,3}\s*\]/;
  const KEYVAR = new RegExp(`(PRIVATE_KEY|SECRET_KEY|SEED_PHRASE|MNEMONIC|API_KEY|APIKEY)\\s*[=:]\\s*["']?${B58}{32,}`, "i");
  const leaks = files.filter((f) => f.text !== undefined && base(f.path) !== "package-lock.json" && (KEYARR.test(f.text) || KEYVAR.test(f.text))).map((f) => f.path);
  set("secret-content", leaks.length === 0, "no key-shaped text found", `key-shaped text in ${leaks.length} file${leaks.length === 1 ? "" : "s"} (values are not printed)`, leaks);

  const needsNode = !!pkg || p.skippedDirs.includes("node_modules");
  const covers = (name: string) => new RegExp(`^/?${name.replace(".", "\\.")}/?\\*?$`, "m").test(gi);
  const envOk = covers(".env") || /^\.env\*$/m.test(gi);
  const nmOk = !needsNode || covers("node_modules");
  set("gitignore", !!gi && envOk && nmOk, ".gitignore lists .env and node_modules",
    !gi ? "no .gitignore" : `${envOk ? "" : ".env "}${nmOk ? "" : "node_modules "}not listed`.trim());

  set("license", !!rootFile(files, /^(license|licence|copying)(\.md|\.txt)?$/i), "licence file found", "no LICENSE file (MIT is a fine default)");
  const demo = files.filter((f) => /demo[-_ ]?script|(^|\/)demo\.md$|pitch/i.test(f.path)).map((f) => f.path);
  set("demo-script", demo.length > 0 || /demo script|2-minute|3-minute|pitch/i.test(rt), demo.length ? `found ${demo[0]}` : "README has a demo/pitch section", "no demo script (write the 2 or 3 minute story: problem, run, evidence, limit)");
  // Evidence = a link to a real-looking signature on devnet, in a doc that is not a template (templates hold placeholders).
  const mdText = textOf(/\.(md|txt)$/i).filter((f) => !/template/i.test(f.path));
  const devnetTx = new RegExp(`(explorer\\.solana\\.com|solscan\\.io|solana\\.fm)/tx/${B58}{80,90}\\?cluster=devnet`, "i");
  set("devnet-evidence", mdText.some((f) => devnetTx.test(f.text!)),
    "devnet explorer link with a transaction signature found", "no devnet explorer link (.../tx/<signature>?cluster=devnet) in any .md file (templates do not count)");
  set("recorded-backup", files.some((f) => /(^|\/)(recorded|fixtures)\//i.test(f.path)) || /--recorded|recorded (data|demo)|backup/i.test(rt), "recorded data or backup mentioned", "no recorded data or backup demo (the network WILL fail at the worst moment)");
  const junk = files.filter((f) => base(f.path) === ".DS_Store" || f.size > 5_000_000 || /\.(log|tmp)$/i.test(f.path)).map((f) => f.path);
  const nmBad = p.skippedDirs.includes("node_modules") && !covers("node_modules");
  set("hygiene", junk.length === 0 && !nmBad, "clean", `${junk.length} junk or oversized file${junk.length === 1 ? "" : "s"}${nmBad ? "; node_modules would be committed" : ""}`, junk);

  const results: CheckResult[] = CHECKS.map((c) => ({ ...c, ...out.get(c.id)! }));
  const applicable = results.filter((r) => r.status !== "na");
  const fails = results.filter((r) => r.status === "fail").length;
  const warns = results.filter((r) => r.status === "warn").length;
  return {
    verdict: fails ? "not ready" : warns ? "nearly ready" : "ready to ship",
    passed: applicable.filter((r) => r.status === "pass").length,
    applicable: applicable.length,
    fails,
    warns,
    results,
  };
}
