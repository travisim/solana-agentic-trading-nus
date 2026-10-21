# Q&A prep: Build night 5, Demo Rehearsal

For Travis and the leads to answer questions while presenting. Grouped by slide and demo (25-slide deck). Answers are written to be said aloud.

Facts used below come from `demo-repo/code/out/*.json` and `recorded/` (match `npm run demo -- --recorded` and slides 4-12). **Re-check after any re-recording.**
- Sample project window: 18:13:46 to 18:30:20 UTC on 21 Oct 2026 (02:13 to 02:30 SGT, 22 Oct), the overlap of the recorded Orca swaps and the recorded Pyth reads. 1,114 real swaps used (the file holds 2,900; 2 duplicates, 134 dust swaps under 1 USDC and 5 price outliers were dropped across the whole file, and swaps outside the Pyth window are not used). 51 dollar bars of 20,000 USD; 10 CUSUM change alerts at 8 bps.
- Risk limits: 1,000 USD per order, 50 bps from the oracle, 60 s oracle age. Orders: 9 accepted, 1 refused (alert 8, a 1,064 USD sell, max-notional). Ledger: 9 fills, fee 4 bps assumed, fill at the next swap price. Scorecard (simulated, on recorded data; not advice): +3.00 USD net at the last price 109.01, hit rate 67%, max drawdown 8.03 USD, position 40.04571 SOL.
- Failure test (injected): 5,000 USD order (max-notional), oracle 300 s old (max-oracle-age), price in cents (unit-sanity), price 100 bps off (max-oracle-gap); all four refused.
- Pitch: 30 + 35 + 75 + 40 = 180 s, then 120 s of questions. Sample script: 50, 57, 88 and 53 words, about 23, 26, 41 and 24 s, 114 s in total at 130 words a minute.
- Judge view: 12 checks, the sample pack scores 9 of 12 (missing: t4 report from the frozen commit, d2 transaction link opens, d3 claim matches link). Test report: 51 passing, 0 failing.
- Devnet (captured 21 Oct 2026 19:34 UTC): slot 513,629,831, version 4.4.0-beta.1, Memo program present and executable. A signed Memo transaction passes signature verification in `simulateTransaction` (only error AccountNotFound: no SOL) and a flipped bit gives SignatureFailure. The faucet refused an airdrop (HTTP 429), so there is no funded devnet transaction and none is claimed.

Rules for every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated, not advice. No prizes, no promises about returns.

---

## Slides 1-3: Title, where we are, tonight
**Q: Is this a workshop or a build night?** A build night, but the teams drive. I talk for twenty minutes; the rest is your two rehearsals and fixing.
**Q: Can I still change my project?** Fix claims and add evidence, yes. No speculative features after the freeze at 19:55. If it does not work now, say it is untested; do not add it tonight.
**Q: I missed earlier sessions.** You can still rehearse: use the timer and the judge view on whatever you have, even a small tool.
**Q: Where do I send the demo pack?** To the leads at 19:55: repo and frozen commit, 3-minute script, recorded backup, test report, deployment addresses, transaction links and stated limitations.
*If they push:* a missing item is fine if you say what is missing and why. An invented item is not.

## Slide 4: Three minutes, four parts
**Q: Why these four parts?** They answer what a listener asks in order: who needs this, what is it, does it work, what is not proved. Live proof gets the most time (75 s) because it is what nobody can argue with.
**Q: Do I have to hit the budget exactly?** No. A part is fine up to its budget and still passes up to 10 s over. Under half the budget usually means you skipped something.
**Q: What if I need four minutes?** Cut, do not speed up. The 3:00 limit is the rule on Demo Day and the check list fails at more than 3:00.
**Q: Where do the 2 minutes of questions come from?** The guide: 3 minutes plus 2 minutes of peer questions per team.
**What this slide does not show:** any data from your project. The budgets are ours, from `out/pitch.json`.

## Slide 5: Problem, then what it does
**Q: What is a good problem sentence?** A person and a failure: "an agent that places orders will sooner or later send a bad one". Not "the market is big".
**Q: How many words fit in 30 seconds?** About 65 at a calm 130 words a minute. The sample problem is 50 words, about 23 s.
**Q: Can I use jargon?** Name each term once in plain words: "dollar bar: a candle that closes after a set amount has traded".
**What this slide does not show:** your script. The text is a sample for the risk-hooked agent.

