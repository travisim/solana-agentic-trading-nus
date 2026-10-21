# Dry-run evidence

Clean run on macOS, Node v24.22.0, 2026-10-22 01:54 SGT (2026-10-21 17:54 UTC), from `rm -rf node_modules out` in `demo-repo/code`. Commands and verbatim output below. Mode is `--recorded` (default; no network used by test or demo). Strategy numbers are untuned: net is negative for every strategy once 5 bps fee + 2 bps slippage per leg are charged, and the cross-venue arbitrage never fires because the largest Jupiter vs Orca gap in the 40-minute window (6.3 bps) is below its 8 bps entry threshold. Simulated on recorded data; not advice.

## Live collector verification (2026-10-21, ~17:13 to 17:16 UTC)

`node src/demo.ts --live` (verbatim, first lines):

```
Data collection (live) 2026-10-21T17:16:13.750Z   pair SOL/USDC
Venue                  Price (USD)  Gap vs Pyth
Jupiter quote             108.0914  0.9 bps
Pyth oracle               108.0812  
Orca SOL/USDC pool        108.0809  -0.0 bps
```

Fallback check: `SOLANA_RPC_URL=http://127.0.0.1:1 node src/demo.ts --live` printed
`!! live fetch failed: fetch failed` then `!! Falling back to --recorded data so you can keep going.` and continued in recorded mode. HTTP 429 handling is covered by `test/rpc.test.ts` (local server returning 429).

## Clean install, tests, demo

```
Thu Oct 22 01:54:30 +08 2026
$ npm install

added 3 packages, and audited 4 packages in 514ms

found 0 vulnerabilities

$ npm test

> data-risk@1.0.0 test
> node --test test/*.test.ts

✔ Pyth: decodes a real captured PriceUpdateV2 account (1.458208ms)
✔ Pyth: rejects a wrong account (0.231708ms)
✔ Orca: price from sqrtPrice for a known value (0.079166ms)
✔ Orca: decodes a real captured whirlpool account, and it agrees with Pyth within 0.5% (0.499708ms)
✔ base58 encodes the SOL mint (0.087625ms)
✔ Jupiter: outAmount (USDC, 6 decimals) becomes a USD price for 1 SOL (0.060833ms)
✔ gap in bps (0.0565ms)
✔ prices.json matches the data contract (0.883792ms)
✔ series.json has 300+ real points every 5 s (0.937834ms)
✔ risk.json has four rules and 8+ decisions covering every rule (0.160709ms)
✔ strategies.json has the five strategies with numeric fields (0.182166ms)
✔ accepts an order inside every limit (0.791208ms)
✔ max-notional: rejects above the limit, accepts exactly at it (0.142958ms)
✔ max-oracle-gap: 51 bps rejected, 50 bps accepted (0.077666ms)
✔ max-oracle-age: stale oracle is rejected (0.060042ms)
✔ unit-sanity: cents, negative, zero, NaN and bad side are rejected (0.081084ms)
✔ limits are parameters: raising max notional lets the big order through (0.052ms)
✔ pure: same input gives same output and the input is not changed (0.061ms)
✔ HTTP 429 raises a clear RateLimitError, never a silent failure (12.649625ms)
✔ cross-venue arb: constant 20 bps gap, 10 samples (0.594958ms)
✔ cross-venue arb: a gap smaller than the threshold makes no trade (0.083167ms)
✔ basis: pool rich vs oracle then converges -> one winning short (0.104042ms)
✔ accounting identity holds for every strategy: net = gross - trades x legs x cost (2.424125ms)
✔ costs never improve a result; zero costs give net = gross (2.229125ms)
✔ trend and mean reversion: flat prices make no trades (0.468625ms)
✔ trend: a rise then a fall closes at least one trade (0.315167ms)
✔ market maker: bid gets filled, price recovers -> positive gross (0.065958ms)
ℹ tests 27
ℹ suites 0
ℹ pass 27
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 147.002458

$ npm run demo

> data-risk@1.0.0 demo
> node src/demo.ts

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

Wrote prices.json, series.json, risk.json, strategies.json to out/

$ npx tsc --noEmit (typecheck)
exit: 0
Thu Oct 22 01:54:32 +08 2026
```
