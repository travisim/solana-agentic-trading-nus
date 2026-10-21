# Dry-run evidence: Workshop 2 sample code (labeler)

Run on 21 Oct 2026 (UTC; Thu 22 Oct Singapore time), macOS, Node v24.22.0, from a clean copy of `demo-repo/code` (no `node_modules`, no `out/`). Output below is verbatim from the terminal (only the folder path is shortened). After the run, `out/*.json` in the clean copy were byte-identical to the files committed in `demo-repo/code/out/` (`cmp` on all seven files, no difference).

## Clean install, tests, typecheck, recorded demo

```
$ node -v
v24.22.0

$ npm install

added 3 packages, and audited 4 packages in 607ms

found 0 vulnerabilities

$ npm test

> labeler@1.0.0 test
> node --test test/*.test.ts

✔ parseReason reads the direction, size, noise ratio and venue gap from plain text (1.544917ms)
✔ a true reason passes (0.2765ms)
✔ a flipped direction is caught (0.110041ms)
✔ an exaggerated size is caught (both the bps and the noise ratio) (0.067ms)
✔ an understated venue gap is caught; a looser claim is fine (0.073291ms)
✔ rounding to one decimal is tolerated (0.057625ms)
✔ text with no facts in it is reported, not passed (0.053625ms)
✔ roll is deterministic and spread out; spanText uses seconds or bars (1.58525ms)
✔ ewmVolBps: first value is null, then the weighted standard deviation of one-step returns (1.208416ms)
✔ barrier width follows volatility but never goes below the floor (1.0215ms)
✔ a jump up through the upper barrier gives +1 and stops there (0.17975ms)
✔ a fall through the lower barrier gives -1 (0.098333ms)
✔ nothing touched before the horizon gives 0 and exits at the vertical barrier (0.073041ms)
✔ the first barrier touched wins, even if the other would be touched later (0.061625ms)
✔ a plain fixed-horizon label can disagree with the triple barrier (0.063584ms)
✔ decisions whose horizon runs past the end of the data are dropped, not guessed (0.107709ms)
✔ wider multiplier means wider barriers and more time-outs on the same data (1.813792ms)
✔ bad settings fail with a clear message (0.310708ms)
✔ base58 decode inverts base58 encode (including the Memo program id and leading zeros) (1.156667ms)
✔ memo line is short JSON with a recomputable hash (0.491291ms)
✔ the message has the Solana legacy layout: header, 2 accounts, blockhash, 1 Memo instruction (0.257833ms)
✔ a signature made with Node's ed25519 verifies and the transaction is signature + message (1.813208ms)
✔ the gate learns a clean rule: high first feature means win (8.67775ms)
✔ a constant feature does not break the fit (std floor) (0.694583ms)
✔ the fit is repeatable (1.5625ms)
✔ tally counts wins and gives a wide +/- when there are few trades (0.117333ms)
✔ ten decisions with a mix of labels, and the key agrees with a by-hand scan of the sheet (1.160292ms)
✔ sheet and key are plain markdown with no NaN or undefined (0.385458ms)
✔ concurrency counts the labels alive at each step (0.743375ms)
✔ non-overlapping labels are fully unique; heavy overlap shrinks uniqueness (0.106875ms)
✔ uniqueness of half-overlapping labels is the mean of 1/c over the life (0.07925ms)
✔ leaking = labels made before the cut that look at or past the cut (0.068292ms)
✔ labels.json: every label is one of three exits and is consistent with the path (1.790584ms)
✔ agent.json: outcomes follow the labels; the checker catches every injected error and raises no false alarm (0.819083ms)
✔ overlap.json: leakage is real and purging removes it (0.421167ms)
✔ meta.json: purged trades never train the gate; counts add up; probabilities are probabilities (0.23725ms)
✔ sources.json and lanes.json exist and have the expected shape (0.548167ms)
✔ the run is repeatable: same inputs give byte-identical files (125.207292ms)
✔ other settings and the swaps source also run (and --help-free errors are clear) (357.289666ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 722.864375

$ npm run typecheck

> labeler@1.0.0 typecheck
> tsc --noEmit


$ npm run demo -- --recorded

> labeler@1.0.0 demo
> node src/demo.ts --recorded

Labeling data (recorded) 2026-10-21T17:53:59.000Z   SOL/USDC, orca price every 5 s; second venue for the gap check: pyth
481 samples, one every 5 s; 17:13:59 to 17:53:59 UTC, price 107.99 to 108.68

Triple-barrier labels: width = 0.8 x noise over 24 steps (floor 2 bps), a decision every 2 steps
  219 decisions labelled (11 dropped at the end: their horizon runs past the data)
  upper barrier 118 (54%), lower barrier 56 (26%), time ran out 45 (21%)
  average barrier width 3.36 bps, average hold 13.43 steps
  a plain "sign after 24 steps" label disagrees with the triple barrier on 57 of 219 decisions (26%)
  the same labels computed on the pyth price agree on 61.2% of 219 decisions
  the same labels computed on the jupiter price agree on 67.1% of 219 decisions

Why labels leak: each label looks 24 steps ahead, and a decision comes every 2
  on average 6.947 labels are alive at the same moment (at most 13); average uniqueness 0.1563
  219 labels carry about 34.219 independent observations
  cut train/test at step 282: 9 training labels reach into the test period (purged before fitting the gate)

Pretend agent (momentum rule, 12-step look-back, acts at 1x noise), reasons graded by the checker
  219 decisions: 143 trades, 76 holds. Trades: 73 wins, 43 losses, 27 timed out -> hit rate 51%
  43 reasons were given one SIMULATED wrong claim on purpose; the checker flagged 43 (43 caught, 0 missed, 0 false alarms)
  these are gross results: a round trip costs about 8 bps in pool fees alone, and only 0 of the 73 wins had a barrier at least that wide
  hit rate of trades whose reason was true: 51.3% (113); whose reason had a wrong claim: 50% (30)
  example 17:16:39: "Buy: SOL fell 9.7 bps in the last 60 s, 2.2x the recent noise, so follow the move. The two venues agree within 4.0 bps."
    -> checker: says it fell, the data says it rose; outcome loss

Meta-gate (logistic regression on 3 features; train 82 trades, 6 purged, test 55)
  threshold 0.5244 (training win rate 52.4%)
  test, no gate    : 55 trades, hit rate 45.5% (+/- 13.2)
  test, with gate  : 47 trades, hit rate 48.9% (+/- 14.3)   blocked 8, of which 2 would have won
  test, gate fitted without purging: 49 trades, hit rate 46.9% (+/- 14)
  Simulated, on recorded data; not advice. small samples: compare hit rates only together with the +/- column.

Same agent on three price paths (labels differ because the paths differ):
  pyth     up  86  down  45  time  88  width 7.42 bps  67 trades, hit rate 14.9%
  jupiter  up  94  down  58  time  67  width 7.22 bps  75 trades, hit rate 32%
  orca     up 118  down  56  time  45  width 3.36 bps  143 trades, hit rate 51%

Wrote labels.json, agent.json, overlap.json, meta.json, sources.json, series.json, lanes.json, minilab.md and minilab-answers.md to <clean copy>/code/out/

$ npm run memo -- --build

> labeler@1.0.0 memo
> node src/memo.ts --build

{"app":"labeler","i":20,"t":1792602939,"side":"sell","label":1,"h":"b77d9610847aaf99"}
  message 191 bytes; with the signature the transaction is 256 bytes (limit 1,232)
{"app":"labeler","i":26,"t":1792602969,"side":"buy","label":0,"h":"13a9ae3b8efb9091"}
  message 190 bytes; with the signature the transaction is 255 bytes (limit 1,232)
{"app":"labeler","i":28,"t":1792602979,"side":"buy","label":0,"h":"0747d66dc7fb8e8e"}
  message 190 bytes; with the signature the transaction is 255 bytes (limit 1,232)

Nothing was sent. Use --simulate (dry run on devnet) or --send (needs a funded throwaway key).
```

