# Q&A prep: Build night 4, Backtest Validation and Failure Testing

For Travis (and the leads) to answer questions while presenting. Grouped by slide number and demo. Slide numbers refer to the 25-slide deck listed in `CONTRACT.md`. Answers are written to be said aloud. This file may name the book (Marcos Lopez de Prado, *Advances in Financial Machine Learning*) as the inspiration for ideas; slides do not.

Facts below come from `demo-repo/code/out/*.json` (also printed by `npm run demo -- --recorded`) and the recorded series in `demo-repo/code/recorded/`: 481 samples, one every 5 seconds, 01:13 to 01:53 SGT on Thu 22 Oct 2026 (17:13 to 17:53 UTC on Wed 21 Oct), prices from Jupiter, Pyth and Orca for SOL/USDC. **Re-check these numbers after any re-run** (`out/*.json`, `notes/CONTRACT.md` headline numbers):

- **Split leakage** (a memoriser guesses whether the price rises over the next h samples; 5 folds, 433 test moments; balanced accuracy: the average of the hit rate on rising moments and on falling moments, so always guessing one side scores 50%; one standard error is about 2.4 points). Shuffled folds versus contiguous folds with purge and embargo 12: h=6 49.3% vs 46.4%; h=12 55.8% vs 52.6%; h=24 60.4% vs 53.9%; h=36 56.9% vs 44.1%; h=48 56.8% vs 35.3%. Contiguous folds without purge at h=24: 54.1%. Shuffled folds with a purge leave too few training moments to score at h=12 and above (n/a); at h=6 the result is 51.2%. Why balanced: this window drifts up, so always guessing "up" already scores 63.5% raw at h=24 and the raw hit rates (64.2% shuffled, 59.1% purged) would be misleading.
- **Planted leak** (trend with 2- and 10-sample averages): 61 trades; before costs the leaky version makes +18.84 USD and the fixed one -1.76 USD (1000 USD per trade); with 5 + 2 bps costs per leg they make -66.56 and -87.16 USD. The causality test flags 37 of 440 moments in the leaky version (first at sample 41) and 0 of 440 in the fixed one.
- **Many tries** (20 draws of 50 random strategies; in-sample = first 288 samples, out-of-sample = from sample 300, a 12-sample gap; score = mean divided by standard deviation of per-trade P&L, at least 4 trades). Before costs: mean best in-sample score 0.507, the same strategies out-of-sample 0.115; the winner clears its luck benchmark in 4 of 20 draws; median out-of-sample rank of the in-sample winner 28 (of about 48 scored). Draw 1: winner "coin-flip #704396 hold18", in-sample 1.00 (8 trades), out-of-sample 0.17 (5 trades), luck benchmark for 50 tries 0.76, deflated 0.25, out-of-sample rank 30 of 48. With 5 + 2 bps costs: mean best in-sample score -1.39, out-of-sample -4.38, and the winner is positive out-of-sample in 0 of 20 draws. Before costs the winner is positive out-of-sample in 10 of 20 draws.
- **Failures** (fault starts 01:37 SGT, lasts 5 minutes = 60 samples; paper agent sends one 250 USD order every 30 s, so 10 orders; risk hook limits 1000 USD, 50 bps, 60 s; baseline oracle age 3 s):

