import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildGallery, esc, renderGalleryHtml } from "../src/gallery.ts";
import type { NetworkInfo, SigCheck } from "../src/types.ts";
import { good, root, template } from "./helpers.ts";

const net: NetworkInfo = JSON.parse(readFileSync(`${root}recorded/network.json`, "utf8"));
const rec: SigCheck[] = JSON.parse(readFileSync(`${root}recorded/signature-checks.json`, "utf8")).checks;
const checks = new Map(rec.map((c) => [c.signature, c]));

test("gallery counts lanes and attaches evidence from the signature checks", () => {
  const g = buildGallery(template(), checks, net, "recorded");
  assert.deepEqual(g.byLane, { agent: 1, exchange: 1, tooling: 1 });
  assert.match(g.projects[0]!.evidence.devnet, /^finalized on devnet at slot \d+$/);
  assert.equal(g.projects[0]!.evidence.tests, "14/14 passing (self-reported)");
  assert.equal(g.projects[2]!.evidence.devnet, "no devnet evidence");
  assert.equal(g.template, true);
});

test("a signature that was not checked says so instead of claiming success", () => {
  const g = buildGallery({ event: "e", projects: [good()] }, new Map(), net, "recorded");
  assert.equal(g.projects[0]!.evidence.devnet, "signature not checked");
});

test("a not-found signature is reported as not found", () => {
  const sig = good().devnetSignature!;
  const c: SigCheck = { signature: sig, cluster: "devnet", status: "not-found", slot: null, err: null, checkedAt: "x", mode: "live" };
  const g = buildGallery({ event: "e", projects: [good()] }, new Map([[sig, c]]), net, "live");
  assert.equal(g.projects[0]!.evidence.devnet, "signature not found on devnet");
});

test("html output escapes project text and only links https URLs", () => {
  const evil = good({ name: '<script>alert("x")</script>', summary: "A summary that is long enough <img src=x onerror=alert(1)>", repo: "https://github.com/a/b" });
  const html = renderGalleryHtml(buildGallery({ event: "e", projects: [evil] }, new Map(), net, "recorded"));
  assert.ok(!html.includes('<script>alert("x")'));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;"));
  const bad = good({ repo: "javascript:alert(1)" });
  const h2 = renderGalleryHtml(buildGallery({ event: "e", projects: [bad] }, new Map(), net, "recorded"));
  assert.ok(!h2.includes('href="javascript:'));
});

test("template gallery page is labelled as EXAMPLE data", () => {
  const html = renderGalleryHtml(buildGallery(template(), checks, net, "recorded"));
  assert.match(html, /TEMPLATE DATA/);
  assert.equal((html.match(/class="pill ex">EXAMPLE/g) ?? []).length, 3);
  assert.equal(esc("<&>\"'"), "&lt;&amp;&gt;&quot;&#39;");
});
