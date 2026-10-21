# Q&A prep: Workshop 4, Performance Scorecard and Shipping

For Travis and the leads, to answer questions while presenting. Grouped by slide number and demo (38-slide deck). Answers are written to be said aloud.

Facts come from `demo-repo/code/out/*.json` (sample ledger: 45 trades from four sample strategies on 40 minutes of recorded SOL/USDC data, 21 Oct 2026, 17:14 to 17:54 UTC, capital 10,000 USD, 1,000 USD per trade) and `recorded/solana-costs.json`. **Re-check these after any re-run:**
- Base costs 5 bps fee + 2 bps slippage per leg: gross +3.00 USD, costs 56.70, net -53.70; hit rate 11.1% (5 wins of 45), average win +0.45, average loss -1.40, payoff 0.32, break-even hit rate 75.8%; max drawdown 53.70 USD (0.54%); under water 99% of the window (longest 40 min); turnover 8.3x (83,000 USD traded); the chance the real hit rate is below break-even: 100%.
- Zero costs: net +3.00, hit rate 42.2%, average win +0.69, average loss -0.44, break-even 39.0%, max drawdown 3.84 USD, under water 82% (longest 29 min), chance below break-even 33%. Costs 12 + 5 bps: net -134.60.
- Per strategy at 5 + 2: basis 19 trades, net -25.29; market-maker 7, -3.45; mean-reversion 9, -11.57; trend 10, -13.39 (hit rate 20%). Cross-venue arbitrage made no trades on this window. Turnover: basis 3.8x, trend 2.0x, mean-reversion 1.8x, market-maker 0.7x.
- Failure table (hit rate 45%, wins pay 1x losses, break-even 50%): 10 trades 62%, 30 trades 71%, 100 trades 84%, 200 trades 92%, 500 trades 99%.
- Solana costs (5 finalized blocks, 21 Oct 2026 19:53 UTC, 2,680 transactions): base fee 5,000 lamports per signature; median fee 5,222 lamports (0.0006 USD, 0.006 bps of a 1,000 USD trade); 66% paid a priority fee; 35.3% failed (28% to 44% per block). Jito tips not captured.
- Honest vs misleading (basis strategy, 19 trades): gross +1.31 vs net -25.29; 37% "won" on gross vs 0% after costs; "+17,182 USD per year" from 40 minutes; the other three strategies together -28.41 net; win streak of 2 vs 99% of the window under water.
- Ship check samples: tidy 14 of 14; messy 3 of 14 (2 must-fix, 9 warnings); leaky 9 of 14 (2 must-fix: `.env` and `wallet/id.json`).

Rules for every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated, on recorded data, not advice. No prizes, no funding, no return promises. Book ideas may be named here (inspired by AFML Ch.14 and 15) but never on slides.

---

## Slides 1-4: Title, where we are, today, what you leave with
**Q: Do I need to have come to the earlier sessions?** It helps, but today stands alone: the sample ledger and the ship check work on any project.
**Q: My project has no trades. Is this for me?** Yes. Half of today is shipping: README, tests, devnet evidence, secrets, demo script. The scorecard idea applies to any measurable output: failed-transaction rate, latency, test coverage.
**Q: What is "devnet evidence"?** A transaction you made on Solana's test network, shown as an explorer link with `?cluster=devnet`. It proves the code really talked to a chain.
**Q: Is there a prize?** We do not announce prizes or funding. Judging is on utility, tests, devnet evidence and clear explanation.
**Q: When is Demo Day?** Thu 18 Feb; Build night 5 on Thu 11 Feb is the rehearsal.

## Slide 5: A ledger is the input
**Q: What is a ledger?** A list of closed trades, one per row, with when they opened and closed, prices and the gross profit or loss.
**Q: Why is cost not in the ledger?** So you can change fees and slippage and rescore the same trades. Costs are an assumption; the trades are the record.
**Q: Where did these 45 trades come from?** The sample strategies (basis, market-maker, mean-reversion, trend) run on 40 minutes of recorded SOL/USDC data. Simulated, not advice.
**Q: How do I get my own ledger in?** A JSON file shaped like `out/ledger.json`, scored with `npm run demo -- --ledger file.json`. The format is in the README.
**If they push:** open trades are not marked to market; the ledger only has closed trades. Fine for teaching, not for a real account.