| Fault | Accepted / rejected | Rule that fired | Loss with hook | Loss with no hook | With extra guards |
|---|---|---|---|---|---|
| Stale oracle (frozen, market moves 80 bps) | 2 / 8 | max-oracle-age | 2.02 USD | 10.04 USD | 2 accepted, 2.02 USD |
| RPC outage (HTTP 429, market moves 80 bps) | 2 / 8 | max-oracle-age | 2.05 USD | 10.17 USD | 2 accepted, 2.05 USD |
| Slippage shock (40 bps worse fills) | 10 / 0 | none | 10.00 USD | 10.00 USD | circuit breaker: 3 accepted, 3.00 USD |
| Fee change (5 to 30 bps) | 10 / 0 | none | 6.25 USD | 6.25 USD | 10 accepted, 6.25 USD (not caught) |
| Duplicate submission (every order twice) | 20 / 0 (5000 USD exposure) | none | 0.00 USD | 0.00 USD | idempotency guard: 10 accepted, 10 rejected as duplicate-order |

  Strategies re-priced (net USD): at 40 bps slippage trend -89.4, basis -169.7, mean reversion -80.0, market maker -3.5; at 30 bps fee trend -63.4, basis -120.3, mean reversion -56.6, market maker -20.9. Break-even cost per leg (gross P&L per trade in bps): basis 0.34, trend 0.31, mean reversion 0.57, market maker 0.07; cross-venue arbitrage made no trades. With HTTP 429 for 300 s, a client retrying every second makes 300 calls, with back-off (1, 2, 4 ... 30 s) 14.
- **Feed break** (CUSUM on venue-minus-oracle gap in bps): warm-up 60 samples, baseline gap mean 2.04 bps and standard deviation 2.72 bps; slack k 0.5, alarm level h 5. Healthy feed: no alarm in 40 minutes. Simulated freeze at sample 288: alarm at sample 307, 95 seconds later.

Rules to keep in every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated on recorded data, "Simulated, on recorded data; not advice". The faults are simulated on top of real prices. No prizes, no promises about returns.

---

## Slides 1-3: Title, where we are, tonight

**Q: Do I need to have been at the earlier sessions?** No. Tonight stands alone, but it uses the strategies and the risk hook from build night 1 and the same recorded SOL/USDC prices. A lead will help with setup in the first fifteen minutes.

**Q: Do I need AI credits or an API key?** No. Everything runs on bundled recorded data with `--recorded`. A coding agent helps, but you can hand-edit one value (for example `leak: true` to `leak: false`) and rerun.

**Q: What is the question for tonight?** How would you know your result is not luck or a bug? Slide 20 gives three answers.

**Q: What happens next week?** Thu 4 Feb is Workshop 4, Performance Scorecard and Shipping. Bring your result, your leak or failure test, and your updated limitations.

## Slide 4: Three ways to fool yourself

**Q: What are the three?** A leak (the test data was not really unseen), luck (you tried many things and kept the best), and a broken feed (the data stopped being true and nobody noticed).

**Q: Is a leak the same as overfitting?** Related, not the same. A leak means information from the test period got into the training or the decision. Overfitting means tuning until it fits noise. Both make results look better than they are.

**Q: Do LLM agents leak too?** They can. If the model was trained on text that covers the period you test, it may "predict" what it remembers. Test on a period after the model's training, or on data it cannot have seen.

**What this slide does not show:** any data; it is the map for the evening.

## Slides 5-6: Overlapping labels, purge and embargo

**Q: What is a label?** The answer we check a guess against. Here: does the price rise over the next h samples? At 5-second samples, h=24 is two minutes.

**Q: Why do neighbouring moments leak?** The label of a moment looks h samples ahead, so a moment 5 samples later has a label that covers almost the same future. If one is in training and the other in test, the training set already holds nearly the answer.

**Q: What is a purge?** Remove from training every moment whose label window overlaps a test label window, so no training label touches the test period. Inspired by purged cross-validation (AFML chapter 7).

**Q: What is an embargo?** After the test block, also remove a few more training moments, because markets stay correlated for a while. The slider in demo 1 runs from 0 to 30 samples.

**Q: Why not just shuffle and split randomly?** Shuffled folds scatter test moments through time, so every training moment has a test neighbour. On our data a memoriser gets 60.4% balanced accuracy at h=24 with shuffled folds and 53.9% with contiguous folds plus purge and embargo 12, and at h=48 56.8% against 35.3%. *If they push:* a purge on shuffled folds removes almost everything, which is the point: shuffled folds cannot be made clean.

