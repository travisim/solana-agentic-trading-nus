# Q&A prep: Demo Day

For Travis, the judges and the leads, to answer questions while hosting. Grouped by slide number and demo. Slide numbers refer to the 20-slide deck. Answers are written to be said aloud.

Facts used below come from `demo-repo/code/out/` and `recorded/` (captured Wed 21 Oct 2026 19:35 UTC, which is Thu 22 Oct 03:35 Singapore time) and match the slides at build time. **Re-check after any re-recording or after the real `projects.json` replaces the template.**
- Mainnet slot 459,749,459 at capture; two reads 6 seconds apart gave about 4.63 slots per second (a later live run measured about 4.9).
- Two real devnet sample transactions (belonging to no student), both `finalized`: slots 513,629,343 and 513,629,341. The sample on slide 10 is the first one.
- Rubric (proposal, leads confirm): utility 30, reproducible tests 25, devnet evidence 25, clear explanation 10, sustained contribution 10, total 100. Scale 0 to 4 per criterion. Never scored: simulated returns, profit claims, backtest return charts.
- Schedule: seven slots of 3 + 2 minutes, 18:20 to 18:55, no changeover buffer; peer gallery 18:55-19:10.
- The template `projects.json` holds three EXAMPLE entries (agent, exchange, tooling), with example scores: tests 14/14, 22/24, 9/9; the agent example scores 62.5 / 100 on the scorecard with its recorded evidence (tests 3, devnet 3, others 2).
- Ship-readiness check: 11 checks, 7 required. The ready example passes 11/11; the gaps example passes 3/11 (1/7 required) inside `npm run demo`.
- 38 tests pass in `demo-repo/code`.

Rules to keep in every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated or computed on recorded data, not advice. No prizes, no funding promises, no returns claims, no referral promises.

---

## Slides 1-4: Title, three lanes, tonight, project gallery

**Q: Do I need to have been to the earlier sessions?** No. Tonight is a showcase; watching and trying demos is welcome. The gallery shows what each project is.

**Q: What are the three lanes?** Agent: a trading agent or strategy with honest validation. Exchange: a venue part such as an order book, matching or a deposit flow. Tooling: anything that helps the trading process, like data collection, a backtester, a monitor, a risk guard or a dashboard.

**Q: Are there prizes?** We are not announcing prizes or funding. If that changes, the leads will say so after confirming it with the Solana Foundation.

**Q: Who are the three projects in the gallery?** They are EXAMPLE entries from the template: not real projects, not real people. The real file replaces them on the day.

**Q: What is the gallery built from?** One file, `projects.json`. Run `npm run demo -- --recorded` and it writes `out/gallery.json` and a static `out/gallery.html`. The lab page also lets you load your own file; it is read in your browser and never uploaded.
- *If they push:* Test counts are self-reported by the teams. The judges re-run the tests from a clean clone.

**What slide 4 / demo 1 does not show:** real projects (until the real file is loaded) and anything about whether a project is good. It lists claims and shows the evidence that can be checked.

**Live mode (demo 1):** switch Live on to see the mainnet slot move (a read from `solana-rpc.publicnode.com`) and a read-only check of each signature on devnet. Slot = a number that counts Solana's time steps; it rises about 4 to 5 times a second in our readings. If the slot freezes or a red pill says `live unavailable, back to recorded`, stay on Recorded: same page, captured data.

## Slide 5: Rules of the room

**Q: Why devnet only?** Devnet is Solana's practice network. Nothing on it has real value, so a mistake costs nothing. No real funds and no seed phrases on screens.

**Q: Can I be photographed or filmed?** Only if you said yes at the door. Tell a lead if you change your mind.

**Q: What questions are good?** Ones evidence can answer: which command did you run, which test, where can I see the transaction.

## Slide 6: Three minutes, then two

**Q: Can I go over?** No; the timer decides so everyone gets a fair slot. Seven slots fit exactly between 18:20 and 18:55.

**Q: What if my demo fails?** Switch to your recorded backup and keep the clock running. A calm switch is a good demo.

**Q: How will I know the time?** The host signals at 2:30 (30 seconds left). The timer page is also on a second display.

## Slide 7: What three minutes holds

**Q: What if my project failed?** Say so. A clear negative result is valuable: tell the problem, the failed attempt, what you changed, the test and the limitation.

**Q: Do I need a returns chart?** No. Returns are not scored. A returns chart carries zero points; be ready to say which test or devnet transaction supports your claim.

**Q: How long should each part be?** The slide suggests 30, 30, 60, 40 and 20 seconds. It is a suggestion, not a rule.

## Slide 8: Order of presenters (and the run-of-show timer)

