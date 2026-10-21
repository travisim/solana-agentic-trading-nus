# Dry-run evidence

Clean run on macOS, Node v24.22.0, 2026-10-22 03:49 +0800 (2026-10-21 19:49 UTC), from `rm -rf node_modules out` in `demo-repo/code`. Commands and verbatim output below. Mode is `--recorded` (default; the tests and the demo use no network). Results are simulated, computed on recorded data from one night; not advice.

## Clean install, tests, demo

```
$ npm install

added 3 packages, and audited 4 packages in 407ms

found 0 vulnerabilities

$ npm test

> ledger-sizer@1.0.0 test
> node --test test/*.test.ts

✔ activeAt: a bet is open from tOpen up to but not including tClose (0.471084ms)
✔ concurrentCounts on two overlapping bets (0.404625ms)
✔ averageUniqueness: no overlap is 1, full overlap is 1/2, half overlap is 3/4 (0.11825ms)
✔ impactBpsFor interpolates between real points and scales below the first (0.4645ms)
✔ maxSizeForImpact inverts the curve (0.160375ms)
✔ execPriceOf: sell and buy directions (0.06975ms)
✔ buildImpactQuotes converts Jupiter percent to bps (0.412625ms)
✔ recorded Jupiter file: two pairs, 16 real quotes each, impact grows with size (0.987ms)
✔ first row chains from the genesis hash, each row chains from the one before (0.786584ms)
✔ replay reconciles a clean ledger to the balance (0.222ms)
✔ editing a number in an old row is caught and the first bad row is named (0.196792ms)
✔ deleting a row breaks the chain (0.149ms)
✔ a balance that does not match the fills is reported even if hashes are recomputed (0.088667ms)
✔ a rejected order moves no money (0.07475ms)
✔ reconcileWith compares the replay to balances read from token accounts (0.110958ms)
✔ append-only file: one JSON line per row, in order (0.855333ms)
✔ the Ledger class has no way to edit or delete rows (0.084958ms)
✔ out/ledger.json: rows replay, jsonl matches json (102.077333ms)
✔ out/equity.json: four runs, curves of [t, equity, exposure] (0.995584ms)
✔ out/concurrency.json: counts and uniqueness are in range (0.505833ms)
✔ out/sizing.json: curve is increasing, impact pairs and inventory present (0.229334ms)
✔ oracleAgeProxy counts seconds since the oracle value last changed (0.774875ms)
✔ signals: a flat series gives none, a sharp move gives a signal on the right side with p in (0.5, 0.95) (0.592166ms)
✔ recorded run: the ledger replays and reconciles to the equity curve (3.550791ms)
✔ the risk hook gates every order: no accepted order is over the notional limit, rejected orders have no fill (1.671209ms)
✔ the two injected bad orders are rejected with the right rule and flagged as injected (2.320417ms)
✔ exposure never goes over the cap by more than one order's rounding (1.0415ms)
✔ costs lower the final equity; same orders, so fees explain the whole difference within impact (1.735875ms)
✔ summing overlapping bets reaches a bigger position than averaging them (2.537333ms)
✔ an impact cap cuts a big order on a thin curve (2.878334ms)
✔ deterministic: two runs give the same head hash (2.778833ms)
✔ normCdf matches known values (0.432708ms)
✔ probToSize: 0.5 and below give 0, grows smoothly with confidence, stays below 1 (0.144625ms)
✔ discretize rounds to the step and never passes the cap (0.142ms)
✔ combineBets: average shares one position, sum stacks and is clipped (0.696709ms)
✔ targetUsdOf scales with equity and the cap, and ignores negative equity (0.099875ms)
✔ capOrderByImpact cuts an order to the largest size under the impact limit (0.264708ms)
✔ decodes a real SPL token account: wrapped SOL mint, owned by the Orca SOL/USDC pool (0.864042ms)
✔ base58 round trip on a known key (0.152292ms)
✔ rejects bytes that are not a token account (0.197ms)
✔ recorded balances file matches the decoder's output shape (0.148708ms)
ℹ tests 41
ℹ suites 0
ℹ pass 41
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 200.363084

$ npm run demo -- --recorded

> ledger-sizer@1.0.0 demo
> node src/demo.ts --recorded

Position sizing and trade ledger (recorded)  481 recorded 5 s points, 17:13:59 to 17:53:59 UTC (40 min), SOL/USDC
Simulated, on recorded data; not advice. Start $10,000, exposure cap 25 % of equity, steps of 0.1, bets last 300 s

1. Confidence to size (z = (p - 1/2) / sqrt(p(1-p)), size = 2*Phi(z) - 1):
   p 0.55 -> 8 %   p 0.60 -> 16 %   p 0.70 -> 34 %   p 0.80 -> 55 %   p 0.90 -> 82 %   p 0.95 -> 96 %

2. Overlapping bets: 37 bets of 300 s; up to 7 open at once, 4.3 on average
   average uniqueness 0.23 (1.00 would mean no overlap)   peak size: averaged 38 % vs summed 100 % of the cap

3. Ledger (out/ledger.jsonl): 38 rows = 36 fills + 2 rejected by the risk hook
   rejected by max-notional: 1
   rejected by unit-sanity: 1
   28 changes were under the 25 USD minimum (no order); 0 orders were cut by the impact cap (5 bps)
   17:27:59 row 12: buy $5,000 REJECTED (max-notional): 5000 USD exceeds the 1000 USD limit   [injected test]
   17:41:59 row 25: buy $100 REJECTED (unit-sanity): price 10868.19 is 100.0x the oracle price 108.69; wrong unit?   [injected test]
   replay: OK, hash chain intact, every row's cash and position match the fills
   cash $9,497.93  position 4.6058 SOL  fees $4.1997  head hash cf04855e75b6b7f2...

4. Equity at the end (marked at the oracle), same orders, same data:
   No costs (before)                      $10,002.35  (+0.024 %)  max drawdown 0.011 %  fees $0.00  impact $0.0000  rejected 2
   With costs (main ledger)                $9,998.14  (-0.019 %)  max drawdown 0.022 %  fees $4.20  impact $0.0053  rejected 2
   Costs + half the cap                    $9,999.07  (-0.009 %)  max drawdown 0.011 %  fees $2.10  impact $0.0034  rejected 2
   Costs + bets summed, not averaged      $10,001.55  (+0.015 %)  max drawdown 0.065 %  fees $3.40  impact $0.0015  rejected 42

5. Real token accounts (recorded, 2026-10-21T19:36:08Z): Orca SOL/USDC pool holds 178,736 SOL and 10,692,375 USDC
   a 1,000 USD order is 0.0094 % of the USDC side of that pool
   SOL/USDC   Jupiter impact at 100,000 USD: 0.005 bps; largest order under 5 bps: over 1,000,000 USD
   ORCA/USDC  Jupiter impact at 100,000 USD: 3.317 bps; largest order under 5 bps: 158,970 USD

Wrote ledger.jsonl, ledger.json, series.json, sizing.json, concurrency.json, equity.json to code/out/

$ npm run typecheck

> ledger-sizer@1.0.0 typecheck
> tsc --noEmit

```

