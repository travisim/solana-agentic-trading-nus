# Q&A prep: Build night 3, Position Sizing and the Trade Ledger

For Travis (and the leads) to answer questions while presenting. Grouped by slide number and demo. Slide numbers refer to the 25-slide deck. Answers are written to be said aloud. Books may be named here (the sizing and overlapping-bets ideas are inspired by a machine-learning-for-finance textbook, Advances in Financial Machine Learning, chapters on bet sizing and overlapping outcomes); the slides do not name it.

Facts below come from `demo-repo/code/out/*.json` and `recorded/` (price series 17:13:59 to 17:53:59 UTC on 21 Oct 2026, which is 01:13 to 01:53 Singapore time on 22 Oct; Jupiter impact quotes and pool token balances captured 19:36 UTC on 21 Oct) and match `npm run demo -- --recorded` and slides 6-10. **Re-check these after any re-recording or change of defaults** (`out/*.json`, `deck/build-report.json`):
- Simulated account: 10,000 USD of cash, nothing else. Exposure cap 25% of equity, steps of 0.1, price-impact cap 5 bps, risk hook max notional 1,000 USD, fee 4 bps per fill, bets last 300 s.
- Momentum signal: 37 bets in 40 minutes; up to 7 open at once, 4.3 on average; average uniqueness 0.23; largest size 38% of the cap when averaged versus 100% (clipped) when summed.
- Ledger: 38 rows = 36 fills + 2 refused, and both refusals are deliberate injected test orders (an oversized 5,000 USD order at row 12, rule max-notional; a price typed in cents at row 25, rule unit-sanity). Replay OK; fees 4.20 USD; final cash 9,497.93 USD and 4.6058 SOL; head hash starts `cf04855e75b6b7f2`.
- Equity at the end (marked at the oracle): no costs 10,002.35 USD (+0.024%); with costs 9,998.14 USD (-0.019%); half the cap 9,999.07 USD (-0.009%); bets summed instead of averaged 10,001.55 USD (+0.015%, with 42 refusals by the hook). These are a few dollars on one 40-minute window: noise, not a result.
- Confidence to size: 0.55 gives 8%, 0.60 gives 16%, 0.70 gives 34%, 0.80 gives 55%, 0.90 gives 82%, 0.95 gives 96% of the cap. At the defaults the hook starts refusing at about confidence 0.76 (size steps to 0.5, which is 1,250 USD).
- Real pool: the Orca SOL/USDC pool vaults held 178,736 SOL and 10,692,375 USDC (slot about 459,749,513). Jupiter priceImpactPct for a buy: SOL/USDC 0.005 bps at 100,000 USD and 0.066 bps at 1,000,000 USD; ORCA/USDC 3.317 bps and 28.202 bps. The largest buy under a 5 bps cap: over 1,000,000 USD (SOL/USDC) versus about 159,000 USD (ORCA/USDC).

Rules to keep in every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated on recorded data, not advice. No prizes, no promises about returns.

---

## Slides 1-2: Title, tonight

**Q: Do I need to have been at the earlier sessions?** No. Tonight stands alone, though the risk hook comes from build night 1 and the price data too. The setup takes ten minutes and a lead will help.

**Q: Do I need AI credits or an API key?** No. Everything runs on bundled recorded data with `--recorded`. A coding agent helps, but you can hand-edit one number and rerun.

**Q: Why is this the last session before a break, and what do I owe?** Nothing over reading week, exams or vacation. Tonight you freeze a working commit and write a restart note, so you can pick up on Thu 21 Jan at Workshop 3.

**Q: What is the question for tonight?** Which sizing rule would you trust, and why? We come back to it at 19:50.

## Slide 3: Open bets overlap

**Q: What is a bet here?** One call, at one moment, held for a fixed time (5 minutes in the sample code). A signal opens a bet; the bet closes when its time is up.

**Q: Why do bets overlap?** Signals keep arriving while earlier bets are still open. In the recorded run 37 bets were made in 40 minutes, each lasting 5 minutes, so up to 7 were open together.

**Q: Why does overlap matter?** Overlapping bets are not independent: they share the same stretch of price. If you treat each as separate you count the same move several times, and you size too big, or you trust a backtest that looks better than it is.

**Q: Are these the real bets?** No, slides 3-4 are an illustration (labelled). Real ones are on slide 9 and in demo 2.

**What this slide does not show:** any data.

## Slide 4: Count them together

**Q: Why average instead of add?** Adding three 50% bets gives 150%, more than the cap, for one idea counted three times. Averaging gives one shared position of 50%. The position changes as bets open and close.

