# Build night 1: Data Collection and Risk Hook

2026-10-22. The four kinds of data an agent reads, and a risk hook that can say no.

- **Try the demos in your browser:** https://nus-solana-demos.vercel.app/0002/
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

# data-risk: Data Collection and Risk Hook

Build night 1 sample code (Solana University, NUS). It shows three things:

1. **Data collection.** Three small collectors read the SOL/USDC price from three places: a Jupiter quote (venue price), the Pyth oracle (read straight from the chain) and an Orca pool (read straight from the chain). Then it lines the prices up and shows the gap in basis points (1 bp = 0.01%).
2. **A risk hook.** `src/risk.ts` is plain code that sits between an agent's idea and any action. It can say no, and it always says why. Four rules: maximum order size, maximum distance from the oracle price, maximum oracle age, and a unit sanity check.
3. **Five sample strategies** on saved (recorded) data, with fees and slippage you can change, so you can see how costs eat an edge. Results are simulated, on recorded data; not advice.

**Reads use public mainnet data; every write is devnet only; no real funds.**

## Safety

- No keys, no seed phrases, no `.env`, no API keys, no AI credits. Nothing in this repo signs or sends a transaction.
- The collectors only read public data. Never paste a seed phrase or private key anywhere in this project.
- Any transaction you add later is devnet only, with a throwaway wallet.
- Strategy numbers are simulations on a short window of recorded data. They say nothing about future results and are not advice.

## Install

Needs Node 24 or newer (`node -v`).

```bash
cd demo-repo/code
npm install        # a few seconds; only installs TypeScript type helpers
```

## Run

```bash
npm run demo                       # default: --recorded, bundled real data, works offline
npm run demo -- --recorded         # same thing, explicit
npm run demo -- --live             # presenter option: fetch one fresh sample from the three venues
npm run demo -- --fee-bps 20       # change the fee per leg (default 5)
npm run demo -- --slippage-bps 10  # change the slippage per leg (default 2)
npm test                           # runs the tests
```

`--live` needs internet. If a public endpoint answers HTTP 429 (rate limited) or is unreachable, the demo says so in plain words and falls back to `--recorded`. Wait a minute and retry, or just carry on with recorded data.

The demo prints three tables and writes four files to `code/out/`:

| File | What it holds |
|---|---|
| `prices.json` | the three prices now, and the gaps in bps |
| `series.json` | the recorded price series (every 5 seconds) for charting |
| `risk.json` | the four rules and ten example orders with accept/reject and reason |
| `strategies.json` | five strategies: trades, gross and net P&L, hit rate |

Extra fields beyond the minimum: `risk.json` has `context` (oracle price and age used) and each decision has `label` and `oracleAgeSec`; each strategy has `notionalUsd` and `legsPerTrade`, so a chart can re-price the same trades with any costs:
`net = pnlGrossUsd - trades * legsPerTrade * (feeBps + slippageBps) / 10000 * notionalUsd` (the market maker pays fees only, no slippage, because it rests orders).

## Expected output

See the end of this file (pasted from a real run). Your numbers will be the same on `--recorded`; with `--live` the prices are whatever the market is doing right now. The exact captured output of a clean install is in `code/DRY-RUN-EVIDENCE.md`.

## Files to read (each is short)

| File | Read it to learn |
|---|---|
| `code/src/collectors/jupiter.ts` | venue price from a public quote API |
| `code/src/collectors/pyth.ts` | oracle price decoded from an on-chain account |
| `code/src/collectors/orca.ts` | pool price from `sqrtPrice` (a square-root price format) |
| `code/src/risk.ts` | the risk hook, one pure function `checkOrder(order, ctx, limits)` |
| `code/src/strategies/*.ts` | five strategies, 30 to 50 lines each |
| `code/recorded/` | the real captured data and `SOURCES.md` (where it came from) |

## Branch out

Pick a tier. Push your work to your own branch and bring a chart next Thursday.

