# Demo Day: Demo Day

2027-02-18. Every team shows what it built.

- **Try the demos in your browser:** https://nus-solana-demos.vercel.app/0010/
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

# Demo Day (0010) demo repo

- `code/`: TypeScript sample code. `npm install`, `npm test`, `npm run demo -- --recorded`. See `code/README.md`.
- `lab/`: four interactive demos that read `code/out/*.json` (project gallery, judging scorecard, run-of-show timer, ship-readiness check). See `lab/README.md`.

**Reads use public mainnet data; every write is devnet only; no real funds.** The three projects in the template are EXAMPLE entries, not real student work.