**Q: Isn't three bets in a row more confident than one?** Maybe, if they were independent evidence. They are not: they come from the same price move. More careful methods weight each bet by how unique it is (in the code, "uniqueness" is the average of 1 over the number of bets open, across a bet's life) rather than just averaging.
- *If they push:* averaging is the simple version used in the book too; it is not the only choice. Compare it with summing in demo 2 and 4.

**Q: What is uniqueness?** For each moment a bet is open, 1 divided by how many bets are open. Average that over the bet's life. 1.00 means it never overlapped; 0.23 (our average) means it shares its move with about four others.

## Slide 5: Size from confidence

**Q: What is "confidence"?** A number between 0 and 1 for how likely your call is to be right. In our sample code it is a stand-in made up from the size of a momentum move. It is not a calibrated probability. If your own model outputs a "probability", check that 0.7 really wins about 70% of the time before you size from it.

**Q: Where does the formula come from?** Turn the confidence into a z-score, how many standard deviations above a coin flip, z = (p - 0.5) / sqrt(p(1-p)), then size = 2 x normal-curve(z) - 1. It is inspired by the bet-sizing chapter of the textbook. It gives 0 at p = 0.5 and approaches 1 as p approaches 1.

**Q: Why not just use p directly?** Then 0.55 would be a 55% bet when it is barely better than a coin flip. The curve gives 8% at 0.55 and 82% at 0.90: small edge, small bet.

**Q: Why steps?** So a tiny change in confidence (0.71 to 0.72) does not cause a trade, and fees. We round to tenths of the cap.

**What this slide does not show:** that the signal has any edge. It does not claim that.

## Slide 6: Limits in order

**Q: What is the exposure cap?** The most you ever hold in SOL, as a share of your account. We use 25%. It limits the damage if you are wrong.

**Q: What is the impact cap?** The largest order whose price impact stays under a limit (5 bps), from Jupiter's quotes. For SOL/USDC it never binds at these sizes, because the market is deep.

**Q: Why does the hook refuse a 2,000 USD order if the sizing asked for it?** The hook is a separate, simple rule from build night 1: max notional 1,000 USD per order. The sizing proposes, the hook can still say no. Layers, each doing one job.
- *If they push:* yes, it is a design choice that the hook is stricter than the cap here. In practice you set them to agree, or let the hook shrink the order instead of refusing. That is a good build-menu idea.

**Q: Does the order get cut or refused?** Impact cap: cut to the allowed size. Hook: refused whole, with the rule and the reason.

## Slide 7: One row per decision

**Q: Why log refusals?** Because "what the system declined to do, and why" is exactly what you need when you audit it. An order that never reached the market still tells you what the agent wanted.

**Q: What is a hash?** A fixed-length fingerprint of some text. Change one character and the fingerprint changes completely. We use SHA-256. Each row's hash covers its own contents plus the previous row's hash, so the rows chain.

**Q: Is the first row special?** Its previous hash is 64 zeros, the starting point.

**Q: Is JSONL the same as JSON?** It is JSON, one object per line, so you can append a row without rewriting the file. That is why it suits a ledger.

## Slide 8: Edit a row and it shows

**Q: Can't someone just recompute all the hashes?** Yes. A hash chain on its own is evidence of accidents and careless edits, not protection against a determined person with write access. To pin it down, publish the latest (head) hash somewhere you cannot rewrite, for example a devnet Memo transaction. We did not build that part tonight, it is on the build menu.

**Q: What does "reconcile to the balance" mean?** Start from the starting cash, subtract buys, add sells, subtract fees: you must get the cash in the last row. Same for the SOL position. If you can also read a real account balance, compare it too (`reconcileWith` in the code).

**Q: Why did the right side show a problem at row 5 and more after?** Row 5's contents no longer match its hash, and every later row's balance depends on it. The check reports the first bad row and lists up to ten problems.

**What this slide does not show:** that a ledger is tamper-proof. It is tamper-evident for honest readers.

## Slide 9: Real numbers

**Q: Is that a good result?** Don't read it as one. It is 40 minutes on one night; the difference between +0.024% and -0.019% is about four dollars on 10,000, mostly fees. A few dollars either way is noise. The point is that the plumbing works.

**Q: Why are two of the 38 rows refused?** They are deliberate test orders we injected, labelled INJECTED in the ledger: one oversized (5,000 USD), one with the price in cents. Without them the hook refuses nothing in this run, because the sizing stays under its limit.

