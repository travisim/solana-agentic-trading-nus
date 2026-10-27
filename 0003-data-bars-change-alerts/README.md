# Build night 2: Data Bars and Change Alerts

2026-10-29. Dollar bars instead of clock bars, change alerts, and a stale-feed check.

- **Try the demos in your browser:** https://nus-solana-demos.vercel.app/0003/
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

# bars-alerts: Data Bars and Change Alerts

Build night 2 sample code (Solana University, NUS). It shows four things on **real Orca SOL/USDC swaps** and **real Pyth oracle reads**:

1. **Time bars versus dollar bars.** A time bar closes when a minute has passed. A dollar bar closes when $X has traded. Quiet periods give few dollar bars, busy periods give many.
2. **A CUSUM change filter.** Add up the price changes (in basis points, 1 bp = 0.01%). Fire an event only when the running total crosses a threshold. An agent that wakes only on events makes far fewer calls than one that wakes on every tick.
3. **A staleness check.** A Pyth price carries a publish time and the slot it was posted at. If the price is too old in seconds or too many slots behind the chain, the check says no.
4. **Real data collection.** `src/swaps.ts` finds real swaps from the pool's token vaults; `src/staleness.ts` works on real Pyth reads.

**Reads use public mainnet data; every write is devnet only; no real funds.**

Everything printed is "simulated or computed on recorded data; not advice". There are no profit or return claims here.

## Safety

- No keys, no seed phrases, no `.env`, no API keys, no AI credits. Nothing in this repo signs or sends a transaction.
- The collectors only read public data. Never paste a seed phrase or private key anywhere in this project.
- The optional "devnet Memo per CUSUM event" stretch from the session menu is **not included**: it could not be verified end to end in time, so it is left out rather than faked. If you build it yourself, use a throwaway devnet wallet kept outside the repo.
- The frozen Pyth feed in `staleness.json` is a **simulation** laid over real data (see below). It is labelled as simulated in the file and in the demo output.

## Install

Needs Node 24 or newer (`node -v`).

```bash
cd demo-repo/code
npm install        # a few seconds; only installs TypeScript type helpers (no runtime dependencies)
```

## Run

```bash
npm run demo                            # default: --recorded, bundled real data, works offline
npm run demo -- --recorded              # same thing, explicit
npm run demo -- --live                  # presenter option: 200 fresh swaps + 8 Pyth reads first (slow, rate limited)
npm run demo -- --threshold-usd 25000   # dollar-bar size in USD (default 50000)
npm run demo -- --time-bar-sec 30       # time-bar length in seconds (default 60)
npm run demo -- --cusum-bps 8           # CUSUM threshold in basis points (default 15)
npm run demo -- --max-age-sec 15        # staleness limit in seconds (default 30)
npm run demo -- --max-slots-behind 40   # staleness limit in slots (default 75)
npm test                                # runs the tests
npm run typecheck                       # optional: type check with tsc
```

`--live` needs internet and is for the presenter. The public RPC endpoint allows only about 10 `getTransaction` calls per 10 seconds, so a live fetch takes minutes there (the code spaces its calls out and backs off on HTTP 429 with a message). If an endpoint answers 429 or is unreachable, the demo says so in plain words and falls back to `--recorded`. Do not run `--live` on 10 laptops at once: students use `--recorded`.

The demo prints four sections and writes four files to `code/out/` (the interactive demos in `lab/` read them):

| File | What it holds |
|---|---|
| `swaps.json` | the real swaps used (after dropping dust and outliers), oldest first: time, slot, side, SOL and USDC amounts, price, transaction signature |
| `bars.json` | `timeBars` and `dollarBars` (open, high, low, close, `volumeUsd`, `count`) and their counts; seconds with no swaps make no time bar and are counted in `emptyTimeBars` |
| `cusum.json` | one price tick per second with the two CUSUM buckets (`sPos` is 0 or more, `sNeg` is 0 or less), the events, and the agent-call counts |
| `staleness.json` | real Pyth reads every 5 s with `ageSec` and `slotsBehind`, plus a **simulated** frozen-feed fault (`simulated: true` on those points, `injectedFault`) |

Notes on the files: a dollar bar closes when its volume reaches the threshold; the swap that crosses the line stays in that bar, so a bar can be a little bigger than the threshold, and the last bar may be unfinished (`lastDollarBarPartial`). Time bars at the very start and end of the window may cover only part of a minute because the recording started and stopped mid-minute. Because every swap goes in exactly one bar, the volume of the bars always adds up to the volume of the swaps (a test checks this).

## Expected output

See "Expected output" at the end of this file (pasted from a real run) and the full transcript in `code/DRY-RUN-EVIDENCE.md`. With `--recorded` your numbers are the same as ours.

## How swaps are found (so you can check it)

1. Read the Orca Whirlpool account for the SOL/USDC pool: it stores the addresses of its two token vaults (where the pool keeps its SOL and USDC).
2. `getSignaturesForAddress(pool)` lists transactions that touched the pool, newest first. About three out of four failed on chain (bots), and many successful ones were not swaps; both are skipped and counted.
3. `getTransaction(signature, jsonParsed)` returns each vault's balance before and after. A swap moves the two vaults in **opposite** directions: SOL vault up and USDC vault down means the trader sold SOL; the reverse means a buy. Price = USDC moved / SOL moved (it includes the 0.04% pool fee).
4. Limits: a transaction that swaps in this pool more than once, or also adds liquidity, shows only the net change, so a few odd swaps appear. The demo drops swaps under 1 USDC and swaps more than 1% away from the median price of their 21 neighbours, and prints how many.

