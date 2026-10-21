# Host script: Demo Day

Host: Travis Sim. Thu 18 Feb 2027, 18:00-20:00, COM3/COM4. Voice: warm, direct, short sentences. Each block is embedded as the speaker notes of that slide. This is an event, not a lesson: the students are the show, so keep every host segment short and protect the 3 + 2 minute slots.
Timing: doors slides 1-4 (18:00-18:10); welcome slides 5-10 (18:10-18:20); demos 18:20-18:55 (slide 8 stays on screen as the order, with the timer demo open on a second display); scorecard slide 11 is for the judges before the demos; peer gallery slide 12 at 18:55; slide 13 at 19:10; ship-readiness slide 14 at 19:20; closing slides 15-20 at about 19:45.
Say "data collection" and "recorded data". Say "simulated, not advice" for any strategy result. No prizes, no funding, no referral promises, no claims about returns. If asked about guests, referrals or what happens after Demo Day: say only what the leads have confirmed with the Solana Foundation, and otherwise say "we will tell you as soon as it is confirmed".

## Slide 1: Title
[18:00] Welcome to Demo Day. Doors are open, the gallery is on the second screen, and check-in is at the door. Please find the photo-choice sheet and tell a lead what you are comfortable with: photos, recordings, neither. While people settle in, I am going to leave this slide up. Presenters: if you have not told a lead your slot yet, do it now, and open your recorded backup in a spare tab. Everything tonight runs on devnet or recorded data: no real funds, no seed phrases on any screen.

## Slide 2: Ten weeks, three lanes
[18:10] Ten weeks ago this program started with a question: could a group of students build real agentic trading projects on Solana in one semester? Tonight you answer it. There were three lanes. Agent: a trading agent or strategy with honest validation. Exchange: a venue part, such as an order book, matching, or a deposit and custody flow. Tooling: anything that helps the trading process, like data collection, a backtester, a monitor, a risk guard or a dashboard. Whatever your lane, tonight is the same test: show it working, show how you know, and tell us what is still weak.

## Slide 3: Tonight
[18:12] Here is the shape of the evening. We are in the welcome now. At 18:20 the demos start: three minutes to show, two for questions, up to seven slots, back to back until 18:55. Then the peer gallery until 19:10, where you try each other's work. Then feedback, then community build time, then a short retrospective. If you are here to watch, you are in the right place: every project has a gallery card you can open on your own laptop. Food is only provided if the budget is approved, so do not count on it.

## Slide 4: Demo: project gallery
[18:00 on the second screen, 18:13 if you want to talk through it] This is the project gallery. It is built from one file, projects.json. Each card shows the lane, the team, the repo and demo links, test results and devnet evidence. Use the lane buttons to filter. The three cards you see in the template are labelled EXAMPLE: they are not real projects, they show what a good entry looks like. On the day the leads replace them with the real file. Try it yourself at the link on the slide, and switch Live on to see the real Solana slot move and to have your browser check a transaction signature on devnet, read only. If Live is slow, stay on Recorded: it is the same page with captured data. Test counts on the cards are what each team reports; the judges re-run them.

## Slide 5: Rules of the room
[18:14] Four rules. One: devnet only. Everything you run tonight is devnet or recorded data, and no seed phrase or key should be on a screen. Two: the timer decides. Three minutes to demo, two for questions, and when it ends I will thank you and we move on, so the next team gets their full time. Three: ask for evidence. The best questions start with which command, which test, where can I see it. Four: photos by choice. You told a lead at the door, and we will respect it. Questions about the rules? Good. Presenters, this is the last time I talk for a while.

## Slide 6: Three minutes, then two
[18:15] The clock. You start at 0:00 and your first sentence says what it does. At 2:30 I give you a signal, so there are no surprises, and at 3:00 the demo ends and questions start. At 5:00 the slot ends and the next presenter is already at the laptop. There is no changeover buffer, because seven slots fit exactly between 18:20 and 18:55, so please hand over the laptop quickly. Keep your recorded backup open in another tab: if the network or the demo fails, switch to it and keep talking. A calm switch to the backup is a good demo.

## Slide 7: What three minutes holds
[18:16] A structure you can borrow. Problem, in one sentence: what hurt. Failed attempt: what did not work, and show it if you can. Useful change: what you changed and what it does now. Test: the exact command and its result. Limitation: what is still weak. The times on the slide are a suggestion: about 30 seconds, 30 seconds, a minute, 40 seconds, 20 seconds. A clear negative result is valuable. If your agent failed on stale prices and you caught it, that is a good story, tell it. We do not score returns, so you do not need a profit chart.

## Slide 8: Order of presenters
[18:17, then stays on screen] This slide is a placeholder for the order. The seven slot times are real: 18:20, 18:25, 18:30, 18:35, 18:40, 18:45 and 18:50, each with 3 minutes to demo and 2 for questions. The leads fill in the project and team for each slot from the final list before the doors open, and read it out. If there are more than seven projects, the extra ones take a lightning slot or go to the peer gallery. The run-of-show timer on the second display uses these same slots: Space starts and pauses it. The link is on the slide, and the timer has a Live switch that shows the real Solana slot; that strip is not part of the timer.