**Q: Where does the price data come from?** Real Jupiter, Pyth and Orca SOL/USDC prices recorded every 5 seconds from 01:13 to 01:53 SGT on 22 Oct (build night 1's recording). The fills are simulated: we pretend to trade at the Orca pool price plus a price-impact term plus a 4 bps fee. Nothing was sent.

**Q: Is a short position possible?** In the simulation, yes (negative SOL), like a perpetual future. On a spot market you would have to borrow SOL. Treat it as simulated.

## Slide 10: Real pool data

**Q: What is a token account?** An on-chain account that holds a balance of one token. A pool keeps its SOL and USDC in two such accounts (vaults). We read them with the RPC and decode the amount.

**Q: Why not use getTokenAccountBalance?** The public node we use for browsers refuses it ("indexed request"). getAccountInfo works everywhere, and the amount is eight bytes at a fixed place.

**Q: What is price impact?** How much your own order moves the price against you. Bigger orders move it more, shallow pools more than deep ones. We use Jupiter's own number for each order size.

**Q: A basis point?** One hundredth of a percent. 5 bps is 0.05%.

**Q: Why is SOL/USDC impact almost zero?** It is the deepest market on Solana: about 10.7 million USDC and 178,700 SOL in this one pool alone, and Jupiter splits orders across many pools. We also recorded a thinner token (ORCA) to show what the cap does on a shallower pool.
- *If they push:* the numbers are from one moment (19:36 UTC on 21 Oct). Depth changes through the day. Jupiter's estimate is not a guarantee of the fill.

## Slide 11: The sizing in code

**Q: What is Phi?** The standard normal curve's cumulative function: the chance a normal variable is below z. `normCdf` in the same file is a short approximation (Abramowitz and Stegun), accurate to about seven decimals, no libraries.

**Q: What happens at exactly 0.5 or below?** Size 0. We do not bet against our own call in this sample (the side already carries the sign).

**Q: Where would I change the rule?** In `probToSize` (the mapping) or in `discretize` (the steps), or `combineBets` (average versus sum). The tests in `test/sizing.test.ts` show the expected numbers.

## Slide 12 and Demo 1: the sizing curve (`01-sizing-curve.html`)

**Q: What am I looking at?** Left: size against confidence, smooth (mint) and in steps (lavender), with your confidence as a dashed line. Right: six stages from smooth size to the hook's verdict. The big box at the bottom says what is sent, or what blocked it.

**Q: Why does the order change when I move "Already hold"?** The order is the difference between the target and what you already hold. If you already hold 1,000 and the target is 1,000, nothing to trade.

**Q: What is the ORCA/USDC button?** Same demo, but with the price-impact curve of a thinner token recorded from Jupiter. Lower the impact cap to 1 bps and the order gets cut.

**Q: What do the live numbers mean?** Live: the pool balances are read from the chain now, and the impact for your order size comes from a live Jupiter quote (at most once every 20 seconds, last good quote kept). If Jupiter says 429, the page shows the last quote and carries on. If the RPC fails three times in a row, the demo falls back to recorded and says so.

**What this demo does not show:** whether any confidence number is trustworthy; the effect of the order on a real book beyond Jupiter's estimate.

## Slide 13 and Demo 2: overlapping bets (`02-overlapping-bets.html`)

**Q: What do the bars show?** One bar per bet from its open time for the bet length. Mint is long, lavender is short, darker means bigger. The amber line below counts how many are open; the bottom chart shows average (mint) against summed (amber) size.

**Q: Why does the sum hit the cap so often?** Because bets cluster. At the busiest moment 7 bets were open; adding them reaches 100% (clipped) while the average peaked at 38%.

**Q: What does changing the bet length do?** Longer bets overlap more: the count rises and uniqueness falls. At 60 seconds at most 2 bets are open and uniqueness is 0.80; at 10 minutes up to 12 are open and uniqueness falls to 0.12.

**Q: What happens in Live?** The same momentum signal runs on live Pyth ticks, one every 5 seconds. It needs about a minute of history and a move of at least one standard deviation, so a signal may take a few minutes. If nothing fires, that is the signal, not a bug.

**What this demo does not show:** that the signals are any good, or how bets would really be filled.

## Slide 14 and Demo 3: ledger replay (`03-ledger-replay.html`)

**Q: What is the table?** The ledger rows replayed so far: time, why, order, the hook's verdict, the fill price and fee, cash and a short hash. Refused rows have a second line with the rule and the reason.

**Q: What do "Edit a row" and "Delete a row" do?** They change a copy in your browser (not the file): edit adds 1 USD to a fill price in the chosen row, delete removes a row. The two checks on the right recompute from scratch and turn red, naming the first bad row. Reset restores it.

**Q: Why does "Balances do NOT match" also appear after an edit?** The row's cash was computed from the old price; replaying with the new price gives a different number.

**Q: What are the rows in Live?** Paper orders made from the live Pyth price and Orca pool price, 300 USD alternating buy and sell, with every fourth an oversized 5,000 USD test order that the hook refuses. They are chained from the all-zero start, with hashes computed in your browser. Nothing is sent anywhere. If the oracle really is more than 60 seconds old, the hook will refuse a normal order too, and the reason says so.

**What this demo does not show:** protection against someone who rewrites the whole file and every hash.

## Slide 15 and Demo 4: equity before and after (`04-equity-before-after.html`)

**Q: What is the dashed curve?** The "before": one of four recorded runs. Mint is the "after": the whole simulation re-run in your browser with your sliders. They use the same prices and signals, so differences come from your change.

**Q: Why does the equity curve move when I change nothing in the signal?** Because the size changes the amount you hold, and fees depend on how much you trade.

**Q: Why are the numbers so small?** 10,000 USD, 25% cap, 40 minutes: a few dollars. The scale is the point: compare before and after, not the absolute.

**Q: What is the live strip?** The gap in bps between the live Orca pool price and the oracle price, against what a round trip costs (twice the fee). It is not part of the simulation; it shows how small real price gaps are compared with costs.

**What this demo does not show:** any result about markets; these are simulations on one window.

## Slides 16-19: try it, mission, menu, before the break

**Q: What if setup fails?** Pair up, or use demo 4 in the browser for the mission. The leads have a second laptop with the repo installed.

**Q: Can I do the mission without a coding agent?** Yes. `npm run demo -- --recorded --max-fraction 0.10`, then `--fee-bps 8`. Read the equity lines, or open demo 4 and move the sliders.

**Q: What is a restart note?** A short file, `RESTART.md` or similar, for a tired you in January: how to run it, what you should see, the first task. Written like you have forgotten everything.

**Q: What if I don't have devnet SOL?** Tell a lead; devnet airdrops are rate limited so we check before the break. You do not need it tonight.

**Q: Can I post my ledger hash to devnet tonight?** It is on the build menu as an advanced item and it is not in the sample code. You would send a Memo transaction containing the head hash with a throwaway devnet key kept outside the repo. We did not verify it end to end, so we did not include it.

## Slides 20-25: closing

**Q: Which sizing rule would you trust?** There is no single right answer. A fair one: a rule you can explain, that is capped, and that you have tested against costs on data it has not seen. Simple and capped beats clever and uncapped.

**Q: What would a reader of my ledger need to reproduce my run?** The input data (or where to get it), the parameters, the code version, and the starting balance. Write them in the restart note.

**Q: When is the next session?** Workshop 3, Thu 21 Jan 2027: deploy a trading venue component on devnet.

---

## Live mode: what students will see and what to say

- Every demo has Recorded / Live at the top right; Recorded is the default and nothing breaks offline. `?live=1` or `#live=1` in the URL opens it live.
- A pill shows `LIVE`, the time, the current slot and a short note. If the data source fails three times in a row the pill turns red ("live unavailable, back to recorded" or "rate limited, back to recorded") and the demo returns to recorded data by itself.
- **Slot** is Solana's clock tick, about every 0.4 seconds; the slot number moving shows the chain is alive. **Oracle age** is how long since the Pyth price was last published; the hook refuses prices older than 60 seconds. **bps** is a hundredth of a percent. **Fees** are charged on each fill (4 bps here). **Slippage / price impact** is how much your own order moves the price.
- If an endpoint is slow or rate limited: "this is a free public endpoint shared by the whole room". Do not wait for it; stay on Recorded. Jupiter in particular may answer 429 in a classroom; the demo keeps the last quote.
- Live data is read-only from the public RPC `solana-rpc.publicnode.com`; no wallets, no keys, nothing is written.

## General questions

**Q: Is this real money?** No. The account is simulated (10,000 USD), the fills are simulated, nothing is sent. Reads use public mainnet data; every write is devnet only.

**Q: Can I lose funds?** Not with this repo: it holds no keys and sends nothing. If you build a devnet component later, use a throwaway key kept outside the repo.

**Q: What is devnet?** A free test version of Solana with fake SOL. Mistakes there cost nothing.

**Q: Can I use this for a real strategy?** It is a teaching sample. The signal is a made-up stand-in, the confidence is not calibrated, the data is 40 minutes from one night, and costs are simplified. It shows how to size, count and record; it does not show that anything makes money. Not advice.

**Q: What do I do if setup fails?** Pair with a neighbour, or use the browser demos. Tell a lead and note the error for the report.

**Q: Where do I get help?** The leads in the room; the program support contact @Aaron_Solanki on Telegram; the repo README for commands.

**Q: Are there prizes?** Nothing has been confirmed, so we do not advertise any.
