# Teaching script: Build night 5, Demo Rehearsal

Presenter: Travis Sim. Thu 11 Feb 2027, 18:00-20:00 (doors 17:45). Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing (from `general/NUS-Weekly-Session-Guide.md`, "Active week 9"): readiness circle 18:00-18:15 (slides 1-3); lesson 18:15-18:35 (slides 4-12, then demos 13-16 as a quick tour inside the lesson or on request); rehearsal 1 18:35-19:05; fix the weakest claim 19:05-19:35 (slides 17-19 stay on screen); rehearsal 2 19:35-19:55; freeze and send 19:55-20:00 (slides 20-25).
This is a build night, but the teams drive: the slides are short on purpose so most of the time is rehearsal. Say "data collection" and "recorded data". Say "simulated, not advice" for any ledger number. No prizes, no profit claims. Book ideas stay in the Q&A notes; none on slides.

## Slide 1: Title
[18:00] Welcome to the last build night. Next Thursday is Demo Day, so tonight is not about new features. It is about making what you already have easy to understand in three minutes, and honest about what it does not do. We run two timed rehearsals, with a fix block in between, and at the end you freeze your commit and send your demo pack to the leads. If you came to this one first, you have not missed anything you need: everything you need tonight is in the repo and the demos.

## Slide 2: Where we are
[18:02] Quick orientation. Workshop 4 last week was the scorecard and shipping, so your projects should be close to a working state. Tonight is rehearsal and freeze. Next Thursday, the eighteenth, is Demo Day. After tonight there are no speculative features: whatever works at the freeze is what you show. Readiness circle now, one line each: who is presenting, is your repo link ready, and what evidence is still missing. If you are missing a devnet link, say so now; that is the most common gap and we can fix it tonight.

## Slide 3: Tonight
[18:10] The shape of the night. Fifteen minutes to get ready, twenty minutes of me talking about structure, then rehearsal one: three minutes each, then two minutes of questions from peers. After that thirty minutes to fix the weakest claim and rerun the core test. Rehearsal two, with different listeners, and test your recorded backup. Last five minutes: freeze the commit and send the pack. I will keep my part short. The time is yours.

## Slide 4: Three minutes, four parts
[18:15] Three minutes is short. Here is the budget. Problem, thirty seconds. What it does, thirty-five. Live proof, seventy-five: this is the longest part on purpose, because it is the part nobody can argue with. Limit and next, forty seconds. Then two minutes of questions. The numbers on this slide are exactly what the timer in demo one uses. The rule: if any part runs more than ten seconds over, the check list fails. If a part is under half its budget, you are probably skipping something. You do not have to hit the budget to the second. You have to know where your time goes.

## Slide 5: Problem, then what it does
[18:20] Parts one and two. Problem: who has it, in one sentence. Not a market, a person. My sample says: an agent that places orders will sooner or later send a bad one, too big, from a stale price, or in the wrong unit. What it does: the idea and the parts, no jargon. My sample says it reads recorded Orca swaps, cuts them into dollar bars, wakes on a change alert, proposes an order, and a risk hook says yes or no with the rule that decided. Read both aloud at normal speed and they take about fifty seconds, which fits. Your wording will differ. The shape should not: a person, a problem, the parts.

## Slide 6: Part 3: live proof
[18:24] Part three is where the pitch is won. Three things, in this order. One: a live fix, which means show one real decision end to end. In my sample the run has ten change alerts, nine orders accepted and one refused by the max-notional rule. Two: the failure test. I feed it four bad orders on purpose, a five thousand dollar order, an oracle that is three hundred seconds old, a price in cents, and a price a hundred basis points off. All four are refused, each with its own reason. Say the reasons out loud. Three: devnet evidence. Open a link, or say there is none and why. In my sample the devnet node verified my signed transaction, but the faucet was rate limited, so I have no funded transaction link. I say that plainly. That is better than a link I cannot open.