## Slide 6: Part 3: live proof
**Q: What is the live fix?** One real decision end to end: input, rule, result. In the sample, alert 8: a sell of 1,064 USD against a 1,000 USD limit, refused by max-notional.
**Q: Why a failure test?** A demo that cannot fail proves little. Feeding four bad orders and showing four reasons shows the guard is real.
**Q: Are the four bad orders real trades?** No. They are injected on purpose and labelled injected.
**Q: What is devnet evidence if I have no transaction?** Say so and why, and show what you do have. In the sample: the devnet node verified the signature of my signed Memo transaction but the account has no SOL because the faucet rate limited; I do not claim a funded transaction.
**Q: Why is the faucet failing?** The public devnet faucet limits airdrops per day and per IP and a shared campus IP hits it fast (HTTP 429). Try early, from a phone hotspot, or use faucet.solana.com. Do not retry in a loop.
*If they push:* "Verified" in the sample means the node accepts the signature in simulation. It does not mean a transaction landed.

## Slide 7: Part 4: limit and next
**Q: Does admitting a limit lose points?** No. Utility has a check "states what it does not do". Hiding a limit costs more when a listener finds it.
**Q: What counts as untested?** Anything no test or recording covers: the live path, other markets, longer windows. In the sample: 17 minutes of one afternoon.
**Q: Why not show my simulated profit?** It is not scored, it is easy to over-read, and the sample's +3.00 USD comes from assumptions (order sizes, a 4 bps fee, fills at the next swap price).

## Slide 8: What the judge sees
**Q: Who are the judges?** The leads and invited reviewers. Do not assume guests; the guide says no guaranteed audience or credits.
**Q: Is it points out of 12?** It is a checklist of 12 evidence checks for you to self-score; we use it to say what to fix, not to rank by returns.
**Q: What if my lane is exchange or tooling?** Same three questions: a user and a problem, tests including a failure case, and devnet evidence that matches the claim.
**Q: Do I need a deployed program?** Only if your claim needs one. If not, "no deployment, off-chain agent" is a valid answer to d1 as long as you say it.
**What this slide does not show:** a ranking or a prize. Never advertise funding or terms.

## Slide 9: One set of evidence
**Q: What do you mean by the same claim in three places?** If the pitch says 9 accepted and 1 refused, `out/walkthrough.json` and a test must say it, and the demo must show it (alert 8).
**Q: What if the live demo and the recording differ?** Then one is wrong. Fix it before the freeze; listeners notice.

## Slide 10: The sample project
**Q: Where do the numbers come from?** 1,114 recorded Orca SOL/USDC swaps (cleaned) inside the Pyth window, 51 dollar bars, 10 alerts, 9 accepted and 1 refused, 9 ledger rows, from `out/walkthrough.json`.
**Q: Is the +3.00 USD real?** No. It is simulated on recorded data: no order was sent anywhere. It is not advice and not scored.
**Q: Why is the position 40 SOL with a tiny profit?** The agent only follows moves and never closes; the figure is marked at the last swap price. A hit rate of 67% on 9 fills over 17 minutes says nothing about the future.
**Q: Which earlier sessions did it come from?** Cleaning, dollar bars and CUSUM from build night 2; the risk hook from build night 1; a small ledger and scorecard in the spirit of build night 3 and workshop 4 (written fresh for tonight).
**What this slide does not show:** that the idea makes money. It shows a decision with a reason.

## Slide 11: The decision in code
**Q: What is `oracleAgeSec`?** Seconds since Pyth last published the price, from the publish time. Over 60 s the risk hook refuses.
**Q: What is a bps?** A basis point, 0.01%. 50 bps is 0.5%.
**Q: Why is the order price the bar close, not the oracle?** The agent proposes at what it saw; the hook compares it to the oracle and refuses if the gap is above 50 bps.

## Slide 12: When a live call fails
**Q: Why three failures?** One failure is often a blip; two means look; three in a row means stop waiting. Same rule as every demo's Live switch.
**Q: What do I say?** The switch sentence on the slide: the live call is not answering, so I am switching to recorded data from 2026-10-21; same logic on data I captured earlier.
**Q: Is the recorded backup cheating?** No, if you say it. Judges see real output from your repo; it is flagged recorded.
**Q: What if the whole screen fails?** Narrate the recording you made earlier. Everything in it should be real output from the repo.

