// npm run ship-check -- <folder>     scans a project folder and prints what is missing before you ship it.
// Exit code 1 if any "fail" check fails, so you can also run it in CI. Reads files only; nothing leaves your machine.
import { checkProject, readFolder } from "./shipcheck.ts";

const dir = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!dir) {
  console.log("usage: npm run ship-check -- <project-folder>");
  process.exit(2);
}
const report = checkProject(readFolder(dir));
const mark = { pass: "PASS", fail: "FAIL", warn: "WARN", na: "n/a " } as const;
console.log(`Ship check: ${dir}\n`);
for (const r of report.results) {
  console.log(`  ${mark[r.status]}  ${r.label}`);
  if (r.status !== "pass") console.log(`        ${r.detail}${r.files ? `: ${r.files.join(", ")}` : ""}`);
}
console.log(`\n${report.verdict.toUpperCase()}: ${report.passed}/${report.applicable} checks pass, ${report.fails} fail, ${report.warns} warn`);
process.exit(report.fails ? 1 : 0);