**Beginner**
- No AI credits needed: open `code/src/risk.ts` and hand-edit one number in `DEFAULT_LIMITS` (for example `maxNotionalUsd: 1000` to `100`). Run `npm run demo` and watch which example orders flip from ACCEPT to REJECT.
- Run `npm run demo -- --fee-bps 0 --slippage-bps 0`, then `--fee-bps 30`. Which strategies survive costs?
- Change `minGapBps = 8` in `src/strategies/crossVenueArb.ts` and see how the trade count changes.

**Standard**
- Add fees and slippage thinking to a strategy: change entry thresholds (`entryBps`, `entryZ`, `fast`, `slow`) and chart net P&L before and after. Keep your first run too, so the chart shows the honest before.
- Write a new risk rule (for example: reject if Pyth confidence is wider than 10 bps, or if the Jupiter and Orca prices disagree by more than 30 bps). Add a test in `code/test/risk.test.ts`.
- Plot the three prices from `out/series.json` and mark where the gap is widest.

**Advanced**
- Add a fourth data source (another pool such as Raydium, or a second oracle) as a new file in `src/collectors/`, with a test that decodes real account bytes.
- Run `npm run collect -- --minutes 60` to record a longer series of your own, then test whether a strategy still works on data it has not seen.
- Make a strategy use the ordering clock: compare `postedSlot` and `currentSlot` for the oracle and refuse to trade when the oracle lags by more than N slots.

## Notes for the presenter

- Recorded data was captured live on 2026-10-21; details and limits in `code/recorded/SOURCES.md`.
- `npm run collect` records fresh data (about 35 minutes by default, one sample every 5 s) and overwrites `recorded/`.
- Public RPC and API endpoints are rate limited. Do not run `--live` on 10 laptops at once in the room: students should use `--recorded`.

## Expected output (recorded mode)

From a real run of `npm run demo` (full transcript in `code/DRY-RUN-EVIDENCE.md`):

```
Data collection (recorded) 2026-10-21T17:53:59.000Z   pair SOL/USDC
Venue                  Price (USD)  Gap vs Pyth
Jupiter quote             108.6246  1.8 bps
Pyth oracle               108.6054  
Orca SOL/USDC pool        108.5865  -1.7 bps
Recorded series: 481 points every 5s (0.67 h)

Risk hook (limits: 1000 USD, 50 bps, 60 s; oracle 108.61)
  ACCEPT  normal buy                     
  ACCEPT  normal sell                    
  ACCEPT  right at the notional limit    
  ACCEPT  40 bps from oracle             
  REJECT  oversized order                [max-notional] 5000 USD exceeds the 1000 USD limit
  REJECT  buy 100 bps above oracle       [max-oracle-gap] price is 99.9 bps from the oracle, limit is 50 bps
  REJECT  sell 100 bps below oracle      [max-oracle-gap] price is 99.9 bps from the oracle, limit is 50 bps
  REJECT  stale oracle (300 s old)       [max-oracle-age] oracle is 300 s old, limit is 60 s
  REJECT  price in cents, not dollars    [unit-sanity] price 10860.54 is 100.0x the oracle price 108.61; wrong unit?
  REJECT  negative size                  [unit-sanity] size -50 USD is not a positive number

Sample strategies, simulated on recorded data; not advice. fee 5 bps + slippage 2 bps per leg, 1000 USD per trade
Strategy                   Trades  Gross USD   Net USD  Hit rate
Cross-venue arbitrage           0       0.00      0.00        0%
Pool vs oracle basis           19       1.31    -25.29        0%
Moving-average trend           10       0.61    -13.39       20%
Mean reversion (z-score)        9       1.03    -11.57        0%
Market maker around Pyth        7       0.05     -3.45       43%

Wrote prices.json, series.json, risk.json, strategies.json to code/out/
```

Every strategy is net negative after costs on this window. That is the lesson, not a bug: most edges vanish after costs and latency. Do not tune strategies until they look good; change one thing and chart before and after.