## Slide 6: Hit rate alone says nothing
**Q: Are strategies A and B real?** No, illustrative. Nine wins of +1 and one loss of -12 nets -3; four wins of +3 and six losses of -1 nets +6.
**Q: So low hit rate is fine?** Only if the wins are big enough. Trend followers often win less than half the time and still make money.
**Q: Then why quote hit rate?** It is half of a pair. You need payoff ratio next to it.

## Slide 7: Win size, loss size, break-even
**Q: Where does the formula come from?** Set expected profit to zero: p x win = (1 - p) x loss, so p = loss / (win + loss).
**Q: Our ledger at zero costs has 42% hit rate and break-even 39%: is it good?** It is above break-even by 3 points over 45 trades, which is not much evidence: the chance the real hit rate is below break-even is still 33%. And zero costs are not real.
**Q: Why does break-even jump to 75.8% with costs?** Costs shrink wins (average win 0.69 to 0.45) and enlarge losses (0.44 to 1.40), so you need to be right far more often.
**Q: Which number should I trust?** The one with your real costs.

## Slide 8: Gross is not net
**Q: What is a basis point?** One hundredth of a percent. 7 bps on 1,000 USD is 0.70 USD per leg, 1.40 per round trip.
**Q: Are 5 + 2 bps realistic?** They are a teaching baseline: a typical pool fee plus a small slippage. Your venue's real fee and your real slippage should replace them. Sliders go to 15.
**Q: Why does the venue gap matter?** In the recorded data Jupiter and Orca typically differed by 1 to 3 bps (largest 6.3). A round trip costs 14. The gap is smaller than the toll, so arbitrage made no trades at the 8 bps entry threshold.
**Q: Does this prove strategies like these never work?** No. It shows these simple ones, on this window, with these costs, do not. Simulated, not advice.

## Slide 9: Drawdown and time under water
**Q: What is drawdown?** The fall from the highest equity so far. Max drawdown is the biggest such fall.
**Q: And time under water?** The share of the window equity spent below a previous peak. 82% at zero costs, 99% at base costs.
**Q: Why is max drawdown only 53.70 USD, 0.54%?** The ledger risks 1,000 USD per trade on 10,000 capital and ran 40 minutes. In percent terms it looks small; in comparison with a +3.00 USD gross it is huge.
**Q: Does time under water matter for a 40-minute test?** It matters as a ratio. For a real strategy you want it measured over weeks, which we do not have.

## Slide 10: Turnover
**Q: How is turnover computed?** Traded notional (notional x legs) divided by starting capital: 83,000 / 10,000 = 8.3x.
**Q: Is high turnover bad?** Not by itself. It multiplies costs, so it needs a bigger edge per trade.
**Q: Why is the market-maker's turnover low?** Seven fills with one leg each: 7,000 USD traded, 0.7x.

## Slide 11: The scorecard on one page
**Q: Why "1892%" costs versus gross profit?** Costs (56.70) are 18.9 times the gross profit (3.00). It only shows when gross is above zero.
**Q: What does "100%" chance mean?** Given 11% hit rate over 45 trades and 75.8% break-even, the real hit rate is essentially certain to be below break-even (normal approximation).
**Q: Can I add my own number?** Yes: `src/scorecard.ts` is plain functions; add a field, add a test, add a card.

## Slide 12: The code behind it
**Q: What is `legs`?** How many buys or sells pay costs. A round trip has two. The market-maker's resting orders have one and pay no slippage in the simulation.
**Q: Why a normal approximation?** It is simple and fine as a guide. It assumes trades are independent and the sample is not tiny; the code warns below 30 trades.
**Q: Is this from the book?** The idea of asking how likely a strategy is to fail given its hit rate and payoffs is inspired by AFML Ch.15; our code is a simplified version, not the book's formulas.

## Slide 13: Run it
**Q: Does it need the internet?** No: `--recorded` is the default and the data is in the repo.
**Q: What do the columns mean?** Hit is the share of winning trades after costs; Under% is time under water; Turn x is turnover; PFail is the chance the real hit rate is below break-even ("n/a" when there are no wins or no losses to compute break-even).
**Q: Why is basis at 0% with "n/a" payoff?** It has no winning trades at these costs, so there is no average win to compare.

## Slide 14: Probability of failure
**Q: Is it the chance my strategy loses money?** No. It is the chance that the TRUE hit rate is below break-even, given what you saw. A cousin of "is my edge real?".
**Q: Why does it rise with trades for a 45% hit rate?** The true value is below 50% in this example; more data makes you surer of it. For a 55% hit rate it would fall toward zero.
**Q: How many trades are enough?** There is no magic number; our code warns under 30. More is better, and independent is better.
**If they push:** trades are not independent in practice, so the real uncertainty is larger than this shows.

