# Dry-run evidence (Build night 4, validation-lab)

Run on Thu 22 Oct 2026 (macOS, Node v24.22.0) from a clean state: `node_modules/` deleted first, then the commands below. Output is verbatim. Recorded mode needs no network. `npm run demo -- --live` (presenter option) was checked separately; see the end of this file.

```
$ node --version
v24.22.0

$ rm -rf node_modules && npm install

added 3 packages, and audited 4 packages in 388ms

found 0 vulnerabilities

$ npm run typecheck

> validation-lab@1.0.0 typecheck
> tsc --noEmit


$ npm test

> validation-lab@1.0.0 test
> node --test test/*.test.ts

✔ healthy recorded feed: no alarm over the whole 40 minutes (1.570416ms)
✔ simulated freeze: alarm fires after the freeze and within two minutes (0.474ms)
✔ a bigger market move after the freeze raises the alarm sooner (0.7335ms)
✔ constructed series: a level shift of 5 standard deviations is caught within a few samples, a flat line never (0.21875ms)
✔ no fault: every order is accepted and nothing is lost (1.58225ms)
✔ stale oracle: the hook lets the first minute through and rejects every later order for age (0.256667ms)
✔ stale oracle with a tighter age limit rejects sooner (0.286167ms)
✔ RPC outage: frozen prices, the hook catches it by oracle age after a minute (0.503084ms)
✔ slippage shock and fee change: the hook is blind (this is the test that should fail until you add a rule) (0.328917ms)
✔ circuit breaker halts after 3 fills worse than the slippage budget (0.292167ms)
✔ duplicate submission: the stateless hook accepts both copies; an idempotency guard blocks the second (0.328833ms)
✔ back-off makes far fewer calls than a one-second retry during a 5 minute 429 outage (0.072167ms)
✔ the vendored risk hook itself is unchanged: stale oracle is rejected at 61 s, accepted at 60 s (0.074583ms)
✔ causality test flags the planted leak (the signal changes when the future is cut off) (5.092459ms)
✔ causality test passes the fixed strategy on every moment (1.168375ms)
✔ regression test for the leak: tomorrow's price cannot change today's decision (0.336333ms)
✔ the leaky version looks better than the fixed one on the same prices (that is what a leak does) (2.21825ms)
✔ every file is labelled recorded and simulated-not-advice, and has no NaN (8.083916ms)
✔ splits.json: grid covers both modes, five horizons, purge on and off, embargo 0..30 (0.944125ms)
✔ leaky.json: causality shows the leak and the fix (0.174375ms)
✔ overfit.json: 20 draws of 50, curve of best-of-N, summary (1.329167ms)
✔ faults.json: five faults, each with hook-only and extra-guard summaries; the hook is blind to slippage, fees and duplicates (0.934667ms)
✔ breaks.json: no alarm on the healthy feed, alarm after the simulated freeze (0.146333ms)
✔ random strategies: same seed, same list; 50 of them from four families (1.101417ms)
✔ time split with a gap: in-sample trades close before the cut, out-of-sample trades open after cut + gap, the rest are purged (31.427833ms)
✔ best of the first N: never gets worse as N grows, and the luck benchmark grows (13.293ms)
✔ the in-sample winner of 50 tries scores lower out-of-sample, on average over 20 draws (before costs) (112.372125ms)
✔ with realistic costs no random strategy makes money on this calm window (honest result, not tuned) (12.785625ms)
✔ accepts an order inside every limit (0.766292ms)
✔ max-notional: rejects above the limit, accepts exactly at it (0.134834ms)
✔ max-oracle-gap: 51 bps rejected, 50 bps accepted (0.075417ms)
✔ max-oracle-age: stale oracle is rejected (0.063833ms)
✔ unit-sanity: cents, negative, zero, NaN and bad side are rejected (0.089584ms)
✔ limits are parameters: raising max notional lets the big order through (0.057334ms)
✔ pure: same input gives same output and the input is not changed (0.073083ms)
✔ HTTP 429 raises a clear RateLimitError, never a silent failure (13.689417ms)
  429 rate limited; waiting 1s (attempt 1/3)
✔ rpcCall backs off on 429 and then succeeds (1008.979292ms)
✔ contiguous folds: test sets are consecutive blocks that do not overlap and cover every moment once (2.139625ms)
✔ purge: no kept training moment has a label that overlaps a test label (6.019084ms)
✔ without purge the same neighbours are kept (that is the leak), and the counts add up (0.732542ms)
✔ embargo removes extra moments after the test block (1.770833ms)
✔ shuffled folds have the same number of moments but they are scattered (1.322ms)
✔ leakAccuracy on the recorded series: shuffled folds look better than contiguous folds; purged shuffled has nothing to train on (23.110667ms)
✔ leakAccuracy is deterministic (6.248334ms)
✔ normInv matches known values (0.44ms)
✔ rng: same seed, same numbers; different seed, different numbers (0.635625ms)
✔ sharpeLike: mean over standard deviation, null when there is too little to say (0.142708ms)
✔ luck benchmark: zero for one try, grows with the number of tries (0.106833ms)
✔ vendored build-night-1 strategies still give exactly the build-night-1 numbers (4.912042ms)
✔ the per-trade detail added in 0007 adds up to the totals and spans are ordered (3.063667ms)
ℹ tests 50
ℹ suites 0
ℹ pass 50
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1166.1055

$ npm run demo -- --recorded

> validation-lab@1.0.0 demo
> node src/demo.ts --recorded

Backtest validation lab (recorded). Recorded series: 481 samples every 5s, 01:13 to 01:53 SGT (Wed 21 Oct 2026 UTC evening). Simulated, on recorded data; not advice.

0. Vendored build-night-1 strategies (fee 5 + slippage 2 bps per leg, 1000 USD per trade)
   Cross-venue arbitrage      trades   0  gross    0.00  net    0.00
   Pool vs oracle basis       trades  19  gross    1.31  net  -25.29
   Moving-average trend       trades  10  gross    0.61  net  -13.39
   Mean reversion (z-score)   trades   9  gross    1.03  net  -11.57
   Market maker around Pyth   trades   7  gross    0.05  net   -3.45

1. Split leakage: a memoriser guesses "does the price rise over the next h samples?" (5 folds, 433 test moments; balanced accuracy, so a coin flip or always guessing one side is 50%)
   h    shuffled folds   contiguous folds   contiguous + purge + embargo 12   shuffled + purge (n/a = nothing left to train on)
    6        49.3%           45.4%                    46.4%            51.2%
   12        55.8%           53.7%                    52.6%              n/a
   24        60.4%           54.1%                    53.9%              n/a
   36        56.9%           44.8%                    44.1%              n/a
   48        56.8%           44.1%                    35.3%              n/a

2. Planted leak (src/leaky.ts): trend 2/10 written two ways
   leaky : 61 trades, net 18.84 USD before costs, -66.56 after; causality test: 37 of 440 moments change when the future is cut off (first at sample 41)
   fixed : 61 trades, net -1.76 USD before costs, -87.16 after; causality test: 0 of 440 change

3. Best of many tries (50 random strategies per draw, 20 draws; in-sample = first 288 samples, out-of-sample = after a 12-sample gap; score = mean/std of trade P&L)
   draw 1: best in-sample is coin-flip #704396 hold18 (score 1.00, 8 trades) -> out-of-sample score 0.17; luck benchmark for 50 tries 0.76; deflated 0.25; out-of-sample rank 30 of 48
   all 20 draws before costs: mean best in-sample score 0.507, same strategy out-of-sample 0.115; best beats its luck benchmark in 4 draws; median out-of-sample rank of the in-sample winner 28
   with 5+2 bps costs: mean best in-sample score -1.394, out-of-sample -4.376; the winner is still positive after costs out-of-sample in 0 of 20 draws

4. Failure injection (fault starts at 01:37 SGT, lasts 5 minutes; one 250 USD order every 30 s; risk hook limits 1000 USD, 50 bps, 60 s)
   fault                   orders accepted rejected  rule(s)                        loss with hook   loss with no hook   with extra guards
   stale-oracle               10        2        8  max-oracle-age x8                   $2.02             $10.04   accepted 2, loss $2.02
   rpc-outage                 10        2        8  max-oracle-age x8                   $2.05             $10.17   accepted 2, loss $2.05
   slippage-shock             10       10        0  none (the hook is blind to this)     $10.00             $10.00   accepted 3, loss $3.00
   fee-change                 10       10        0  none (the hook is blind to this)      $6.25              $6.25   accepted 10, loss $6.25
   duplicate-submission       20       20        0  none (the hook is blind to this)      $0.00              $0.00   accepted 10, loss $0.00
   strategies re-priced: slippage 40 bps -> net cross-venue-arb 0.0, basis -169.7, trend -89.4, mean-reversion -80.0, market-maker -3.5
   strategies re-priced: fee 30 bps -> net cross-venue-arb 0.0, basis -120.3, trend -63.4, mean-reversion -56.6, market-maker -20.9
   HTTP 429 for 300 s: a client retrying every second makes 300 calls; with back-off (1, 2, 4 ... 30 s) it makes 14

5. Feed-break alarm on the venue-minus-oracle gap (warm-up 60 samples: mean 2.037 bps, sd 2.719 bps; slack k 0.5, alarm level h 5)
   healthy feed: no alarm   |   simulated freeze at sample 288: ALARM at sample 307, 95 s after the freeze

Wrote splits.json, leaky.json, overfit.json, faults.json, breaks.json to out/
```

## Live check (presenter option)

`npm run demo -- --live` on Thu 22 Oct 2026, last lines (one real Pyth read through the risk hook; on any failure it prints the reason and stays on recorded data):

```
6. Live check (one read of the Pyth SOL/USD account, then the risk hook)
   Pyth SOL/USD 108.1889, published 6 s ago, 12 slots behind -> hook says ACCEPT
```


Not part of the clean run above because it needs the network. The lab's Live mode (browser, `https://solana-rpc.publicnode.com`) was checked in headless Chrome on Thu 22 Oct 2026: each of the four demos showed a changing LIVE pill with a current slot and a real Pyth read, and with `&rpc=http://127.0.0.1:9` each fell back to recorded data with the pill "live unavailable, back to recorded". Details in `deck/QA-REPORT.md` and `demo-repo/lab/README.md`.
