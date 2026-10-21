# Workshop 2: Labeling Trades and Forming Teams

2026-11-05. Label outcomes honestly, then pick a lane and form teams.

- **Try the demos in your browser:** https://nus-solana-demos.vercel.app/0004/
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

# Workshop 2: Labeling Trades and Forming Teams (demo repo)

Everything students take home from Workshop 2 (Thu 5 Nov 2026):

- `code/`: TypeScript sample code (`labeler`). `cd code && npm install && npm run demo -- --recorded`. It labels real SOL/USDC prices with triple barriers, counts overlapping labels and leaks, runs an offline pretend agent and an explanation checker, trains a small second-opinion gate, writes `out/*.json` and a mini-lab sheet. See `code/README.md`.
- `lab/`: five interactive demos (open `lab/index.html`; each has a Recorded / Live switch). See `lab/README.md`.

**Reads use public mainnet data; every write is devnet only; no real funds.** No keys, seed phrases, AI credits or API keys are needed. Results are "Simulated, on recorded data; not advice", and gross of fees.

Recorded data (reused from build nights 1 and 2) and its provenance: `code/recorded/SOURCES.md`. What was and was not verified, including the devnet Memo send that the faucet blocked: `code/DRY-RUN-EVIDENCE.md`.