**Q: Why is some accuracy below 50%?** With 433 test moments one standard error is about 2.4 points, and 40 minutes is one quiet regime, so values several points either side of 50% are noise or a regime effect, not a discovery. Do not read 35.3% as "predicts the opposite".

**What these slides do not show:** a result about markets. The memoriser is a deliberately leaky sample, not a strategy.

## Slide 7: The planted leak and the causality test

**Q: What is the bug?** In `trendSignal` the window ends one step too late (`shift = 1` when `leak` is true), so the decision at moment i also sees the price at i + 1. It is an off-by-one that looks harmless.

**Q: Why does it look so good?** Knowing the next price helps. Before costs the leaky version makes +18.84 USD over 61 trades and the fixed version -1.76 USD on the same prices.

**Q: How does the causality test work?** For each moment it computes the signal on the full series and again on the series cut off at that moment. A signal that uses only the past cannot change. 37 of 440 moments change in the leaky version and none in the fixed one.

**Q: Would a train/test split have caught it?** No. The lookahead is inside the signal, so it is present in both train and test and the out-of-sample number looks just as good. A purged split fixes label overlap; the causality test finds lookahead. You need both. *If they push:* the test only proves the strategy is causal at the settings tried; it does not prove the rest of the pipeline is clean.

**Q: Can I use it on my own strategy?** Yes: `causalityTest(prices, (px, i) => yourSignal(px, i))`. Your signal must be a function of the prices and the moment.

**What this slide does not show:** a profitable strategy. After 5 + 2 bps costs both versions lose money (-66.56 and -87.16 USD).

## Slides 8-9: Best of many tries and the luck benchmark

**Q: What are the 50 strategies?** Random draws from four families: trend, mean reversion and pool-versus-oracle basis from build night 1 with random settings, and a coin flip that opens trades at random and has no skill by construction.

**Q: What is the score?** Mean profit per trade divided by its standard deviation (a Sharpe-like score). It needs at least 4 trades; strategies with fewer are not scored.

**Q: Why does the best one fall apart?** Picking the best of 50 picks the luckiest. On 20 draws the mean best in-sample score is 0.507 and the same strategies score 0.115 on later data; the in-sample winner ranks 28th out of about 48 out-of-sample (median), no better than average.

**Q: What is the luck benchmark?** The best score you would expect from N strategies with zero real skill. It grows with N: more tries, higher bar. For 50 tries in draw 1 it is 0.76. Inspired by the deflated Sharpe ratio idea (AFML chapters 11 to 14).
- *If they push:* it uses the spread of the scores themselves, which is noisy with about 48 numbers, so treat it as a rough guide, not a verdict.

**Q: In draw 1 the winner clears the benchmark. Is it real?** The winner is "coin-flip #704396 hold18", which has no skill by construction. It scored 1.00 in-sample against a benchmark of 0.76 (deflated 0.25), and 0.17 on later data. Clearing the benchmark in a few draws (4 of 20 overall) is what a rough benchmark with noisy inputs does; the out-of-sample drop is the more reliable signal.

**Q: Does it mean no strategy works?** No. It means this method cannot tell skill from luck on 40 minutes of data. With 5 + 2 bps costs the mean best in-sample score is -1.39 and the winner is positive out-of-sample in 0 of 20 draws. That says costs matter on a quiet window; it is not a statement about all markets.

**What these slides do not show:** a realistic search. A real search has more tries, more data and correlated strategies.

## Slide 10: Real numbers

**Q: Where does the data come from?** Real SOL/USDC prices from Jupiter (a quote for 1 SOL), Pyth (the on-chain oracle) and an Orca pool, read every 5 seconds for 40 minutes: 481 samples, 01:13 to 01:53 SGT on 22 Oct 2026. They were collected in build night 1.

**Q: Is 40 minutes enough?** For learning the method, yes; for conclusions, no. It is a quiet night, trades per strategy range from a handful to about 80, and every score has a wide error bar.