## Live check and fallback

Live mode reads the two real pool token accounts (public RPC `solana-rpc.publicnode.com`) and three real Jupiter quotes; the simulation still runs on the recorded price series. Verbatim:

```
$ node src/demo.ts --live --out <tmp>/ | head -12
Live: reading the two pool token accounts and 3 Jupiter quotes right now (the simulation below still runs on the recorded series)...
  live Jupiter quote, buy 1,000 USD of SOL: priceImpactPct 0 (0.000 bps)
  live Jupiter quote, buy 100,000 USD of SOL: priceImpactPct 0.0000435973505173181835887112 (0.004 bps)
  live Jupiter quote, buy 1,000,000 USD of SOL: priceImpactPct 0.000731723128928449530570539 (0.073 bps)
Position sizing and trade ledger (live pool reads, recorded price series)  481 recorded 5 s points, 17:13:59 to 17:53:59 UTC (40 min), SOL/USDC
Simulated, on recorded data; not advice. Start $10,000, exposure cap 25 % of equity, steps of 0.1, bets last 300 s

1. Confidence to size (z = (p - 1/2) / sqrt(p(1-p)), size = 2*Phi(z) - 1):
   p 0.55 -> 8 %   p 0.60 -> 16 %   p 0.70 -> 34 %   p 0.80 -> 55 %   p 0.90 -> 82 %   p 0.95 -> 96 %

2. Overlapping bets: 37 bets of 300 s; up to 7 open at once, 4.3 on average
   average uniqueness 0.23 (1.00 would mean no overlap)   peak size: averaged 38 % vs summed 100 % of the cap

$ SOLANA_RPC_URL=http://127.0.0.1:1 node src/demo.ts --live --out <tmp>/ | head -6   # unreachable endpoint
Live: reading the two pool token accounts and 3 Jupiter quotes right now (the simulation below still runs on the recorded series)...
!! live read failed: fetch failed
!! Falling back to --recorded data so you can keep going.

Position sizing and trade ledger (recorded)  481 recorded 5 s points, 17:13:59 to 17:53:59 UTC (40 min), SOL/USDC
Simulated, on recorded data; not advice. Start $10,000, exposure cap 25 % of equity, steps of 0.1, bets last 300 s
```

An HTTP 429 from the public RPC is handled by `src/rpc.ts` (message, wait, retry), copied from build night 2 and covered there by a test against a local server; this session adds no new 429 test of its own. Jupiter 429s during recording were retried with a wait and none were skipped.

## Browser demos

Run from `demo-repo/lab`: `node build.mjs`, `node verify.mjs` (every number the demos compute, including all ledger hashes, equals `code/out/*.json`), `./live-check.sh` (Recorded, Live, forced failure in headless Chrome). Results are in `deck/QA-REPORT.md`.
