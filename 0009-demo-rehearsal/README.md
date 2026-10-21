# Build night 5: Demo Rehearsal

2027-02-11. Rehearse the Demo Day pitch.

- **Try the demos in your browser:** https://nus-solana-demos.vercel.app/0009/
- **Slides:** [`slides/`](slides/) (PDF and PowerPoint, plus the speaker script and Q&A)
- **Demos (open `demo/lab/index.html`):** [`demo/lab/`](demo/lab/)
- **Sample code:** [`demo/code/`](demo/code/)

```
cd demo/code
npm install
npm run demo -- --recorded
```

Reads use public mainnet data; every write is devnet only; no real funds. Simulated results on recorded data are not advice.

---

# Build night 5 demo repo

- `code/` TypeScript sample code (`npm install`, `npm test`, `npm run demo -- --recorded`). Writes `code/out/*.json`.
- `lab/` four interactive demos (open `lab/index.html`). Rebuilt from `code/out` with `node build.mjs`.

Reads use public mainnet data; every write is devnet only; no real funds, no seed phrases. See `code/README.md` and `lab/README.md`.