## Slide 7: Part 4: limit and next
[18:28] Part four is where you earn trust. Say one limitation in your own words. Say what is untested. Say the next step in one sentence. In my sample: it is simulated on recorded data, about seventeen minutes of one afternoon; order sizes and the fee are assumptions; nothing was sent anywhere. On the right, three things not to say. No return or win rate as the headline. No capability the tests do not cover. No link you have not opened tonight. If someone asks a question you cannot answer, point to a test or admit the limit. Do not invent a capability.

## Slide 8: What the judge sees
[18:30] Here is how Demo Day is judged: three questions, four checks each. Utility: a named user and problem, runs from a clean checkout using only the README, one decision shown end to end, and what it does not do. Tests: npm test passes with the report attached, a test for the failure case, tests run offline on recorded data, and the report is from the frozen commit. Devnet evidence: an address or a stated reason, a transaction link that opens, a claim that matches the link, and reads labelled mainnet and writes labelled devnet. Twelve checks. Simulated returns are not on the list. If your pitch leads with a simulated profit, it scores nothing and takes time away from the part that scores.

## Slide 9: One set of evidence
[18:32] The single most useful rule for tonight: the same claim must be true in three places. In the pitch, in the repo, and in the running demo. Take one claim from my sample: nine of ten alerts were accepted and one was refused by max-notional. The pitch says it. The test and the out file in the repo contain it. The demo shows it, live or from the recorded copy. If any of those three disagree, a listener will find it in the questions. Tonight, for your weakest claim, find all three places and make them match.

## Slide 10: The sample project
[18:34] A sample project for the walk-through, built only from pieces you already have. Recorded Orca swaps from build night two, cleaned and cut into dollar bars; a CUSUM change alert; one order per alert; the risk hook from build night one; accepted orders go into a ledger. On the slide: one thousand one hundred and fourteen real swaps inside the Pyth window, fifty-one dollar bars, ten alerts, nine accepted and one refused, nine ledger rows. The scorecard says plus three dollars net, simulated, on recorded data, not advice. It is there to show the idea of a ledger. It is not evidence of anything and judges do not score it. Reads are public mainnet data; every write is devnet only; no real funds.

## Slide 11: The decision in code
[18:36] The core of the sample is these few lines. The alert proposes an order, with a side and a size from how far the bucket filled. The oracle gives the context: the Pyth price and how old it is. The risk hook checks the order against the context and says yes or no with the rule that decided. Notice what makes this demo-able: the input is recorded, the rule is plain code, the output is a decision with a reason. If your project has that shape, your live proof is easy. If it does not, ask what your input, your rule and your decision are.

## Slide 12: When a live call fails
[18:38] Live calls fail. Wi-Fi in the room is shared and public endpoints get rate limited. Plan for it. The rule, same as every demo you have used: a failed call is tried again; the third failure in a row switches to recorded data. Then you say one sentence, carry on from the same step, and do not restart. Aim to be back on track within thirty seconds of the first failure. If the whole screen fails, you narrate your backup recording. The recording is not a cheat, it is real output from your repo that you captured earlier. The drill in demo three practises exactly this.

## Slide 13: Demo: rehearsal timer
[18:40] Demo one, the rehearsal timer. Predict first: which part do you usually run over? Open it, press the space bar to start, and the space bar again to move to the next part. The bar shows budget against time used, and each part gets a status: on budget, a little over, or way over. When you finish, the check list gives a verdict: ready, not finished, or fix and rerun. Two of the nine checks come from the timer, seven from your listeners. There is a button that plays the sample script at ten times speed so you can see a passing run. Live mode adds a strip with the current Pyth price and slot, which is a number that changes while you talk. It is not part of the timer. Try it on your laptop.

## Slide 14: Demo: what the judge sees
[18:43] Demo two, the judge view. Predict first: which two checks does the sample pack miss? Open it. The sample scores nine of twelve. It misses the test report from the frozen commit, because we have not frozen, and the two devnet checks that need a funded transaction. Click a check to see the score move. Press lead the pitch with a simulated number and watch: the score does not change, and the page tells you to cut it. The box on the right sends one order through the risk hook; drag the size past one thousand dollars and watch max-notional fire. Live mode uses the live Orca price and the live Pyth price in that box.

