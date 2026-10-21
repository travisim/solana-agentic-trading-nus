# Dry-run evidence (clean copy, recorded data)

Run by the builder on 21 Oct 2026 (macOS, Node v24) in a fresh copy of `demo-repo/code` without `node_modules` or `out/`. Verbatim output below (npm test output trimmed to the summary lines; paths shortened). The numbers come from bundled recorded data (SOL/USDC, 21 Oct 2026, 40 minutes); nothing here is advice.

Also run: lab `node build.mjs`, `node verify.mjs` (all PASS, JS maths equals TypeScript at 0/0, 5/2 and 12/5 bps) and `node check-dom.mjs` (all five demos: Recorded, Live against real public endpoints, forced failure falls back; no NaN/undefined in visible text). Demo 5 Live uses `--disable-web-security` in that check because the devnet RPC allows only the deployed origin, not file://.

```
$ node -v
v24.22.0

$ npm install

added 3 packages, and audited 4 packages in 424ms

found 0 vulnerabilities

$ npm test

> scorecard@1.0.0 test
> node --test test/*.test.ts

✔ Pyth: decodes a real captured PriceUpdateV2 account (0.977458ms)
✔ Pyth: rejects a wrong account (0.240375ms)
✔ Orca: price from sqrtPrice for a known value (0.079292ms)
✔ Orca: decodes a real captured whirlpool account, and it agrees with Pyth within 0.5% (0.510625ms)
✔ base58 encodes the SOL mint (0.092958ms)
✔ Jupiter: outAmount (USDC, 6 decimals) becomes a USD price for 1 SOL (0.115917ms)
✔ gap in bps (0.075042ms)
✔ validateLedger fills defaults and rejects bad shapes (4.407125ms)
✔ allTrades merges strategies, sorted by close time, ids 1..n (3.427ms)
✔ demo prints the scorecard and never prints NaN or undefined (0.555375ms)
✔ ledger.json: time-ordered closed trades on the recorded window (1.047125ms)
✔ scorecard.json: overall equals a fresh computation, and strategies add up (0.768ms)
✔ scorecard totals agree with strategies.json (the earlier sessions' numbers) (0.18ms)
✔ equity.json: starts at capital, same length as the grid, drawdown never negative (0.377375ms)
✔ dashboards.json: five tricks, each with shown/hidden/honest text (0.164083ms)
✔ shipcheck.json: three samples, the verdicts the teaching depends on (0.14575ms)
✔ failure-table.json: more trades, same hit rate, surer failure (0.082875ms)
✔ cost-scenarios.json: costs never help; zero costs equals gross (0.121125ms)
✔ solana-costs.json is a real capture with a date (0.146333ms)
✔ dashboard.html is written and is self-contained (0.161291ms)
✔ --ledger scores your own file; a bad file fails with a clear message (202.489833ms)
✔ HTTP 429 raises a clear RateLimitError, never a silent failure (13.780542ms)
✔ net = gross - legs x (fee + slippage) x notional (0.488292ms)
✔ hand-checked example: wins +10 +10 +10, losses -5 -5 (0.439041ms)
✔ drawdown and time under water on a known path (0.466583ms)
✔ costs can turn a winning ledger into a losing one (0.133875ms)
✔ empty ledger gives nulls, never NaN (0.134167ms)
✔ probability of failure: more trades make the same hit rate more certain (0.937791ms)
✔ break-even and implied hit rate (0.107958ms)
✔ normal CDF (0.060583ms)
✔ on-chain summary is null without on-chain fields, counts failures with them (0.15525ms)
✔ tidy sample passes everything (1.895666ms)
✔ messy sample fails tests and run steps, warns about licence and junk (0.579959ms)
✔ leaky sample is caught by file name and by content, and never prints the secret (0.791792ms)
✔ .env.example is allowed (0.126875ms)
✔ readFolder reads a real folder, skips node_modules and .git (2.281792ms)
✔ cross-venue arb: constant 20 bps gap, 10 samples (0.743541ms)
✔ cross-venue arb: a gap smaller than the threshold makes no trade (0.107042ms)
✔ basis: pool rich vs oracle then converges -> one winning short (0.132916ms)
✔ accounting identity holds for every strategy: net = gross - trades x legs x cost (4.216292ms)
✔ costs never improve a result; zero costs give net = gross (2.845125ms)
✔ trend and mean reversion: flat prices make no trades (0.782833ms)
✔ trend: a rise then a fall closes at least one trade (0.410417ms)
✔ market maker: bid gets filled, price recovers -> positive gross (0.093167ms)
ℹ tests 44
ℹ suites 0
ℹ pass 44
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 395.903459

$ npm run demo -- --recorded

> scorecard@1.0.0 demo
> node src/demo.ts --recorded

Scorecard, simulated on recorded data; not advice. fee 5 bps + slippage 2 bps per leg, capital 10000 USD, window 40 min

Strategy                  Trades     Hit  AvgWin AvgLoss  Payoff  NetUSD   MaxDD  Under%  Turn x   PFail
basis                         19      0%     n/a   -1.33     n/a  -25.29   25.29     99%     3.8     n/a
market-maker                   7     43%   +0.20   -1.02    0.20   -3.45    4.06     94%     0.7     98%
mean-reversion                 9      0%     n/a   -1.29     n/a  -11.57   11.57     80%     1.8     n/a
trend                         10     20%   +0.81   -1.88    0.43  -13.39   13.50     73%     2.0    100%
--------------------------------------------------------------------------------------------------------
ALL (one ledger)              45     11%   +0.45   -1.40    0.32  -53.70   53.70     99%     8.3    100%

One ledger, in words
  45 trades; 11.1% won after costs; the break-even hit rate for these payoffs is 75.8%.
  Gross +3.00 USD, costs -56.70, net -53.70. Costs ate 1892% of the gross profit.
  Max drawdown 53.70 USD (0.54%); under water 99% of the window, longest stretch 40 min.
  Turnover 8.3x capital in 40 minutes (83000 USD traded).
  On-chain fees, tips and failed-transaction rate: n/a (this ledger has no real transactions; we do not guess them).
  What this cannot say: 40 minutes of one quiet night is one path, not a distribution. A good number here is a reason to test more, never a result.

Same ledger, two dashboards (strategy shown: basis)
  misleading: +1.31 USD gross, 37% win rate; +17,182 USD "per year"
  - Gross, not net                 shows P&L +1.31 USD  | hides costs -26.60 USD  | honest: net -25.29 USD
  - Hit rate on gross              shows 37% of trades won  | hides a win that costs more than it earns is a loss  | honest: 0% win after costs
  - Annualised short window        shows +17,182 USD per year  | hides only 40 minutes of data  | honest: 19 trades in 40 minutes
  - Show the best strategy only    shows basis  | hides 3 other strategies, together -28.41 USD net  | honest: all 4 reported
  - No drawdown                    shows win streak of 2  | hides drawdown and time under water  | honest: max drawdown 25.29 USD, 99% of the window under water

Ship check on the sample projects (run it on yours: npm run ship-check -- <folder>)
  tidy-project     ready to ship  14/14 checks pass, 0 fail, 0 warn
  messy-project    not ready      3/14 checks pass, 2 fail, 9 warn
  leaky-project    not ready      9/14 checks pass, 2 fail, 3 warn

Wrote ledger, scorecard, equity, prices, failure-table, cost-scenarios, dashboards, shipcheck, strategies, solana-costs (.json) and dashboard.html to /private<clean-copy>/code/out/

$ npm run typecheck

> scorecard@1.0.0 typecheck
> tsc --noEmit


$ npm run ship-check -- .

> scorecard@1.0.0 ship-check
> node src/shipCli.ts .

Ship check: .

  PASS  README at the top of the project
  PASS  README says how to install and run
  PASS  README names one known limitation
  PASS  README says devnet only, no real funds
  PASS  Tests exist
  PASS  One command runs the tests
  PASS  No .env or keypair files in the project
  PASS  No keys or secrets inside files
  PASS  .gitignore covers .env and node_modules
  PASS  Licence file
  PASS  Demo script or pitch notes
  WARN  Devnet evidence (explorer link or signature)
        no devnet explorer link (.../tx/<signature>?cluster=devnet) in any .md file (templates do not count)
  PASS  Recorded backup for the demo
  PASS  No junk or oversized files

NEARLY READY: 13/14 checks pass, 0 fail, 1 warn

$ npm run smoke

> scorecard@1.0.0 smoke
> node src/smoke.ts

Clean checkout in <tmp>/smoke/code

PASS  npm install --no-audit --no-fund  (0.3 s)
PASS  npm test  (0.5 s)
PASS  npm run demo -- --recorded  (0.2 s)

SMOKE TEST PASSED: a fresh copy installs, tests and runs from the README commands.
```
