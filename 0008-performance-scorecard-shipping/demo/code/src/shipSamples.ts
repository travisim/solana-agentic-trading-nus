// Three made-up project folders, held in memory, so the ship-check demo has something to scan.
// Nothing here is a real key: the "secrets" are obviously fake (a counting sequence and the word EXAMPLE).
// They are never written to disk by the demo; the tests write them to a temp folder to test the folder reader.
import type { Project, VFile } from "./shipcheck.ts";

const f = (path: string, text?: string, size?: number): VFile => ({ path, size: size ?? (text ? text.length : 100), ...(text !== undefined ? { text } : {}) });

const GOOD_README = `# sol-scorecard

Scores a trade ledger: hit rate, drawdown, costs. Simulated, on recorded data; not advice.
Reads use public mainnet data; every write is devnet only; no real funds.

## Run

\`\`\`
npm install
npm test
npm run demo -- --recorded
\`\`\`

## Devnet evidence

See EVIDENCE.md for a transaction on devnet.

## Known limitation

Only 40 minutes of recorded data, so the numbers are a demonstration, not a result.
`;

export const SAMPLE_PROJECTS: { id: string; label: string; blurb: string; project: Project }[] = [
  {
    id: "tidy",
    label: "tidy-project",
    blurb: "README with run steps, tests, licence, evidence, recorded data",
    project: {
      skippedDirs: ["node_modules"],
      files: [
        f("README.md", GOOD_README),
        f("LICENSE", "MIT License\n"),
        f(".gitignore", "node_modules/\n.env\nout/\n"),
        f("package.json", '{"name":"sol-scorecard","scripts":{"test":"node --test test/*.test.ts","demo":"node src/demo.ts"}}'),
        f("src/demo.ts", "console.log('hi');\n"),
        f("test/score.test.ts", "// tests\n"),
        f("recorded/series.json", "{}", 40_000),
        f("EVIDENCE.md", "Devnet swap: https://explorer.solana.com/tx/5" + "EXAMPLE".repeat(12) + "AB?cluster=devnet\n"),
        f("DEMO-SCRIPT.md", "1. Problem. 2. Run. 3. Evidence. 4. Limit.\n"),
      ],
    },
  },
  {
    id: "messy",
    label: "messy-project",
    blurb: "no tests, thin README, no licence, no evidence",
    project: {
      skippedDirs: [],
      files: [
        f("README.md", "# my bot\n\nit trades sol. very good.\n"),
        f("package.json", '{"name":"bot","scripts":{"test":"echo \\"Error: no test specified\\" && exit 1"}}'),
        f("index.js", "// everything is in here\n"),
        f(".DS_Store", undefined, 6148),
        f("run.log", "started\n", 8),
      ],
    },
  },
  {
    id: "leaky",
    label: "leaky-project",
    blurb: "works, but a .env and a keypair file are in the folder",
    project: {
      skippedDirs: ["node_modules"],
      files: [
        f("README.md", GOOD_README),
        f("LICENSE", "MIT License\n"),
        f("package.json", '{"name":"leaky","scripts":{"test":"node --test"}}'),
        f("test/a.test.ts", "// tests\n"),
        f("src/main.ts", "const key = process.env.PRIVATE_KEY;\n"),
        f(".env", "PRIVATE_KEY=" + "EXAMPLE".repeat(9) + "\nRPC_URL=https://api.devnet.solana.com\n"),
        f("wallet/id.json", "[" + Array.from({ length: 64 }, (_, i) => i).join(",") + "]"),
        f("EVIDENCE.md", "tx: https://explorer.solana.com/tx/" + "EXAMPLE".repeat(12) + "AB?cluster=devnet\n"),
      ],
    },
  },
];