**Q: Why is this blank?** It is a placeholder by design: the real slot times (18:20 to 18:50 starts) are printed; the leads fill in projects on the day from the final list.

**Q: What if there are more than seven projects?** The extras take a 3-minute lightning slot or are shown in the peer gallery only; the leads decide before the doors open.

**Q: What does the timer page do?** A 3-minute demo clock then a 2-minute questions clock; Space starts and pauses; the slider shows how the table changes with 1 to 10 projects and warns above 7.

**What it does not show:** which project is where. Live mode shows the Solana slot only; that strip is not part of the timer.

## Slide 9: How projects are judged, and demo 2 (scorecard)

**Q: Why these five criteria?** They are the review criteria in the program guide: useful working project, reproducible tests, devnet deployment evidence, clear explanation and sustained contribution.

**Q: Are the weights final?** They are a proposal the leads confirm before tonight (30, 25, 25, 10, 10).

**Q: How is a total computed?** Each criterion scores 0 to 4. Points = weight times score divided by 4. All fours is 100; all zeros is 0.

**Q: Why is there a returns toggle?** To show that a returns chart changes nothing. The total does not move.

**Q: Is this a ranking?** The scorecard names each project's weakest criterion and a question to ask. That is feedback for the team. We are not announcing prizes.
- *If they push:* "Practice scores" stay in your browser tab and are not stored anywhere.

**What demo 2 does not show:** how to judge utility or explanation. Those are human calls; only tests and devnet start from evidence.

## Slide 10: Devnet evidence you can check

**Q: What is a signature?** A transaction's unique ID, 86 to 88 characters. With it anyone can ask devnet whether the transaction happened.

**Q: What does the check prove?** That the transaction exists on devnet and how confirmed it is (processed, confirmed, finalized). It does not prove what the transaction did or that your project sent it.

**Q: Why might a good signature say "not found"?** Devnet keeps recent history only, and some nodes lag. Freeze a recent transaction, and keep the recorded check.

**Q: Does the check send anything?** No. It is `getSignatureStatuses`, a read-only call.

## Slide 12: Peer gallery

**Q: What should I try?** Open a project that is not yours, follow its README, run its demo or tests, and leave one question that evidence can answer.

**Q: The wifi or endpoint is slow.** Many laptops share one campus IP and public endpoints rate limit (we saw this at Workshop 1). Use recorded data first; go Live one laptop at a time.

## Slides 13-14: What happens next, and demo 3 (ship-readiness)

**Q: What happens after Demo Day?** Feedback, community build time, and a retrospective tonight. The shared GitHub organisation and the group chat continue. Anything about referrals or guests: only what the leads have confirmed with the Solana Foundation.

**Q: Can I mentor the next cohort?** Tell a lead; it is voluntary.

**Q: What does the ship check do?** Reads a folder (never runs it) and runs 11 checks, 7 required: README run command, a test command, test files, no key files or secrets, no transaction sent on mainnet, a devnet signature or link written down, a recorded backup. Recommended: lockfile, .gitignore for .env, a Limitations section, a license.

**Q: Can it be wrong?** Yes: it is file-reading heuristics. The mainnet check looks for text, not behaviour. A pass does not mean the project is good.

**Q: Why does the gaps example fail the secrets check?** The demo adds a file with 64 zeros (key-shaped, not a key) to a temp copy. No real key exists in the repo.

**Live mode (demo 3):** a box lets you paste a devnet signature and check it (read only). It is enabled only in Live. Old signatures can be "not found".

## Slides 15-19: Try the demos, branch out, share back, code, connect

**Q: Do I need AI credits or keys?** No. Everything runs on bundled recorded data.

**Q: What do I run?** From `demo/code`: `npm install`, then `npm run demo -- --recorded`. Node 24.

**Q: How do I put my project in the gallery?** Edit `projects.json` (id, name, lane, team, summary, repo, tests, limitation, optional devnetSignature), set `"template": false`, run `npm run validate`, then `npm run demo -- --recorded`.

**Q: Where do I send my repo?** To the leads, this week, for the 48-hour report.

## General questions

**Is this real money? Can I lose funds?** No. Reads use public mainnet data; every write is devnet only; no real funds.

**What is devnet?** Solana's practice network with test tokens that have no value.

**Can I use this for a real strategy?** Everything here is simulated or computed on recorded data and is not advice. Nothing is scored on returns.

**What if setup fails?** Pair with a neighbour or use a lead's laptop, and note the blocker. The lab pages open from disk with no install.

**Where do I get help?** Ask a lead tonight; program support is @Aaron_Solanki on Telegram.
