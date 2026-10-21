# Workshop 3 demo repo: Deploy a Trading Venue Component on Devnet

Solana University, NUS. Thu 21 Jan 2027. **Reads use public mainnet data; every write is devnet only; no real funds.** No API keys, no AI credits, no seed phrases.

- `code/` TypeScript (Node 24) sample code and a small Rust program (`code/program/`): read Phoenix order books, run a mini order book that is **really deployed on devnet**, watch deposits. Start with `code/README.md`. `npm install`, `npm test`, `npm run demo -- --recorded`.
- `lab/` five interactive demos (one HTML file each, open from disk, Recorded/Live switch): order book ladder, matching step by step, devnet replay, deposit flow, order flow imbalance. Start with `lab/index.html`.
- `THIRD-PARTY.md` licenses and what was used only for verification.
- `code/DRY-RUN-EVIDENCE.md` verbatim output of a clean install, test and demo run. `code/recorded/SOURCES.md` where every recorded number came from, and the honest limits.

What is real: the program (deployed on devnet, address in `code/recorded/devnet-deploy.json`), 9 real devnet transactions, 2 real deposits and 1 failing deposit, 5 real Phoenix books and 2,900 real Orca swaps. What is a toy: the program has no owners or balances. What is simulated is labelled "simulated, on recorded data; not advice".
