// Builds the gallery data (gallery.json) and a static, escaped gallery page (gallery.html) from projects.json.
import type { Gallery, GalleryProject, Lane, NetworkInfo, Project, ProjectsFile, SigCheck } from "./types.ts";
import { LANES } from "./types.ts";

export function devnetEvidence(p: Project, check: SigCheck | null): string {
  if (p.devnetSignature) {
    if (!check) return "signature not checked";
    if (check.status === "failed") return "transaction failed on devnet";
    if (check.status === "not-found") return "signature not found on devnet";
    return `${check.status} on devnet at slot ${check.slot}`;
  }
  if (p.programId) return "program address given, not checked";
  return "no devnet evidence";
}

export function buildGallery(file: ProjectsFile, checks: Map<string, SigCheck>, network: NetworkInfo, mode: "recorded" | "live", now: Date = new Date()): Gallery {
  const byLane = { agent: 0, exchange: 0, tooling: 0 } as Record<Lane, number>;
  const projects: GalleryProject[] = file.projects.map((p) => {
    byLane[p.lane]++;
    const check = p.devnetSignature ? (checks.get(p.devnetSignature) ?? null) : null;
    return {
      ...p,
      evidence: {
        tests: p.tests ? `${p.tests.passing}/${p.tests.total} passing (self-reported)` : "none",
        devnet: devnetEvidence(p, check),
        signatureCheck: check,
      },
    };
  });
  return { event: file.event, mode, generatedAt: now.toISOString(), template: file.template === true, network, projects, byLane };
}

export const esc = (s: unknown): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Only https links are rendered as links; anything else is shown as plain text. */
const link = (label: string, url: string | undefined): string => {
  if (!url) return "";
  try {
    if (new URL(url).protocol === "https:") return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  } catch {
    /* fall through */
  }
  return `<span class="mut">${esc(label)} (link not shown)</span>`;
};

export function renderGalleryHtml(g: Gallery): string {
  const cards = g.projects
    .map(
      (p) => `<article class="card" data-lane="${esc(p.lane)}">
<div class="top"><span class="pill ${esc(p.lane)}">${esc(p.lane)}</span>${p.example ? '<span class="pill ex">EXAMPLE</span>' : ""}</div>
<h2>${esc(p.name)}</h2>
<p>${esc(p.summary)}</p>
<p class="mut">Team: ${esc(p.team.join(", "))}</p>
<ul><li>Tests: ${esc(p.evidence.tests)}</li><li>Devnet: ${esc(p.evidence.devnet)}</li><li>Limitation: ${esc(p.limitation)}</li></ul>
<p class="links">${link("Repo", p.repo)} ${link("Demo", p.demo)}</p>
</article>`,
    )
    .join("\n");
  const filters = (["all", ...LANES] as const)
    .map((l) => `<button type="button" data-f="${l}" aria-pressed="${l === "all"}">${l} (${l === "all" ? g.projects.length : g.byLane[l as Lane]})</button>`)
    .join(" ");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo Day gallery</title>
<style>
body{margin:0;background:#000;color:#f4f4f6;font:300 16px/1.35 "Helvetica Neue",Helvetica,Arial,sans-serif}
main{max-width:1200px;margin:0 auto;padding:2rem}
h1{font-weight:300;font-size:2.4rem;margin:0}.cap{color:#b3a5ff}.mut{color:#9a9aa2}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1rem;margin-top:1rem}
.card{border:1.5px solid #4a4670;border-radius:.9rem;padding:1rem 1.2rem;background:#07070b}
.card h2{font-weight:300;font-size:1.3rem;margin:.4rem 0}.card ul{padding-left:1.1rem;margin:.4rem 0}
.pill{display:inline-block;border:1.5px solid currentColor;border-radius:99px;padding:0 .7rem;font-size:.85rem;margin-right:.4rem}
.agent{color:#b3a5ff}.exchange{color:#3ddc97}.tooling{color:#ffc15a}.ex{color:#ff7a85}
button{font:inherit;color:#f4f4f6;background:#07070b;border:1.5px solid #4a4670;border-radius:.8rem;padding:.4rem .9rem;cursor:pointer}
button[aria-pressed=true]{border-color:#3ddc97;color:#3ddc97}a{color:#b3a5ff;margin-right:1rem}
:focus-visible{outline:3px solid #ffc15a;outline-offset:2px}
</style></head><body><main>
<h1>${esc(g.event)}: project gallery</h1>
<p class="cap">${g.template ? "TEMPLATE DATA: every entry below is an EXAMPLE, not a real project. " : ""}Lane filter, links to each repo and demo.</p>
<p role="group" aria-label="Filter by lane">${filters}</p>
<div class="grid" id="grid">
${cards}
</div>
<p class="mut">${g.mode === "live" ? "Live data" : "Recorded data (not live)"}, generated ${esc(g.generatedAt)}. Mainnet slot ${esc(g.network.slot)} read at ${esc(g.network.capturedAt)}. Reads use public Solana data; every write is devnet only; no real funds. Test counts are self-reported by each team.</p>
</main>
<script>
document.querySelectorAll("button[data-f]").forEach(function(b){b.addEventListener("click",function(){
  var f=b.getAttribute("data-f");
  document.querySelectorAll("button[data-f]").forEach(function(x){x.setAttribute("aria-pressed",String(x===b))});
  document.querySelectorAll(".card").forEach(function(c){c.hidden=!(f==="all"||c.getAttribute("data-lane")===f)});
})});
</script></body></html>
`;
}