## Slide 9: How projects are judged
[18:18] This is the published review criteria. Five things, 100 points. Utility, 30: would someone else use this or learn from it. Reproducible tests, 25: can a stranger run the tests from a clean clone and get the same result. Devnet evidence, 25: is there a devnet transaction or program anyone can check. Clear explanation, 10: was the story clear. Sustained contribution, 10: did the work grow over the semester, with commits from the whole team. The weights are a proposal that the leads confirm before tonight. And the line at the bottom: simulated returns, profit claims and backtest return charts are never scored. We are not announcing prizes or funding tonight; if that changes, the leads will say so.

## Slide 10: Devnet evidence you can check
[18:19] What counts as devnet evidence. A signature on a slide is a claim. A signature that devnet confirms is evidence. So: show the transaction signature in your README or on screen; we ask devnet, which is a read-only call that sends nothing; and we read the answer, a status such as finalized and a slot, or not found. The sample on this slide is a real check we made on 22 October 2026 on a devnet transaction that does not belong to any student. One caution: devnet keeps recent history only, so a very old signature can come back not found. Freeze a transaction you can still show on the day, and note it in your demo pack.

## Slide 11: Demo: judging scorecard
[Before 18:20, for the judges] This is the scorecard the judges use. Pick a project, and five sliders from 0 to 4 give a total out of 100. Tests and devnet start from the evidence on the card; the judge sets the rest. Watch the bottom right: there is a toggle for a team showing a returns chart, and when you press it the total does not move, because returns are not scored. Practice scores stay in this browser tab. The scorecard also names the weakest criterion with a question to ask: that is the feedback, not a ranking. Live mode shows the Solana slot and re-checks the signature on devnet. If it is slow, Recorded is identical.

## Slide 12: Peer gallery
[18:55] Demos are done, thank you all. Now the peer gallery until 19:10. Everyone: open a project that is not yours from the gallery, follow its README, run its demo or its tests, and leave one question that evidence can answer. Three examples on the slide: which command did you run and what did you see; where is the test for the failure case; can I check that transaction on devnet. The goal is that everyone reproduces at least one thing before 19:10. If many laptops hit the same public endpoint at once it can rate limit, so use the recorded data first and go live one at a time.

## Slide 13: What happens next
[19:10] The rest of the evening is voluntary. At 19:10, feedback and next steps: tell us what you would use or contribute to, and what you would test before relying on it. At 19:20, community build time: reproduce a demo, open an issue on a project, or agree a small next experiment with the team. At 19:45, a short retrospective: what changed after a failed attempt, and who wants to keep building. If anyone is interested in helping mentor the next cohort, tell a lead. Any mention of referrals, guests or opportunities after tonight: only say what the leads have confirmed with the Solana Foundation. Nothing else.

## Slide 14: Demo: ship-readiness check
[19:20, community build time] A practical tool for the build time. It reads a project folder and tells you if a stranger can clone it, run it and trust it. Eleven checks, seven required: a run command in the README, a test command, test files, no keys or secrets, no transaction sent on mainnet, a devnet signature or link written down, and a recorded backup. The demo runs it on two example repos: one ready, one with gaps. Click any row to ask what if. Run it on your own repo with the command on the slide, fix every required gap, and rerun. It only reads files and never runs your code. It is a set of heuristics, so it can miss things.

## Slide 15: Try the demos yourself
[19:45] Everything you saw tonight is public: the gallery, the scorecard, the timer and the ship-readiness check. Scan the code or open the link on your laptop. No install. The same files are in the repo and open from disk. Each one has a Live switch that reads real Solana data from your own browser, read only, and falls back to recorded data if an endpoint is slow.

## Slide 16: Branch out
[19:46] After tonight, in your own time. Beginner: run a peer's project from its README and write down every step that failed. Standard: open an issue on that repo with the command, the output and what you expected. Advanced: add a test or a fix for it, or run the ship-readiness check on your own repo and close every required gap. The point of the semester was a project a stranger can use. Reproducing someone else's work is the quickest way to learn what makes that possible.

## Slide 17: Share back
[19:48] Three things. Tonight, before you leave: leave one evidence-based question for a peer, on the card or in the group chat. This week: send your repo link and demo pack to the leads, they need it for the 48-hour report. Any time: keep your repo public and tell the group when you ship a fix. The shared GitHub organisation and the group chat stay open after tonight.

## Slide 18: Get the code
[19:50] The code behind the tools is in the public repo, in the folder on the slide. Two commands from the demo slash code folder: npm install, then npm run demo with the recorded flag. You get a validator for projects.json, the gallery, the schedule and the ship-readiness check. Node 24, no keys, no AI credits, recorded data bundled. Reads use public mainnet data, and every write is devnet only, with no real funds. Scan the code to open the folder.

## Slide 19: Let's connect
[19:52] If you want to keep in touch, scan the QR codes. LinkedIn on the left, Telegram on the right: linkedin.com/in/travisim and t.me/travisim. For program questions, Aaron Solanki is the Solana University contact on Telegram. Thank you for ten weeks of work.

## Slide 20: Solana
[19:55] Thank you, everyone. That is Demo Day. Leave this slide up while people leave and the leads collect repo links, photos and the last check-in scan.