## Slide 15: What simulated numbers can and cannot say
**Q: Then why simulate at all?** To rule things out cheaply and to learn which costs matter. A bad simulated result is informative; a good one is only a reason to test more.
**Q: Is 40 minutes enough?** Not for a conclusion: one quiet night (01:14 to 01:54 SGT), Asian night, quiet US evening.
**Q: What about my own orders moving the price?** Not modelled. Only slippage as a flat number of bps.

## Slide 16: What Solana itself costs
**Q: Why is the median fee 5,222 lamports?** 5,000 is the base fee for one signature; the rest is priority fees some transactions add.
**Q: Why did 35% fail?** In these five blocks most failures are bots racing for the same opportunity, which fail by design and still pay the base fee. It says little about your transactions. Five blocks on one evening is a sample, not a measurement.
**Q: What is a priority fee?** An extra fee you pay for a better chance of inclusion when the network is busy. `getRecentPrioritizationFees` returned 0 for all 150 slots in our capture: the blocks had room.
**Q: What is a Jito tip?** A tip paid to validators via the Jito block engine for bundle priority. We did not capture it; add it to your ledger when you pay one.
**Q: What is a lamport?** One billionth of a SOL.

## Slide 17: What judges look at
**Q: How are projects judged?** Utility, tests, devnet evidence and clear explanation, never simulated returns.
**Q: What if my project has no on-chain part?** Say so in the README ("none: this project does not write on chain") and make the tests and utility strong.

## Slide 18: README anatomy
**Q: Why a known limitation?** Judges trust projects that name their limits, and a reader can tell where to be careful.
**Q: How long should a README be?** One screen for the first six blocks; deeper docs can live in other files.

## Slide 19: Tests and devnet evidence
**Q: How do I get devnet SOL?** Use a throwaway devnet keypair, gitignored, and the faucet or `solana airdrop` on devnet. Airdrops are rate limited; ask a lead if you are stuck. Never use a key that holds real funds.
**Q: Can I use a screenshot as evidence?** A link that resolves is better; a screenshot cannot be checked.
**Q: Does a passing test count as evidence?** It is engineering evidence about your code; devnet evidence is about the chain interaction. Judges want both.

## Slide 20: Secrets and repo hygiene
**Q: What does the ship check look for?** Files named `.env`, `id.json`, `wallet.json`, `*keypair*.json`, `*.pem`, `*.key`, and text that looks like a key: a JSON list of 64 numbers or `PRIVATE_KEY=` followed by a long string. It never prints the value.
**Q: Is a pass a security audit?** No. It is a set of heuristics.
**Q: I committed a key. What now?** Rotate it (make a new key, move funds) first. Deleting the file does not remove it from git history.
**Q: Why does our own project show one warning?** No devnet evidence: it makes no devnet writes. That is correct. Also `.shipcheckignore` skips `out/shipcheck.json`, which holds made-up example secrets for the demo.

## Slides 21-22: Demo script and pitch
**Q: Why a limit in the demo?** It makes the rest believable.
**Q: Three minutes or two?** Demo Day is a 3-minute demo plus 2 minutes of questions; the 2-minute pitch is the elevator version.

## Slides 23-24: Cold-start test and recorded backup
**Q: What does `npm run smoke` do?** Copies the project to a temp folder without `node_modules` or `out`, runs `npm install`, `npm test` and `npm run demo -- --recorded` and checks the output files exist.
**Q: It passes. Do I still need a peer?** Yes: it tests the commands, not whether the README is understandable.
**Q: What goes in the recorded backup?** Recorded data in the repo, a `--recorded` mode, screenshots and a PDF.

## Demo 1: Scorecard from a ledger (slide 25)
**What it shows:** the same 45 trades under different costs. **What this does not show:** a future return; 45 trades on one quiet window.
**Q: Which strategy is best?** None is profitable after base costs. At zero costs mean-reversion and basis lead on gross; that is the point of the sliders.
**Q: Why does the hit rate change as I move the slider?** A trade counts as a win only if its net P&L is positive, so costs turn small wins into losses.
**Live mode:** the strip shows the live Jupiter versus Orca gap against your cost line (2 x (fee + slippage)) and how many live ticks cleared it. Usually none, because the gap is 0 to 3 bps and the line is 14. If Jupiter throttles, the strip says so and uses the last quote or the pool price.