**Q: What is simulated?** The faults, the paper agent, the random strategies and the 60/40 split are all code-made. The prices are real.

**Q: Is this real money?** No. Reads use public mainnet data; every write is devnet only; no real funds.

**What this slide does not show:** busy markets, tick data or an order book.

## Slide 11: A broken feed raises an alarm (and demo 4)

**Q: What is the gap?** The venue price minus the oracle price, in basis points (bps; 1 bps is 0.01%). On this data it averages 2.04 bps with a standard deviation of 2.72 bps.

**Q: How does the alarm work?** A CUSUM: standardise the gap against its first 60 samples, add up how far it strays beyond a slack of 0.5 standard deviations, and alarm when the sum passes 5. A frozen oracle makes the gap drift, so the sum grows. Inspired by CUSUM structural-break tests (AFML chapter 17).

**Q: How fast does it catch a freeze?** In the simulated freeze at sample 288 it alarms at sample 307, 95 seconds later, and on the healthy feed there is no alarm in 40 minutes.

**Q: Why not just check the oracle's age?** You should; the risk hook does after 60 seconds. This alarm uses only the data, so it works when you do not trust the timestamp, and it lets you choose the trade-off between speed and false alarms with `h` and `k`.

**Q: Could it false-alarm?** Yes. Lower h or k and it fires sooner but also on ordinary wobble. Raise them and it is slower. No setting is free.

**What this slide does not show:** a real outage. The freeze is simulated by repeating the oracle's last value.

## Slides 12-13: Five Solana failures, what the hook caught and missed

**Q: Why these five?** They are common on Solana: a stale or frozen oracle, an RPC that returns HTTP 429 or fails, a fill worse than expected, a fee change, and a transaction sent twice after a timeout.

**Q: What is HTTP 429?** "Too many requests": the endpoint asks you to slow down. A client that retries every second makes 300 calls in a 5-minute outage; with back-off (wait 1, 2, 4 ... up to 30 seconds) it makes 14.

**Q: What did the risk hook catch?** The stale oracle and the RPC outage, by `max-oracle-age`: 8 of 10 orders rejected in each, losses 2.02 and 2.05 USD instead of 10.04 and 10.17 USD. It let 2 orders through in the first minute, because the age limit is 60 s.

**Q: What did it miss?** Slippage (10 of 10 accepted, 10.00 USD lost), fee changes (10 of 10, 6.25 USD extra) and duplicate submission (20 accepted, 5000 USD of exposure instead of 2500). The hook looks at one order against the oracle and has no memory and no view of fills or fees.
- *If they push:* the limit is a choice. A 20-second age limit rejects sooner and accepts fewer; demo 3 has a slider.

**Q: What are the extra guards?** A circuit breaker (halt after 3 fills worse than 15 bps; slippage shock goes from 10 to 3 accepted orders and 3.00 USD) and an idempotency key (a second identical order in the same 30-second slot is rejected). They are small examples of "add a rule, add a regression test". The fee change is not fixed by either; it needs a check that a strategy's edge covers its costs.

**Q: How do strategies cope with a fee or slippage shock?** Badly. At 40 bps slippage trend loses 89.4 USD and basis 169.7 USD; at a 30 bps fee trend loses 63.4 USD and basis 120.3 USD. Their break-even cost is under 1 bp per leg (basis 0.34, trend 0.31, mean reversion 0.57, market maker 0.07), so almost any cost change flips them.

**What these slides do not show:** a real incident. All faults are simulated on real prices, and the 80 bps and 40 bps are our choice. Nothing touches a live service.

## Slide 14 and Demo 1: Split leakage (`01-split-leakage.html`)

**Q: What am I looking at?** A timeline of the 481 moments, one cell each, coloured train, test, purged and embargoed. Below it the memoriser's accuracy for the settings you chose.

**Q: What should I try first?** Set folds to shuffled with purge off and read the accuracy (60.4% at h=24). Then switch to contiguous, turn purge on and drag the embargo to 12 (53.9%). Watch the training moments kept go down and the red cells appear.