## Slide 15: Demo: live to recorded switch
[18:46] Demo three, the switch drill. Predict first: how many seconds from the first failed call to carrying on? In recorded mode you press make a call with the network set to broken; after three failures the source flips to recorded. The right side shows what to do and what to say at each step. The stopwatch starts at the first failure and stops when you press I said it and carried on. Budget is thirty seconds. In live mode the broken switch points your browser at a dead address, so the failures are real and the same rule fires. Practise saying the switch sentence out loud once. It is fine to read it.

## Slide 16: Demo: sample project walk-through
[18:49] Demo four, the sample project walk-through, one decision at a time. Predict first: which alert will the risk hook refuse, and which rule fires? Step through the ten alerts with the arrows. Alert eight is the refusal: a sell of one thousand and sixty-four dollars against a one thousand dollar limit. Move the max order slider and watch the decisions change. Then press one of the four failure buttons: five thousand dollars, stale oracle, price in cents, a hundred basis points off. Each is refused with a reason. Live mode feeds live price ticks through the same change alert and the same risk hook against the live Pyth price.

## Slide 17: Try the demos yourself
[18:52] The four demos are online and in the repo. Scan the code, open them on your laptop, and use the timer for your own pitch in rehearsal one. No install is needed, they open from disk too. If the hosted copy is slow on the shared Wi-Fi, open them from the cloned repo, the lab folder. Everything defaults to recorded data so nothing breaks offline.

## Slide 18: Your mission
[18:35] This is the rehearsal block. Time: run your three minutes against the timer, with listeners. Listen: peers each note one unclear claim, only one, so the feedback is usable. Fix: take the weakest claim, find where it is true in the pitch, the repo and the demo, and fix the disagreement, then rerun the core test. Backup: play your recording with Wi-Fi off and check that you can narrate it in the time. Finish line for the block: one claim a listener can restate in a sentence. Rehearsal two, at 19:35, has different listeners.

## Slide 19: Build menu
[19:05] Between the rehearsals. Beginner: tighten the script to the budget. Cut a sentence, do not talk faster. Standard: add the missing evidence to the pack, or rehearse offline from the recording. Advanced: add a test for the failure you demo, so the refusal in your pitch is also a line in your test report. If you are not sure what to fix, open the judge view demo, fill your own checks honestly, and fix the first red one. No new features. After the freeze, nothing speculative.

## Slide 20: Takeaways
[19:55] Three things to take away. One: use the same evidence in the pitch, the repo and the running demo. Two: say what works, what failed and what is untested. Three: a good answer to a question points to a test or admits a limitation; it does not invent a capability. If you remember only one, make it the first: it is what makes a three-minute demo believable.

## Slide 21: Branch out
[19:56] After tonight, in your own time, before Demo Day. Beginner: time your pitch three times and trim the part that always runs long. Standard: fill your own demo pack in the rubric and fix the first missing check. Advanced: write one funded devnet transaction per decision and open the link in your pitch; use the faucet early in the week, because it rate limits. Remember the freeze: tonight's commit is what you show, so branch out on a branch, not on the frozen one.

## Slide 22: Share back
[19:57] Before you leave: freeze the commit and send the demo pack to the leads. The pack is the repo and frozen commit, your three-minute script, the recorded backup, the test report, deployment addresses, transaction links and stated limitations. Next Thursday is Demo Day: same evidence, same script. Any time: send your repo link to the leads, and tell us what is blocking you early rather than on the day.

## Slide 23: Get the code
[19:58] The code for tonight is in the shared repo, folder zero zero zero nine demo rehearsal, under demo. Scan the code or use the address. npm install, then npm run demo with recorded. Node 24. No keys, no AI credits, the recorded data is bundled. The folder holds the timer and check list logic, the rubric, the drill, and the sample project, plus the four demos. The sample project is a pattern to copy: input, rule, decision with a reason.

## Slide 24: Let's connect
[19:59] If you want to talk about your project, your pitch or what to build next, find me on LinkedIn or Telegram. The codes are on the slide. Thank you for working hard tonight. See you at Demo Day on the eighteenth.

## Slide 25: Solana
[20:00] Thank you. Photos, last check-in scan, and pack up. Leads: confirm every team has sent its demo pack before they leave.