## Files to read (each is short)

| File | Read it to learn |
|---|---|
| `code/src/bars.ts` | time bars and dollar bars in about 40 lines |
| `code/src/cusum.ts` | the CUSUM bucket in about 30 lines |
| `code/src/staleness.ts` | the staleness check: `isFresh(ageSec, slotsBehind, limits)` |
| `code/src/swaps.ts` | real swaps from pool vault balance changes |
| `code/src/pyth.ts` | Pyth price, publish time and posted slot decoded from an on-chain account (from build night 1) |
| `code/src/collect.ts` | presenter recorder for swaps and Pyth reads |
| `code/recorded/` | the real captured data and `SOURCES.md` (endpoints, times, limits) |

## Mission (20 minutes)

Run the sample bar builder, **predict the bar count first**, then change the threshold (or the token) and chart the before and after. Keep your first chart so the "before" is honest.

## Build menu and branch out

Pick a tier. Push your work to your own branch and bring a chart next Thursday (Workshop 2).

**Beginner (no AI credits needed)**
- Hand-edit one number: `npm run demo -- --threshold-usd 25000`, then `--threshold-usd 100000`. Predict the dollar-bar count before each run, then compare. Or open `src/demo.ts` and change `num("cusum-bps", 15)` to `8`.
- Run with `--cusum-bps 5`, `15`, `40`. How many agent calls does each save compared with waking on every tick?
- Run with `--max-age-sec 10` and see how many real Pyth reads get flagged.

**Standard**
- Build a change-alert bot: take the `events` from `out/cusum.json` and print one alert line per event.
- Build a staleness monitor: read Pyth every 5 s with `readPyth()` from `src/pyth.ts` and print `ok` or `STALE` using `isFresh`.
- Wire bars into a Session 0 strategy: feed dollar-bar closes instead of one-minute prices and compare how many times the strategy is asked to decide.
- Chart bars before and after a threshold change (the lab demos draw the same data).

**Advanced**
- Bars for another token: point `src/orca.ts` at another Whirlpool, change the vault and mint checks in `loadVaults`, record it with `npm run collect -- swaps --count 1500`, and compare bar counts.
- Make the CUSUM threshold adapt to recent volatility, then test whether the event count stays steady in quiet and busy periods.
- Combine alerts: only wake the agent when CUSUM fires **and** the Pyth check says the price is fresh.
- (Devnet Memo transaction per decision: not included here; needs devnet SOL and a throwaway key outside the repo.)

## Notes for the presenter

- Recorded data was captured live on 2026-10-21 (UTC); endpoints, times and limits are in `code/recorded/SOURCES.md`.
- `npm run collect -- pyth --minutes 25` records Pyth reads; `npm run collect -- swaps --count 1500` records swaps (set `SOLANA_RPC_URL` to another public endpoint for speed, see `SOURCES.md`). Both overwrite files in `recorded/`.
- Public RPC and API endpoints are rate limited.

## Expected output (recorded mode)

From a real run of `npm run demo` (full transcript in `code/DRY-RUN-EVIDENCE.md`):

```
Data collection (recorded) 2026-10-21T19:03:24.123Z   pool Czfq3xZZ... (SOL/USDC, Orca)
2,900 real swaps recorded, 2 duplicates, 134 dust (< 1 USDC) and 5 price outliers (> 1% from neighbours) dropped, 2,759 used, 17:48:13 to 18:30:20 UTC (42.1 min), 2,322,236 USD traded

Bars: 60-second time bars versus 50,000 USD dollar bars on the same swaps
  time bars   : 43 bars (0 empty)  volume per bar 58 to 118,660 USD
  dollar bars : 44 bars (last one unfinished)  took 1 s to 167 s to fill (median 52 s)
  busiest minute 18:14:00: 118,660 USD -> 2 dollar bars; quietest minute 17:52:00: 58 USD -> 0 dollar bars
  check: both sets of bars add up to the same total volume

CUSUM change filter: threshold 15 bps on 681 one-second price ticks
  agent wakes every tick : 681 calls
  agent wakes on events  : 24 calls (13 up, 11 down)  = 96.5% fewer
    17:49:50 down at 108.42
    17:51:07 down at 108.21
    17:51:10 up   at 108.44
    17:53:37 up   at 108.60
    17:55:29 down at 108.43
    ... 19 more in out/cusum.json

Staleness check: 313 real Pyth reads over 26.0 min (limits: age 30 s, 75 slots behind)
  real data    : max age 51 s, max 227 slots behind, 16 of 187 reads flagged stale
  SIMULATED fault (frozen feed, repeats the last real value) from 18:29:07 UTC:
    caught 10 s after the freeze began; 126 reads after it, last one age 636 s / 2965 slots -> STALE

Wrote swaps.json, bars.json, cusum.json, staleness.json to code/out/
```

Read it like this: the same 2,759 swaps become 43 one-minute bars or 44 dollar bars, but the minute with the most trading (18:14) holds two dollar bars while a quiet minute (17:52, 58 USD traded) holds none. The CUSUM filter turns 681 one-second ticks into 24 events, so an agent that wakes only on events makes about 96% fewer calls. The staleness check flagged 16 real reads where the Pyth account really did pause for 30 to 50 seconds, and it catches the SIMULATED frozen feed within 10 seconds of the freeze. These numbers describe one 42-minute window on one night; not advice.
