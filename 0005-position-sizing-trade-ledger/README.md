# Build night 3: Position Sizing and the Trade Ledger

2026-11-12. Size a bet, and keep a ledger you can audit.

- **Try the demos in your browser:** https://nus-solana-demos.vercel.app/0005/
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

# ledger-sizer: Position Sizing and the Trade Ledger

Build night 3 sample code (Solana University, NUS). It turns a **confidence** into a **capped position size**, counts **overlapping bets** together, and writes every order and decision into an **append-only, hash-chained trade ledger** that reconciles to the balance. It runs on **real recorded SOL/USDC prices** (Jupiter, Pyth and Orca), **real Jupiter price-impact quotes** and **real Solana token accounts**.

**Reads use public mainnet data; every write is devnet only; no real funds.** Everything printed is "Simulated, on recorded data; not advice". There are no profit or return claims here.

## What it shows

1. **Size from confidence.** `src/sizing.ts`: `z = (p - 1/2) / sqrt(p(1-p))`, `size = 2 * Phi(z) - 1`. 0.5 gives 0, 0.9 gives about 82 %, and it never passes 100 %. Sizes are rounded to steps (`discretize`) and scaled to an exposure cap (25 % of equity by default).
2. **Overlapping bets.** `src/concurrency.ts`: how many bets are open at once, and how "unique" each one is. `combineBets` averages the open bets (one shared position) or sums them (the naive way). The average of three 50 % bets is 50 %; their sum is 150 % (clipped to 100 %).
3. **Limits in order.** The order is cut to the largest size whose Jupiter price impact is under the cap (`src/impact.ts`), then it goes through the **risk hook from build night 1** (`src/risk.ts`, copied unchanged): max notional, oracle gap, oracle age, unit sanity. The sizer proposes, the hook can still say no and always says why.
4. **A ledger you can replay.** `src/ledger.ts`: `append` is the only way to change it. Each row carries the SHA-256 of the row before it. `replay` rebuilds cash and position from the fills and reports the first row that does not add up. Rejected orders are rows too.
5. **Real inventory.** `src/tokens.ts` reads real SPL token accounts with `getAccountInfo` (the Orca SOL/USDC pool's two vaults), so the size of an order can be compared with what the pool actually holds.

## Safety

- No keys, no seed phrases, no `.env`, no API keys, no AI credits. Nothing in this repo signs or sends a transaction.
- The collectors only read public data. Never paste a seed phrase or private key anywhere in this project.
- The simulated account (10,000 USD of cash) is not a wallet. Short positions are simulated (a negative SOL balance); nothing is borrowed or sent.
- The optional "post the ledger's head hash to devnet with a Memo transaction" from the session menu is **not included**: it needs devnet SOL (airdrops are rate limited), a throwaway key kept outside the repo and a hand-built transaction, and it was not verified end to end, so it is left out rather than faked. `npm run demo` prints the ledger's head hash, which is what you would post.

## Install

Needs Node 24 or newer (`node -v`).

```bash
cd demo/code          # in the public repo; in this working tree: demo-repo/code
npm install           # a few seconds; installs TypeScript type helpers only (no runtime dependencies)
```

## Run

```bash
npm run demo                              # default: --recorded, bundled real data, works offline
npm run demo -- --recorded                # same thing, explicit
npm run demo -- --live                    # presenter option: also reads the pool token accounts and 3 Jupiter quotes right now
npm run demo -- --max-fraction 0.10       # exposure cap as a share of equity (default 0.25)
npm run demo -- --step 0.25               # size steps (default 0.1)
npm run demo -- --max-impact-bps 2        # largest price impact allowed per order (default 5)
npm run demo -- --fee-bps 8               # fee per fill in bps (default 4)
npm run demo -- --horizon-sec 600         # how long each bet stays open (default 300)
npm run demo -- --combine sum             # add open bets instead of averaging them
npm run demo -- --min-z 1.5               # fewer, stronger signals (default 1.0)
npm run demo -- --max-notional 500        # tighten the risk hook (default 1000 USD)
npm run demo -- --start-usd 5000          # simulated starting cash (default 10000)
npm test                                  # runs the tests (41)
npm run typecheck                         # optional: type check with tsc
```

`--live` needs internet and is for the presenter; students use `--recorded`. If an endpoint is unreachable or answers 429, the demo says so in plain words and falls back to recorded data. Jupiter's free quote API throttles quickly on a shared classroom IP, so do not run `--live` on 10 laptops at once. The simulation always runs on the recorded 40-minute price series; `--live` refreshes only the pool balances and a few impact quotes.

## What it writes (`out/`, the interactive demos in `demo-repo/lab/` read these)

| File | What it holds |
|---|---|
| `ledger.jsonl` | the main run's ledger, one JSON row per line (append-only, hash-chained) |
| `ledger.json` | the same rows, plus the replay result (`replay.ok`, head hash) and run stats |
| `sizing.json` | the confidence-to-size curve, parameters, risk limits, the real Jupiter impact curves and the real pool token balances |
| `concurrency.json` | every bet with its uniqueness, the open-bet count at each 5 s tick, and the averaged versus summed size over time |
| `equity.json` | four runs on the same signals: no costs, with costs (the main ledger), half the cap, bets summed instead of averaged; each with an equity curve and stats |
| `series.json` | the recorded price series the simulation ran on (copy of `recorded/series.json`) |

A ledger row has: `seq, t, trigger, note, activeBets, targetFraction, targetUsd, currentUsd, order {side, sizeUsd, price}, oraclePrice, oracleAgeSec, verdict {ok, rule, reason}, fill {price, qtySol, impactBps, feeUsd} | null, cashUsd, posSol, equityUsd, prevHash, hash`. `verdict` is the risk hook's decision; `fill` is `null` when the hook said no. Two rows are **injected test orders** (an oversized order and a price typed in cents) so the hook's refusals are on screen; they have `trigger: "injected"` and the note says INJECTED.

## Files to read (each is short)

| File | Read it to learn |
|---|---|
| `src/sizing.ts` | confidence to size, steps, combine, target in USD |
| `src/concurrency.ts` | open bets and average uniqueness |
| `src/ledger.ts` | the append-only ledger, `replay` and `reconcileWith` |
| `src/simulate.ts` | the whole loop: signal, bet, size, impact cap, hook, fill, ledger row |
| `src/risk.ts` | the build night 1 risk hook, unchanged |
| `src/impact.ts`, `src/tokens.ts` | price impact from real Jupiter quotes; real token accounts |
| `src/signals.ts` | a deliberately simple momentum signal (the confidence is a stand-in for your own model; it is not calibrated) |
| `recorded/` | the real captured data and `SOURCES.md` (endpoints, times, limits) |

## Mission (20 minutes)

Run the sample sizing on the sample ledger, add **one** limit or cost (a smaller cap, a bigger fee, a daily-loss halt, impact on or off), and chart the equity curve **before and after**. Keep your first chart so the "before" is honest. Demo 4 (`lab/04-equity-before-after.html`) draws the same comparison.

## Build menu and branch out

Pick a tier. Before the academic break: freeze `main`, and write a restart note (how to run, expected output, the first task for January).

**Beginner (no AI credits needed)**
- Hand-edit one number: `npm run demo -- --max-fraction 0.10`, then `0.40`. Predict the biggest size before each run.
- Run with `--combine sum` and count how many orders the hook refuses. Why?
- Run with `--fee-bps 0`, `4`, `20`. At what fee do the "before" and "after" curves cross?

**Standard**
- Add a **daily-loss or drawdown halt**: stop sending orders when equity falls more than X % from its peak; write the halt into the ledger as a row.
- Compare **two sizing rules on the same ledger** (for example fixed size versus size from confidence) and chart both.
- Add a cost you care about (a network fee per fill) to `simulate.ts` and see the ledger still reconcile.
- Read your own devnet wallet's token balance with `readTokenAccount` and call `reconcileWith` to compare it with a replayed ledger.

**Advanced**
- Make the confidence come from your own model instead of `confidenceOf`; check that bigger confidence really means a bigger hit rate before you trust it.
- Use the ORCA/USDC curve (or record a thinner pair with `npm run collect -- impact`) and watch the impact cap cut orders.
- Post the ledger's head hash to **devnet** with a Memo transaction (throwaway key outside the repo; not included here).

## Notes for the presenter

- Recorded data: captured 21 Oct 2026 (UTC); endpoints, times and limits are in `recorded/SOURCES.md`.
- `npm run collect -- impact` records Jupiter quotes (about 1 minute, slow on purpose); `npm run collect -- balances` records the pool token accounts. Both overwrite files in `recorded/`. The price series is the build night 1 recording and is not re-recorded here.
- Public RPC and API endpoints are rate limited.