## Devnet dry run of the Memo transaction (nothing sent)

`node src/memo.ts --simulate --payer <a public devnet address that holds SOL> --write`, three transactions, saved in `recorded/devnet-simulation.json`: each answered `err: null` with the Memo program logging the exact memo text, 44,922 to 45,286 compute units of 200,000. Sending (`--send`) was attempted with a fresh throwaway key and stopped at the faucet:

```
throwaway devnet key: <address> (new, saved in code/.keys/, git-ignored)
airdrop refused: HTTP 429 (rate limited) from api.devnet.solana.com. The public endpoint is asking us to slow down. ...
Balance 0 lamports is too low. Send a little DEVNET SOL to <address> (for example from a lead's pre-funded wallet), then run --send again.
```

The throwaway key was deleted after the test. No devnet transaction was sent.

## Live run (presenter option)

`npm run demo -- --live` on 21 Oct 2026 19:51 to 19:58 UTC: 73 real samples from Jupiter, Pyth and Orca (0 failed reads), labelled with a 12-step time limit; it writes to `out-live/`, never over `out/`. Output:

```
Got 73 samples (0 failed). Using a short horizon: 12 steps.

Labeling data (live) 2026-10-21T19:57:43.401Z   SOL/USDC, orca price every 5 s; second venue for the gap check: pyth
73 samples, one every 5 s; 19:51:43 to 19:57:43 UTC, price 108.13 to 108.28

Triple-barrier labels: width = 0.8 x noise over 12 steps (floor 2 bps), a decision every 2 steps
  27 decisions labelled (5 dropped at the end: their horizon runs past the data)
  upper barrier 9 (33%), lower barrier 1 (4%), time ran out 17 (63%)
  average barrier width 2.6 bps, average hold 10.04 steps
  a plain "sign after 12 steps" label disagrees with the triple barrier on 17 of 27 decisions (63%)
  the same labels computed on the pyth price agree on 77.8% of 27 decisions
  the same labels computed on the jupiter price agree on 63% of 27 decisions

Why labels leak: each label looks 12 steps ahead, and a decision comes every 2
  on average 4.885 labels are alive at the same moment (at most 7); average uniqueness 0.2341
  27 labels carry about 6.321 independent observations
  cut train/test at step 40: 6 training labels reach into the test period (purged before fitting the gate)

Pretend agent (momentum rule, 6-step look-back, acts at 1x noise), reasons graded by the checker
  27 decisions: 14 trades, 13 holds. Trades: 1 wins, 5 losses, 8 timed out -> hit rate 7.1%
  3 reasons were given one SIMULATED wrong claim on purpose; the checker flagged 3 (3 caught, 0 missed, 0 false alarms)
  these are gross results: a round trip costs about 8 bps in pool fees alone, and only 0 of the 1 wins had a barrier at least that wide
  hit rate of trades whose reason was true: 9.1% (11); whose reason had a wrong claim: 0% (3)
  example 19:53:33: "Buy: SOL rose 6.2 bps in the last 30 s, 1.7x the recent noise, so follow the move. The two venues agree within 0.4 bps."
    -> checker: says venues agree within 0.4 bps, the gap is 1.9 bps; outcome timeout

Meta-gate (logistic regression on 3 features; train 8 trades, 2 purged, test 4)
  threshold 0.125 (training win rate 12.5%)
  test, no gate    : 4 trades, hit rate 0% (+/- 0)
  test, with gate  : 0 trades   blocked 4, of which 0 would have won
  test, gate fitted without purging: 0 trades
  Simulated, on live data; not advice. small samples: compare hit rates only together with the +/- column.
  This live window is only 73 samples (6 minutes): it shows the pipeline running on fresh data, it is too short to conclude anything.

Same agent on three price paths (labels differ because the paths differ):
  pyth     up  13  down   3  time  11  width 4.82 bps  8 trades, hit rate 25%
  jupiter  up  12  down   4  time  11  width 5.13 bps  7 trades, hit rate 14.3%
  orca     up   9  down   1  time  17  width 2.6 bps  14 trades, hit rate 7.1%

Wrote labels.json, agent.json, overlap.json, meta.json, sources.json, series.json, lanes.json to <code>/out-live/
```

(The first lines of the run were progress prints, one every 30 seconds, `points=1 ... points=73 failures=0`.) This window is far too short to conclude anything: it shows the pipeline on fresh data.

## Not verified

- `npm run memo -- --send` end to end (faucet refused; see above).
- Windows and Linux; only macOS with Node 24.22.0 was run.
