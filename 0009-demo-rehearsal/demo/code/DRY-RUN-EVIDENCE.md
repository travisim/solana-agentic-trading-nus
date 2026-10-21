# Dry-run evidence: Build night 5 sample code

Run on 21 Oct 2026 (UTC) on macOS, Node v24.22.0, from a clean copy of `demo-repo/code` (no `node_modules`, empty `out/`, no `.devnet-key.json`). Output below is verbatim from the terminal. Note: the first `npm test` on a fresh checkout skips the 5 tests that read `out/*.json`; after `npm run demo` they run (51 of 51). In the repo `out/` is committed, so students see 51 passing straight away.

Devnet: `recorded/devnet-reads.json` was captured separately with `node src/collect.ts devnet` (see `recorded/SOURCES.md`). The public faucet answered HTTP 429, so `npm run devnet` (a funded Memo transaction) is NOT verified end to end. The signature and message format were verified with `simulateTransaction`.

```
$ node -v
v24.22.0
$ npm install

added 3 packages, and audited 4 packages in 414ms

found 0 vulnerabilities

$ npm test   (fresh checkout with an empty out/: the tests that read out/ are skipped)
✔ one part way over fails even if the total is fine (0.0675ms)
✔ going over 3:00 fails; missing parts do not pass (0.08ms)
✔ evaluateChecks: timing checks come from the timer, content checks from listeners (0.160875ms)
✔ the check list includes no-return-claim and a limitation (0.08025ms)
ℹ tests 51
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 5
ℹ todo 0
ℹ duration_ms 161.976834

$ npm run demo -- --recorded

> demo-rehearsal@1.0.0 demo

> demo-rehearsal@1.0.0 demo
> node src/demo.ts --recorded
...

$ npm run report
  ...
1..51
# tests 51
# suites 0
# pass 51
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 150.939458

$ npm run demo -- --recorded   (second run, now counts the test report)

> demo-rehearsal@1.0.0 demo
> node src/demo.ts --recorded

Sample project (recorded data, 2026-10-21)   Pyth + Orca SOL/USDC, 18:13:46 to 18:30:20 UTC
  1,114 real swaps -> 51 dollar bars (20,000 USD) -> 10 change alerts (8 bps)
  risk limits: 1,000 USD per order, 50 bps from oracle, 60 s oracle age

   #  time      side  size USD  vs oracle  decision
   1  18:14:21  buy        802    6.6 bps  ACCEPT
   2  18:15:35  buy        933    6.5 bps  ACCEPT
   3  18:16:36  buy        946    7.9 bps  ACCEPT
   4  18:19:33  sell       941    0.7 bps  ACCEPT
   5  18:22:37  buy        908    6.6 bps  ACCEPT
   6  18:23:22  buy        883    2.5 bps  ACCEPT
   7  18:26:05  buy        879    6.7 bps  ACCEPT
   8  18:27:20  sell      1064    1.0 bps  REJECT [max-notional] 1064 USD exceeds the 1000 USD limit
   9  18:29:07  sell       909    0.4 bps  ACCEPT
  10  18:29:43  buy        858    3.6 bps  ACCEPT

Ledger: 9 fills (fee 4 bps assumed, fill = next swap price). Scorecard, Simulated, on recorded data; not advice:
  accepted 9, rejected 1 (1 max-notional)
  net 3.00 USD at the last price 109.01, hit rate 67%, max drawdown 8.03 USD, position 40.04571 SOL
  (Judges do not score this. They score utility, tests and devnet evidence.)

Failure test (injected bad orders, oracle 108.54):
  REJECT  oversized order                [max-notional] 5000 USD exceeds the 1000 USD limit
  REJECT  stale oracle (300 s old)       [max-oracle-age] oracle is 300 s old, limit is 60 s
  REJECT  price in cents, not dollars    [unit-sanity] price 10853.54 is 100.0x the oracle price 108.54; wrong unit?
  REJECT  100 bps above the oracle       [max-oracle-gap] price is 99.9 bps from the oracle, limit is 50 bps

The 3-minute pitch: Problem 30 s + What it does 35 s + Live proof 75 s + Limit and next 40 s = 180 s, then 120 s of questions
  Problem          50 words ~ 23 s of 30 s  fits
  What it does     57 words ~ 26 s of 35 s  fits
  Live proof       88 words ~ 41 s of 75 s  fits
  Limit and next   53 words ~ 24 s of 40 s  fits
  sample script total ~ 114 s of 180 s (130 words a minute)
  timing verdict for the script read at that pace: PASS

What the judge sees (sample demo pack): 9 of 12 checks
  Utility         4 / 4
  Tests           3 / 4
  Devnet evidence 2 / 4
  missing: t4, d2, d3   No return claim. Good.
  test report: 51 passing, 0 failing

Switch drill (rule: 3 failures in a row -> recorded): continue, continue, retry, retry, fallback, none

Wrote walkthrough.json, inputs.json, pitch.json, rubric.json, drill.json to /private/tmp/claude-501/-Users-r-Downloads-cody-solanaEvents/51ab7ba1-3422-4e2d-9534-b97a851ab0f0/scratchpad/clean9/out/

$ npm test   (out/ now filled)
✔ evaluateChecks: timing checks come from the timer, content checks from listeners (0.160167ms)
✔ the check list includes no-return-claim and a limitation (0.077167ms)
ℹ tests 51
ℹ suites 0
ℹ pass 51
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 146.12125

$ npm run typecheck
> demo-rehearsal@1.0.0 typecheck
> tsc --noEmit

```