**Q: Why does shuffled with purge show "n/a"?** Every training moment is next to a test moment, so the purge removes nearly all of them (a fold needs at least 30 left to be scored). That is the lesson: shuffled folds cannot be made clean.

**Q: Why does the embargo change so little?** After a contiguous block there are not many moments to remove, and the memoriser's score is dominated by the neighbours the purge already removed. The embargo matters more when features or labels have long memory.

**Q: Are the numbers from the demo the same as the code?** Yes, they come from `splits.json` and `verify.mjs` checks the counts. The footer line shows the check.

**What this demo does not show:** a better model. The memoriser is deliberately leaky, and with 433 test moments differences under about 5 points are noise.

## Slide 15 and Demo 2: Many strategies (`02-many-strategies.html`)

**Q: What are the dots?** Each of 50 random strategies: in-sample score across, out-of-sample score up. The highlighted one is the best in-sample.

**Q: What should I try first?** Drag tries from 1 to 50 and watch the best score rise while the luck benchmark rises too. Then change the draw (1 to 20). Then move the cost slider off zero.

**Q: Why does the cost slider start at zero?** To isolate the luck effect we show scores before costs, which is generous. At 5 + 2 bps the best in-sample scores go negative and none of 20 winners is positive out-of-sample.

**Q: Some dots are missing.** Strategies with fewer than 4 trades in a period have no score; between 0 and 6 per draw are missing in-sample or out-of-sample (2 in draw 1 each).

**Q: Is draw 1 typical?** Draw 1 is the first, not a hand-picked one. Across the 20 draws the winner's out-of-sample score is lower than its in-sample score in 16, and it clears the luck benchmark in 4.

**What this demo does not show:** any strategy that works. It shows what selection does to scores.

## Slide 16 and Demo 3: Failure injector (`03-failure-injector.html`)

**Q: What is the timeline?** One cell per 30-second order, coloured accepted, rejected or bad fill (more than 20 bps worse than the market), with the rule that fired.

**Q: What should I try first?** Pick stale oracle: the hook lets two orders through then rejects the rest on age. Slide max oracle age down to 20 s and see it reject sooner. Then pick slippage shock: the hook is blind; turn on extra guards.

**Q: Why are there no rejections for fees?** The hook checks size, price against the oracle and oracle age. It does not see fees or fills. That gap is the build-menu task: write a failing test, then the rule.

**Q: Can I make it worse?** Yes: lengthen the fault, increase the market move or the slippage. Remember these are values we chose, not measurements.

**What this demo does not show:** real execution. There are no fills, only a model of how much worse a fill is than the market.

## Demo 4: Feed break (`04-feed-break.html`)

**Q: What should I try?** Press "freeze the oracle (simulated)" and watch the gap drift and the CUSUM sum cross the line. Then lower the alarm level h and see it fire sooner; raise the market move after the freeze and it fires even sooner.

**Q: Why is there a warm-up?** The detector learns the normal gap from the first 60 samples (5 minutes); it cannot alarm before that.

**What this demo does not show:** a real oracle failure. The freeze is simulated; the venue price and the gap before it are real.

## Slide 17: Try the demos yourself

**Q: Do I need to install anything?** No. The four demos run in any browser, from the printed link or the QR, and also from the `lab` folder on disk.

**Q: What is the Live switch?** It reads real Solana data from your browser (see the live section below). Recorded stays the default.

## Slides 18-19: Mission and build menu

**Q: How do I find the planted leak?** Run the causality test on `trendSignal` with `leak: true`: it reports the moments where the signal changes when the future is cut off. Look at the window end in `trendSignal`. Fix it (`leak: false`), rerun, and chart the equity before and after.

**Q: Where does the purged split come in?** After you fix the signal, evaluate with contiguous folds and a purge, not shuffled folds. The mission asks for both: the leak in the signal and the leak in the split.

