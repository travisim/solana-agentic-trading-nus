# Build night 5 demo repo

- `code/` TypeScript sample code (`npm install`, `npm test`, `npm run demo -- --recorded`). Writes `code/out/*.json`.
- `lab/` four interactive demos (open `lab/index.html`). Rebuilt from `code/out` with `node build.mjs`.

Reads use public mainnet data; every write is devnet only; no real funds, no seed phrases. See `code/README.md` and `lab/README.md`.