## Demo 1 (slide 13): rehearsal timer
**Q: Is the timer measuring me?** Yes, your own run. Nothing in it is recorded from a real rehearsal; the "sample script" button only plays the estimated times at 10x.
**Q: Who fills the check list?** The timer sets the two timing checks; listeners click the seven content checks.
**What this does not show:** whether your pitch is any good. It shows time and whether the boxes are ticked.
**Live mode:** a strip with the live Pyth SOL/USD price, its age and the slot: something that changes while you talk. If it fails the page goes back to recorded and shows a red pill; ignore it.

## Demo 2 (slide 14): what the judge sees
**Q: Why does the sample score 9 of 12?** t4 (report from the frozen commit: not frozen), d2 (no transaction link opens) and d3 (no link to match the claim).
**Q: Why does the score not change when I lead with the profit?** By design: simulated returns are never scored.
**Q: What does the order slider do?** Sends a buy through the same risk hook; above 1,000 USD it is refused by max-notional.
**Live mode:** the order uses the live Orca price and the live Pyth price, with the age from your clock. A live age over 60 s would show max-oracle-age (the real Pyth feed has shown ages above 30 s before).

## Demo 3 (slide 15): live to recorded switch
**Q: Are the failures real?** In Recorded mode they are simulated by you. In Live mode "Broken" points the browser at a dead address, so the failed calls are real, forced by you. Neither is a real outage.
**Q: What is the stopwatch for?** From the first failed call to you saying the line and carrying on. Budget 30 s.
**What this does not show:** how your own app fails. Add the same rule to your code.

## Demo 4 (slide 16): sample project walk-through
**Q: Why does moving a slider change the decisions?** The page re-runs the agent in your browser with the new settings; at defaults it reproduces `out/walkthrough.json` exactly (verified by `lab/verify.mjs`).
**Q: Why are there only 10 alerts?** 51 dollar-bar closes are fed to CUSUM at 8 bps; lower the threshold for more.
**Live mode:** each poll (5 s) is a tick, the same CUSUM and risk hook run on the ticks against the live Pyth oracle; no ledger or scorecard in Live mode.
**What this does not show:** a profit. The ledger is simulated.

## Slides 17-25: try it, mission, menu, takeaways, closing
**Q: Do I need Node installed to use the demos?** No for the lab demos (open the HTML). Yes for the code (Node 24).
**Q: What is the freeze?** At 19:55 you stop changing the commit you will show. Branch if you want to keep working.
**Q: What if my backup recording is not ready?** Record `npm run demo -- --recorded` or your own demo for two minutes now.
**Q: What should my 3-minute script contain?** The four parts and the three places for each claim; use slide 5-7 and the sample script as a pattern.

## Live mode in general
Students see a Recorded/Live switch; Live reads public Solana data from the browser through publicnode, polls every 5 s and falls back after three failures with a red pill. If it is slow, stay on Recorded; say "public endpoint, shared by everyone". Never wait for Live.
Plain words: **slot** is Solana's block counter, about every 0.4 s. **Oracle age** is seconds since Pyth published. **bps** is 0.01%. **Slippage** is the difference between expected and filled price; here fills use the next swap price and a 4 bps fee assumption. **Devnet** is a free test network; its coins have no value.

## General questions
**Is this real money?** No. Reads are public mainnet data; every write is devnet only; no real funds.
**Can I lose funds?** Not with this repo: nothing signs or sends on mainnet, and no keys are needed. The only key is a throwaway devnet key created locally and gitignored.
**What is devnet?** A test network with free coins from a faucet.
**Can I use this for a real strategy?** No. It is a rehearsal kit and a tiny sample, simulated on 17 minutes of data. Not advice.
**What if setup fails?** Pair up, use a lead's laptop, or use the lab HTML demos (no install). Note the blocker.
**Where do I get help?** Leads in the room; the Solana support contact is Aaron on Telegram (@Aaron_Solanki) for program questions.
**Is there a prize?** Do not promise any. Prizes or funding are not advertised unless the program team confirms.
