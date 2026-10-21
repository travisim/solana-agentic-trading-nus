# Dry-run evidence

Clean run on macOS, Node v24.22.0, 2026-10-22 03:12 +08 (2026-10-21 19:12 UTC), from `rm -rf node_modules out` in `demo-repo/code`. Commands and verbatim output below. Mode is `--recorded` (default; the test and demo use no network). Results are computed on recorded data from one night; not advice. The frozen Pyth feed is a simulation laid over real reads and is labelled SIMULATED in the output.

## Live verification (2026-10-21, about 19:07 to 19:12 UTC)

Real swaps and Pyth reads fetched live over public RPC (`solana-rpc.publicnode.com`) by `--live` (verbatim, trimmed to the parts that are live; 429 retry lines removed):

```
$ SOLANA_RPC_URL=https://solana-rpc.publicnode.com node src/demo.ts --live --out /tmp/bars-live/
Fetching 200 fresh swaps and 4 live Pyth reads (a minute or two on the public endpoint)...
2026-10-21T19:11:24.761Z fetched=250 swaps=90
2026-10-21T19:11:33.054Z swaps=100/200 scanned=2000
2026-10-21T19:11:49.081Z swaps=200/200 scanned=3000
Data collection (live) 2026-10-21T19:11:49.192Z   pool Czfq3xZZ... (SOL/USDC, Orca)
200 real swaps recorded, 0 duplicates, 3 dust (< 1 USDC) and 0 price outliers (> 1% from neighbours) dropped, 197 used, 19:09:55 to 19:10:56 UTC (1.0 min), 494,533 USD traded
Live Pyth check (real reads taken now; the recorded 26-minute series below is still used for the frozen-feed demo):
  19:11:49 UTC  age 13 s  47 slots behind  -> ok
  19:11:51 UTC  age 5 s  11 slots behind  -> ok
  19:11:53 UTC  age 7 s  19 slots behind  -> ok
  19:11:55 UTC  age 9 s  29 slots behind  -> ok

```

Fallback check (unreachable endpoint), verbatim:

```
$ SOLANA_RPC_URL=http://127.0.0.1:1 node src/demo.ts --live --out /tmp/bars-live-fallback/
Fetching 200 fresh swaps and 4 live Pyth reads (a minute or two on the public endpoint)...
!! live fetch failed: fetch failed
!! Falling back to --recorded data so you can keep going.

```

HTTP 429 handling (message, retry with back-off) is covered by `test/rpc.test.ts` (local server returning 429). The swap method (pool vault balance changes) is covered by `test/swaps.test.ts` on two real transactions; see `code/recorded/SOURCES.md`.

## Clean install, tests, demo

```
$ npm install

added 3 packages, and audited 4 packages in 577ms

found 0 vulnerabilities

$ npm test

> bars-alerts@1.0.0 test
> node --test test/*.test.ts

✔ time bars: OHLC, volume and count per clock slot (0.862875ms)
✔ time bars: empty slots are counted, not drawn (0.091541ms)
✔ dollar bars: a bar closes when the threshold is reached (0.098084ms)
✔ dollar bars: the crossing swap stays in the bar, and the last bar may be unfinished (0.085041ms)
✔ volume conservation: bars add up to the swaps, for several thresholds and bar lengths (0.129667ms)
✔ quiet versus busy: busy swaps make many dollar bars, quiet swaps make few (0.818417ms)
✔ bad parameters are rejected (0.224458ms)
✔ fires exactly when the running total crosses the threshold, then resets (0.871083ms)
✔ down moves fill the other bucket (0.100292ms)
✔ wiggles that cancel out never fire (0.179541ms)
✔ below the threshold does not fire; just over does (0.563083ms)
✔ stats: agent calls every tick versus on events (0.077958ms)
✔ toTicks keeps the last price in each window (0.098541ms)
✔ bad threshold is rejected (0.216542ms)
✔ swaps.json: 1500+ real swaps, oldest first (4.740125ms)
✔ bars.json: both kinds of bars add up to the swaps (1.557375ms)
✔ cusum.json: events are a small subset of ticks (0.505084ms)
✔ staleness.json: 20+ minutes every 5 s of real reads, fault labelled as simulated (0.498792ms)
✔ HTTP 429 raises a clear RateLimitError, never a silent failure (12.259041ms)
  429 rate limited; waiting 1s (attempt 1/3)
✔ rpcCall backs off on 429 and then succeeds (1017.807625ms)
✔ isFresh checks both age and slots (0.399708ms)
✔ a healthy feed is never flagged, and the simulated freeze is caught (0.282291ms)
✔ slot lag alone can flag a price (0.086584ms)
✔ needs enough reads (0.185458ms)
✔ a real buy and a real sell are decoded from the pool vault balance changes (0.937083ms)
✔ a failed transaction is not a swap (0.227833ms)
✔ vault balances that move the same way (liquidity change) are not a swap (0.211417ms)
✔ a transaction that does not touch the vaults is not a swap (0.053791ms)
✔ Pyth: decodes a real captured PriceUpdateV2 account (publish time and posted slot) (0.698ms)
✔ filterSwaps drops dust and price outliers, and nothing else (0.342792ms)
ℹ tests 30
ℹ suites 0
ℹ pass 30
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1188.352459

$ npm run demo

> bars-alerts@1.0.0 demo
> node src/demo.ts

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

Wrote swaps.json, bars.json, cusum.json, staleness.json to out/
```