**Q: I have no project yet. What do I do?** Use the sample: write a regression test for one fault (duplicate submission is a good first one) or run the causality test on your own signal idea.

**Q: What counts as done?** A leak found and fixed, a purged split, a regression test and a note on limitations. A plain message such as "the test fails before the fix and passes after" is enough.

## Slides 20-25: Takeaways, branch out, share back, get the code, connect, close

**Q: What are the three takeaways?** Check for leaks (causality and purge), discount the best of many tries, and test failures on purpose so a test stops them returning. Use the wording on slide 20.

**Q: What should I share back?** Push your work, bring the result, the leak or failure you found and your updated limitations to Workshop 4 (Thu 4 Feb).

**Q: Where is the code?** `github.com/travisim/solana-agentic-trading-nus`, folder `0007-backtest-validation-failure-testing/demo`. Run commands from `demo/code`.

---

## Live mode, in plain words

- **What students see:** a LIVE pill with the last update time and the slot or price. Demo 1 and 2 show a live strip (current Orca price and Pyth age) clearly labelled live and not part of the simulation. Demo 3 sends one real Pyth read every 5 seconds through the same risk hook, and the fault buttons simulate staleness on top of it. Demo 4 feeds the live Orca-minus-Pyth gap into the same detector (it needs its warm-up first).
- **If an endpoint is slow or rate limited:** the page shows an error pill ("rate limited, back to recorded") and falls back to recorded data by itself after 3 failed calls in a row. Say: "that is a public endpoint shared by everyone; recorded is the default for exactly this reason." Do not wait for it.
- **Reads only:** no keys, no wallet, no writes. Browser RPC is `https://solana-rpc.publicnode.com`.
- **Presenter laptop live, students recorded:** all students share one campus IP; Jupiter throttles after about one call, so the lab does not depend on it.

## Plain-words glossary

- **Label:** the answer a guess is checked against; here, does the price rise over the next h samples.
- **Leak:** information from the test period reaching training or the decision.
- **Purge:** removing training moments whose label overlaps the test period. **Embargo:** removing a few more after the test block.
- **In-sample / out-of-sample:** data a strategy was chosen on / data it never saw.
- **Sharpe-like score:** mean profit per trade over its standard deviation.
- **Luck benchmark:** the best score expected from N strategies with no skill.
- **bps (basis point):** one hundredth of a percent. 40 bps is 0.4%.
- **Oracle age:** how long ago the oracle price was published.
- **Slippage:** the price moving against you between deciding and filling. **Fee:** what the venue charges.
- **HTTP 429:** an endpoint telling you to slow down. **Back-off:** waiting longer after each failed try.
- **Idempotency key:** a label so that sending the same order twice has the effect of once.
- **Circuit breaker:** a rule that stops trading after repeated bad events.
- **CUSUM:** a running total that raises an alarm when it crosses a line.

## General questions

**Is this real money? Can I lose funds?** No. Reads use public mainnet data; every write is devnet only; there are no real funds, no wallet, no keys. Nothing in this repo signs or sends a transaction.

**What is devnet?** Solana's test network. Its tokens have no value. It is for trying things.

**Can I use this for a real strategy?** Tonight is about testing your own work honestly. Results are simulated on recorded data, not advice, and a short recording says little about the future. Do your own research, and do not risk money you cannot lose.

**Does passing these tests mean my strategy works?** No. They can find some mistakes (overlap, lookahead, luck, missing failure handling). Passing means you did not find a problem with these tests, not that there is none.

**What if setup fails?** Do not debug for more than 3 minutes: pair with a neighbour or a lead's laptop, or use the demos in the browser (slide 17). Tell a lead so we can note the blocker.

**Where do I get help?** Ask a lead in the room; message Travis on Telegram (`t.me/travisim`); program support is @Aaron_Solanki on Telegram.

**Any prizes or funding?** Nothing is promised. Do not advertise any.
