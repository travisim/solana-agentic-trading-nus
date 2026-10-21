// Validates a projects.json. Pure functions, no network. Used by the gallery generator and the tests.
// Run on its own:  npm run validate -- projects.json
import { readFileSync } from "node:fs";
import type { Issue, Project, Validation } from "./types.ts";
import { LANES } from "./types.ts";

const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
const HANDLE = /^@?[A-Za-z0-9_-]{2,39}$/;
const RETURNS = /\b(returns?|profit|profits|profitable|apy|apr|roi|pnl|gains?|alpha)\b/i;
const SECRET_KEYS = /^(privatekey|secretkey|secret|seed|seedphrase|mnemonic|apikey|password|token)$/i;
const KNOWN = new Set(["id", "name", "lane", "team", "summary", "repo", "demo", "devnetSignature", "programId", "tests", "limitation", "example"]);

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return "must be a text link";
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return "is not a valid link";
  }
  if (u.protocol !== "https:") return "must start with https://";
  return null;
}

export function validateProjects(input: unknown): Validation {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const err = (id: string, field: string, message: string) => errors.push({ id, field, message });
  const warn = (id: string, field: string, message: string) => warnings.push({ id, field, message });
  const counts = { projects: 0, agent: 0, exchange: 0, tooling: 0 };

  if (!isObj(input)) {
    err("(file)", "(root)", "the file must be a JSON object with an event and a projects list");
    return { ok: false, errors, warnings, counts };
  }
  if (typeof input["event"] !== "string" || !input["event"].trim()) err("(file)", "event", "needs an event name");
  const list = input["projects"];
  if (!Array.isArray(list) || list.length === 0) {
    err("(file)", "projects", "needs a non-empty projects list");
    return { ok: false, errors, warnings, counts };
  }
  counts.projects = list.length;
  if (list.length > 7) warn("(file)", "projects", `${list.length} projects but only 7 five-minute slots fit between 18:20 and 18:55; the rest need a lightning slot or the peer gallery`);

  const seen = new Set<string>();
  list.forEach((raw, i) => {
    if (!isObj(raw)) return err(`#${i + 1}`, "(entry)", "each project must be an object");
    const id = typeof raw["id"] === "string" && raw["id"] ? raw["id"] : `#${i + 1}`;
    const example = raw["example"] === true;
    if (typeof raw["id"] !== "string" || !ID.test(raw["id"])) err(id, "id", "use lowercase letters, digits and dashes (2 to 41 characters)");
    else if (seen.has(raw["id"])) err(id, "id", "duplicate id");
    else seen.add(raw["id"]);

    for (const k of Object.keys(raw)) {
      if (SECRET_KEYS.test(k)) err(id, k, "never put keys, seed phrases or tokens in this file. Remove it and rotate anything that was real");
      else if (!KNOWN.has(k)) warn(id, k, "unknown field, ignored");
    }
    const text = (k: string, min: number, max: number) => {
      const v = raw[k];
      if (typeof v !== "string" || v.trim().length < min || v.trim().length > max) err(id, k, `needs text of ${min} to ${max} characters`);
    };
    text("name", 3, 60);
    text("summary", 20, 240);
    text("limitation", 10, 240);

    const lane = raw["lane"];
    if (typeof lane !== "string" || !(LANES as readonly string[]).includes(lane)) err(id, "lane", `must be one of ${LANES.join(", ")}`);
    else counts[lane as "agent" | "exchange" | "tooling"]++;

    const team = raw["team"];
    if (!Array.isArray(team) || team.length < 1 || team.length > 4) err(id, "team", "list 1 to 4 GitHub handles");
    else if (!team.every((h) => typeof h === "string" && HANDLE.test(h))) err(id, "team", "handles look like @name (letters, digits, - and _)");

    const repoMsg = httpsUrl(raw["repo"]);
    if (repoMsg) err(id, "repo", repoMsg);
    else if (!example && new URL(raw["repo"] as string).hostname !== "github.com") err(id, "repo", "must be a github.com link so reviewers can clone it");
    if (raw["demo"] !== undefined) {
      const m = httpsUrl(raw["demo"]);
      if (m) err(id, "demo", m);
    }
    if (raw["devnetSignature"] !== undefined) {
      const s = raw["devnetSignature"];
      if (typeof s !== "string" || s.length < 86 || s.length > 88 || !B58.test(s)) err(id, "devnetSignature", "a transaction signature is 86 to 88 base58 characters");
    }
    if (raw["programId"] !== undefined) {
      const s = raw["programId"];
      if (typeof s !== "string" || s.length < 32 || s.length > 44 || !B58.test(s)) err(id, "programId", "a program address is 32 to 44 base58 characters");
    }
    const t = raw["tests"];
    if (t !== undefined) {
      if (!isObj(t) || typeof t["command"] !== "string" || !t["command"].trim()) err(id, "tests", "needs a command, for example npm test");
      else if (!Number.isInteger(t["passing"]) || !Number.isInteger(t["total"]) || (t["total"] as number) < 1 || (t["passing"] as number) < 0 || (t["passing"] as number) > (t["total"] as number))
        err(id, "tests", "passing and total must be whole numbers with 0 <= passing <= total and total >= 1");
    } else warn(id, "tests", "no test evidence (the rubric scores reproducible tests)");
    if (raw["devnetSignature"] === undefined && raw["programId"] === undefined) warn(id, "devnetSignature", "no devnet evidence (add a transaction signature or a program address)");
    for (const k of ["summary", "limitation", "name"]) {
      const v = raw[k];
      if (typeof v === "string" && RETURNS.test(v)) warn(id, k, "mentions returns or profit. Judging ignores simulated returns; describe what the project does and what you tested");
    }
    if (raw["example"] !== undefined && typeof raw["example"] !== "boolean") err(id, "example", "must be true or false");
    if (example && input["template"] === false) warn(id, "example", "an EXAMPLE entry is still in the file");
  });
  return { ok: errors.length === 0, errors, warnings, counts };
}

export function asProjects(input: unknown): Project[] {
  return (input as { projects: Project[] }).projects;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2] ?? "projects.json";
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`Could not read ${file}: ${(e as Error).message}`);
    process.exit(1);
  }
  const v = validateProjects(json);
  console.log(`${file}: ${v.counts.projects} projects (agent ${v.counts.agent}, exchange ${v.counts.exchange}, tooling ${v.counts.tooling})`);
  for (const e of v.errors) console.log(`  ERROR   ${e.id} / ${e.field}: ${e.message}`);
  for (const w of v.warnings) console.log(`  warning ${w.id} / ${w.field}: ${w.message}`);
  console.log(v.ok ? "valid" : `${v.errors.length} error(s): fix them and run again`);
  process.exit(v.ok ? 0 : 1);
}