## Demo 2: Drawdown and time under water (slide 26)
**What it shows:** equity, running peak, drawdown, and how long equity stays red. **Not shown:** open positions are not marked to market.
**Q: Why does the curve move in steps?** Equity changes only when a trade closes.
**Q: Why is the zero-cost curve still red 82% of the time?** After an early peak, wins and losses keep it below that peak; only a new high ends it.
**Live mode:** a paper long of 1,000 USD opened at the first live Orca price after you switch Live on, marked to each new price, with the round-trip cost from the sliders. It is a toy to see an underwater chart being drawn, not part of the ledger.

## Demo 3: Hit rate versus payout (slide 27)
**What it shows:** average profit by hit rate and payoff ratio, the break-even line, the sample strategies and your what-if dot. **Not shown:** whether trades are independent.
**Q: What is the dashed line?** The hit rate needed for a chosen per-trade Sharpe ratio (mean over standard deviation of per-trade P&L). It is per trade, not annualised.
**Q: Why do some strategies have no dot?** They need at least one win and one loss to have a payoff ratio (basis and mean-reversion have no wins at base costs).
**Live mode:** each live tick is a one-tick long of 1,000 USD. The hollow dot is before costs, the solid dot after. A 5-second move is about a basis point; costs are 14, so the dot falls to the left and down.

## Demo 4: Honest versus misleading dashboard (slide 28)
**What it shows:** five common tricks computed on the same 19 trades. **Not shown:** every trick that exists.
**Q: Are these tricks deliberate?** Often they are accidents: gross numbers are what the code computes first; extrapolating a short window is tempting.
**Q: How do I avoid them?** Net not gross, report all strategies, state the window, show drawdown and time under water, say what the numbers cannot say.
**Live mode:** the same two dashboards for the live paper long; the misleading one annualises a few seconds into a huge per-year number.

## Demo 5: Ship-readiness check (slide 29)
**What it shows:** 14 checks on a sample project or a folder you choose (read in the browser tab; nothing uploaded). **Not shown:** it is a heuristic scan, not a security audit.
**Q: Does it upload my files?** No. It reads them in your browser with the File API.
**Q: Why did tidy-project pass the devnet check if the signature is fake?** The check is about shape (an explorer link with a signature-sized string and `?cluster=devnet`). Live mode asks devnet whether it exists: the sample signature is not a valid signature, so Live says so.
**Q: Can I run it from the terminal?** `npm run ship-check -- <folder>`; exit code 1 if a must-fix check fails.
**Live mode:** shows the devnet slot and checks any signatures found in your docs (or one you paste) on devnet through `https://api.devnet.solana.com`. Works on the deployed site; from a file on disk the browser blocks it and the pill falls back to recorded.

## Slides 30-32: Try the demos, mini-lab, build menu
**Q: How do I break a number on purpose?** Raise the costs, delete the five winning trades from a copy of `out/ledger.json` and rescore with `--ledger`, double one loss, or change `windowEndT` to shorten the window. Then say which scorecard line moved.
**Q: I have no coding agent. Can I do it?** Yes: the sliders in the browser are enough for the mini-lab; hand-edit one number for the rest.
**Q: What should a beginner build?** Run the scorecard, put three numbers in the README, finish the README from the template.

## Live mode: what students will see
Switch top right; default Recorded. Live shows a `LIVE` pill, the last-update time and the slot. Rules: poll every 5 s, Jupiter at most every 20 s (a classroom shares one IP; Jupiter returned 429 after about one call in our test), stop when the tab is hidden. Any failure shows `rate limited, back to recorded` and returns to recorded data by itself. Test with `?live=1&fail=1`.
Plain words: a **slot** is Solana's clock tick, about 0.4 s; **oracle age** is how old a published price is; a **bps** is 0.01%; **fees** are what the venue charges; **slippage** is how far your fill moves from the quote; a **lamport** is a billionth of a SOL.

## General questions
**Is this real money?** No. Reads use public mainnet data; every write is devnet only; no real funds, no seed phrases.
**Can I lose funds?** Not with this code: no wallet, no keys, no mainnet writes.
**What is devnet?** Solana's test network; its SOL has no value.
**Can I use this for a real strategy?** It is a teaching tool. Simulated results on 40 minutes are not evidence of a real edge, and nothing here is advice.
**Setup failed. What now?** Pair up, use `--recorded`, or the browser demos; tell a lead; we note it for the report.
**Where do I get help?** The leads; the support contact for the program is @Aaron_Solanki on Telegram.
