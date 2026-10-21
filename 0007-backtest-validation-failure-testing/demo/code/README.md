# Build night 4 demo repo: Backtest Validation and Failure Testing

Everything students need for Build night 4 (Thu 28 Jan 2027, NUS), in two folders:

| Folder | What | Start here |
|---|---|---|
| `lab/` | Four interactive demos (one self-contained HTML file each, open from disk, Recorded / Live switch): split leakage, many strategies, failure injector, feed break | double-click `lab/index.html` |
| `code/` | The TypeScript sample code (`validation-lab`) behind them: purged splits, a planted leak and a causality test, a random-strategy factory with a luck benchmark, a fault injector, a feed-break alarm. It writes the JSON the demos read | `code/README.md` |

**Reads use public mainnet data; every write is devnet only; no real funds.** No keys, wallets, seed phrases, API keys or AI credits are needed. Results are "Simulated, on recorded data; not advice". The faults are simulated on top of real recorded prices; nothing attacks a live service.

## Quick start

```bash
cd code
npm install
npm test
npm run demo -- --recorded
```

Then open `lab/index.html` in a browser. Demos online: https://nus-solana-demos.vercel.app/0007/

## The four demos

1. `01-split-leakage.html`: a timeline of 481 moments coloured train, test, purged and embargoed. Controls: shuffled or contiguous folds, label horizon, purge on or off, an embargo slider from 0 to 30, fold selector. Shows how often a memoriser guesses right against the 50% coin-flip line.
2. `02-many-strategies.html`: 50 random strategies, in-sample versus out-of-sample score. Sliders: number of tries, draw, cost per leg. Shows the best score, the luck benchmark for that many tries and the winner on fresh data.
3. `03-failure-injector.html`: pick a fault (stale oracle, RPC outage, slippage shock, fee change, duplicate submission), set its size, and watch what build night 1's risk hook accepts and rejects. Toggle extra guards.
4. `04-feed-break.html`: the venue-minus-oracle gap and a CUSUM alarm; freeze the oracle (simulated) and watch it fire.

Each demo has a **Recorded / Live** switch. Recorded is the default and needs no network. Live reads public Solana data from your browser through `https://solana-rpc.publicnode.com` (no keys, no writes) and falls back to recorded data by itself if anything fails.

## Session plan

Student-led build night: 10-minute talk, demo tour, guided mission (find the planted leak, fix it with a purged split, chart before and after), free build, show and tell. Agenda: `general/NUS-Weekly-Session-Guide.md` (Active week 7).
