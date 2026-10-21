# Teaching script: Workshop 4, Performance Scorecard and Shipping

Presenter: Travis Sim. Thu 4 Feb 2027, 18:00-20:00. Lead-led workshop. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing: welcome and progress circle slides 1-4 (18:00-18:10); teaching slides 5-24 (18:10-18:50, about 2 minutes each); live demos slides 25-30 (18:50-19:15); mini-lab slide 31 (19:15-19:30); build menu slide 32 and open build (19:30-19:55); takeaways and closing slides 33-38 (19:55-20:00).
Say "data collection" and "recorded data". Say "simulated, on recorded data, not advice" for any strategy result. No prizes, no funding, no return claims.
Background reading for you only (not for slides): Advances in Financial Machine Learning, chapter 14 (performance statistics such as drawdown, time under water and turnover) and chapter 15 (strategy risk: the precision a strategy needs given its payoffs). Our versions are inspired by those chapters, simplified; the lab demos, the sample ledger and the 14-point ship check are ours, not the book's.
Numbers below match demo-repo/code/out/*.json. If you re-run with other cost settings, the numbers change; the story does not.
Read first: operations/post-workshop-report/workshop-1/CLAUDE.md and the notes of Build night 4 (0007), then run the dry-run checklist.

## Slide 1: Title
[18:00] Welcome, thanks for coming. I'm Travis. This is Workshop 4, the last workshop before Demo Day on the eighteenth. Two halves today. First half: how to measure your project honestly, with a handful of numbers. Second half: how to ship it so someone else can run it and trust it. We have about forty minutes of talk, twenty-five of demos, a short lab, and then you build on your own project. If you haven't run the setup, put your hand up now and a lead will come to you.

## Slide 2: Where we are
[18:02] Quick progress circle. Last Thursday, Build night 4, we broke our own backtests on purpose: leaks, purged splits, failure tests. Today is Workshop 4: the scorecard and shipping. Next Thursday, the eleventh, is Build night 5, a demo rehearsal. Demo Day is Thursday the eighteenth. Go round the room, one line each: where is your project, and what is the one thing that would stop a stranger running it? Today's question is on the slide: could a stranger trust your numbers and run your project? Hold that thought.

## Slide 3: Today
[18:07] The shape of the night. Ten minutes of progress circle, which we are in now. Forty minutes of teaching: first the scorecard numbers, then shipping. Then twenty-five minutes of live demos, five of them, and before each one I ask you to predict the result. Then a fifteen minute mini-lab where you score a ledger and break one number on purpose. Then twenty-five minutes of open build on your own project; the leads rotate. At five to eight you push and give one line on your next step.

## Slide 4: What you leave with
[18:09] This is what a finished evening looks like. Six things in your repo: a tested commit where npm test passes; a README with run steps that work from a clean checkout; devnet evidence, which is an explorer link that actually resolves; one known limitation written down; a three-minute demo script with a recorded backup; and feedback from a peer who ran it. Not on the list: a big simulated return. We judge utility and engineering evidence, never simulated returns. Keep that sentence in your head for the rest of the night.

## Slide 5: A ledger is the input
[18:10] Everything today starts from a trade ledger: one row per closed trade. The table is real: the first rows of our sample ledger, 45 trades from the sample strategies on forty minutes of recorded SOL/USDC data from the 21st of October. Columns: which strategy, long or short, when it opened and closed, entry and exit price, and the gross profit or loss in dollars. Gross means before costs. We keep costs out of the ledger on purpose: the scorecard applies fees and slippage, so you can change them and see what happens. There are optional on-chain fields too, like the signature and the failed status. If your project has no real transactions, leave them out. The scorecard will say not available rather than guess. Simulated, on recorded data; not advice.

## Slide 6: Hit rate alone says nothing
[18:12] The number everyone quotes first is hit rate: how often you win. Look at these two made-up strategies. Left one wins nine trades out of ten. Sounds great. But each win pays one and the one loss costs twelve. Nine minus twelve: it loses three per ten trades. Right one wins only four out of ten, but wins pay three and losses cost one. Four times three is twelve, six losses cost six, so it makes six per ten. These numbers are illustrative, not from our data. The point: a hit rate needs the size of the wins and losses beside it. Ask the room: which would you rather own?

## Slide 7: Win size, loss size, break-even
[18:14] So how often do you need to win? That depends on the payoff. Break-even hit rate equals average loss divided by average win plus average loss. If wins and losses are the same size, you need to win half the time. If wins are twice the losses, a third is enough. Now our real ledger. With zero costs, the hit rate is 42 percent, average win 0.69 dollars, average loss 0.44, so break-even is 39.0 percent. We are just above it. Add seven basis points per leg, fee plus slippage, and the same 45 trades give a hit rate of 11 percent, average win 0.45, average loss 1.40, break-even 75.8 percent. Nobody is close. Same trades; only the costs changed. Simulated, on recorded data; not advice. Background for you: this is the same idea as the book's chapter 15, simplified.

## Slide 8: Gross is not net
[18:16] Three cost settings on the same 45 trades. With no costs the ledger makes 3.00 dollars gross. With 5 plus 2 basis points per leg it loses 53.70. With 12 plus 5, it loses 134.60. Why so brutal? A round trip pays costs on both legs: fourteen basis points at the base setting. In our recorded data the gap between venues was typically one to three basis points and at most 6.3. The edge is smaller than the toll. Costs are paid on every leg, win or lose. Good question to ask your own project: what is my gross edge per trade in basis points, and what does one round trip cost me? If the first is smaller than the second, stop and rethink.

## Slide 9: Drawdown and time under water
[18:18] Two numbers about pain. Drawdown: how far equity fell from its previous peak. Time under water: how long it stayed below that peak. The picture is from demo 2 with zero costs. Even with zero costs the ledger nets plus 3 dollars, but the max drawdown is 3.84 dollars, bigger than the profit, and equity spent 82 percent of the window below a previous peak, the longest stretch 29 minutes. With the base costs it is under water 99 percent of the time. Why it matters: a strategy that ends up slightly positive can still be unlivable on the way. Ask: how long would you hold something that is red 82 percent of the time? We will play with this in demo 2.

## Slide 10: Turnover
[18:20] Turnover is how much you traded compared with what you hold. We start with 10,000 dollars of capital. The 45 trades, two legs each at 1,000 dollars, traded 83,000 dollars: 8.3 times capital in forty minutes. Per strategy: basis 3.8 times, trend 2.0, mean reversion 1.8, the market maker 0.7. Costs scale with turnover. So when someone shows you a gross number, ask for turnover next. A strategy that needs enormous turnover to produce a small edge will be eaten by costs. Simulated, on recorded data; not advice.

## Slide 11: The scorecard on one page
[18:22] Put the numbers together and you get the scorecard. This is demo 1 at the base costs. Eight cards: net P and L, hit rate against break-even, average win and loss, max drawdown, time under water, turnover, costs against gross profit, and the chance the true hit rate is below break-even, which is the next idea. Below, one bar per trade: green is a win after costs, red a loss, lavender tick is the gross. Notice how many bars the costs push from a small win to a loss. The verdict on this page: net minus 53.70 dollars, hit rate 11 percent against 75.8 needed. That is an honest dashboard saying: do not ship this as a profitable strategy. It might still be a fine project: the scorecard is the feature.

## Slide 12: The code behind it
[18:24] There is no magic in this. The function net takes a trade and the cost settings: gross minus the number of legs times fee plus slippage times the notional. Break-even hit rate: loss over win plus loss. And failureProbability: from the hit rate you saw, how many trades, and break-even, it returns the chance the real hit rate is below break-even, using a normal approximation. About fifteen lines. Read the whole file src/scorecard.ts tonight, it is short. In the mini-lab you will change an input and watch these functions react.

## Slide 13: Run it
[18:26] This is the real terminal output from npm run demo with recorded data. First a table per strategy, then the whole ledger in words, then what this cannot say. Point at the line "What this cannot say": forty minutes of one quiet night is one path, not a distribution. The program says this itself. You can copy that habit: have your code print its own limits. Everything is recorded data bundled in the repo, no network, no keys. If someone's machine fails here, they run --recorded and nothing else; a lead helps.

## Slide 14: Probability of failure
[18:28] Second idea from the book, in our words. You saw a hit rate over N trades. The real hit rate is unknown. Break-even tells you how low the real one can be before you lose money. So: what is the chance the real hit rate is below break-even? Example on the right, made up: 45 percent hit rate, wins pay the same as losses, so break-even is 50. After 10 trades, the chance is 62 percent. After 30, 71. After 100, 84. After 200, 92. After 500, 99 percent. Same hit rate, more trades, surer answer: the more you watch, the surer you are that 45 is below 50. Our real ledger has 45 trades, and the code warns below 30 trades. It is a normal approximation, a rough guide, not a guarantee. If they push: it ignores that trades may not be independent.

## Slide 15: What simulated numbers can and cannot say
[18:30] Be honest on the dashboard itself. Simulated numbers can say: whether an idea is worth testing more, which costs matter most, and how deep and how long a drawdown looked on this data. They cannot say: what happens next, a return you could earn, how busy markets behave, or what your own order does to the price. Our sample is forty minutes on one quiet night, 21 October, 17:14 to 17:54 UTC. Put a sentence like this next to your chart. Judges trust projects that name their limits. Simulated, on recorded data; not advice.

## Slide 16: What Solana itself costs
[18:32] Solana's own costs, from a real capture: five finalized blocks on the 21st of October, 2,680 transactions. The protocol base fee is 5,000 lamports per signature. The median fee paid was 5,222 lamports: about 0.0006 dollars, or 0.006 basis points of a 1,000 dollar trade. About 65 percent of transactions paid some priority fee. And 35 percent of the transactions in those blocks failed, between 28 and 44 percent per block. That failure rate is mostly bot traffic that fails by design, so it says little about your own failure rate, and five blocks on one evening is a sample, not a measurement of Solana. Not captured: Jito tips. Lesson: on-chain fees are tiny next to venue fees and slippage here, but failed transactions still pay the base fee. If your project sends real transactions, put fees, priority fees, tips, the failed rate and explorer links in your dashboard.

## Slide 17: What judges look at
[18:34] Switch to shipping. On Demo Day judges look at three things: utility, tests, devnet evidence. Utility: does it solve a real problem for someone, and can they say who. Tests: can a stranger run npm test and see it pass. Devnet evidence: an explorer link that resolves, for a transaction you made. Never simulated returns. A project with a beautiful equity curve and no tests loses to a plain one that runs. No prizes or funding to talk about here; we are judging engineering evidence.

## Slide 18: README anatomy
[18:36] A README has six blocks. What it is: one sentence, one reader. Run it: exact commands from a clean checkout, and what output to expect. What you will see: one picture or three lines. Devnet evidence: an explorer link, or the word none. Known limitation: one honest sentence. Safety: devnet only, no keys, simulated results are labelled. The code card is from the template in templates/README.template.md. Copy it today. A first-time reader should see both the benefit and the limit within thirty seconds.

## Slide 19: Tests and devnet evidence
[18:38] Tests: one command runs them, they pass from a clean checkout, and ideally there is a test for each number you print. Devnet evidence: the link format is explorer.solana.com slash tx slash the signature, question mark cluster equals devnet. Two rules. A link is not evidence until it resolves; demo 5 can check that live against devnet. And never paste a key or a keypair into a doc. Evidence means a transaction you made, not a screenshot of a chart. Writes are devnet only, no real funds; if you need devnet SOL, use a throwaway keypair that is gitignored and ask a lead about airdrop limits.

## Slide 20: Secrets and repo hygiene
[18:40] Before you push, scan. The ship check looks for secret files like .env, id.json, keypair files and pem files, and for key-shaped text: a list of 64 numbers, or PRIVATE_KEY equals a long string. It checks your .gitignore covers .env and node_modules, that there is a licence, and that there is no junk like DS_Store or big files. The terminal card is the real output of the ship check run on this sample project itself: 13 of 14 pass; the one warning is devnet evidence, because this project makes no devnet writes. If a real key ever reached git, rotate it: deleting the file does not remove it from history. It prints where the problem is, never the secret.

## Slide 21: Demo script
[18:42] Now the Demo Day prep. Your demo script, three minutes. Twenty seconds on the problem: who loses what, with one example. A minute on the run: the exact command, and say what to look at before you press enter. Forty seconds on evidence: a passing test run or an explorer link. Thirty seconds on the limit: one thing it does not do. Twenty seconds on what is next. Rehearse it twice with a timer. Template in templates/DEMO-SCRIPT.template.md.

## Slide 22: The 2-minute pitch
[18:44] Shorter version, two minutes, five parts. Problem, zero to twenty seconds. What it does, twenty to fifty, show it. Evidence, fifty to eighty: tests pass, devnet link, one output. Limit, eighty to a hundred and five: it does not X, so Y. Ask, last fifteen seconds: run it, here is the repo, next I will Z. Write one sentence for each part tonight. You will refine them at Build night 5.

## Slide 23: Cold-start test
[18:46] The best README test is someone who is not you. Four steps. Copy the project to a clean folder with no node_modules and no out folder. Follow only the README, nothing from memory. The peer types; you stay silent and watch where they stall. Then fix the README, not the peer. There is a command, npm run smoke, that does the mechanical part: it copies the project to a temp folder and runs only the README commands: install, test, demo. Run it first, then ask a peer. Feedback sheet is in templates/PEER-FEEDBACK.md.

## Slide 24: Recorded backup
[18:48] Decide before you walk up: what happens when the network fails, the laptop fails, or a command is slow. Network fails: run with --recorded; the data is in the repo. Laptop fails: screenshots and a PDF, also in the repo. A command is slow: know what you will say while it runs. And test the backup, not just the live path. In a classroom everyone shares one campus network address, and public APIs rate limit: in our tests Jupiter's free quote API answered 429 after about one call. Do not depend on the network for your demo. That is why every demo we show today has a recorded mode.

## Slide 25: Demo 1: scorecard from a ledger
[18:50] Demo time, five demos. Before each one: predict. Demo 1: the scorecard. Question: at zero costs, does this ledger make money? And at seven basis points per leg? Let people answer. Run the command with zero costs in the terminal, or open lab 01 in the browser. Drag the fee and slippage sliders: net goes from plus 3.00 to minus 53.70 at 5 plus 2 and minus 134.60 at 12 plus 5. Pick a strategy button: trend, 10 trades, 20 percent hit rate. Switch on Live: it shows the live Jupiter versus Orca gap against your cost line and counts how many live ticks cleared it; usually none. What this does not show: a future return; it is 45 trades on 40 minutes. If Live fails, the pill says rate limited and it falls back to recorded.

## Slide 26: Demo 2: drawdown and time under water
[18:55] Demo 2. Predict: with zero costs, how much of the forty minutes does the equity spend below a previous peak? Collect guesses, then open the demo with costs at zero: 82 percent, longest stretch 29 minutes, max drawdown 3.84 dollars, final plus 3.00. Drag the time cursor: it tells you how many minutes since the last peak. Then set the sliders back to 5 and 2: 99 percent, max drawdown 53.70. Live mode adds a paper long of 1,000 dollars from the moment you switch Live on, marked to the live Orca price, so you see an underwater chart being drawn. What it does not show: open positions are not marked to market in the recorded ledger.

## Slide 27: Demo 3: hit rate versus payout
[19:00] Demo 3. Predict: a 45 percent hit rate with equal wins and losses; where is it, and how many trades before you would trust it? The surface: green is profitable on average, red loses. The white line is break-even. The dots are the sample strategies at the cost sliders. The yellow dot is your what-if. Set hit rate 45, payoff 1.0, trades 30: chance the real hit rate is below break-even 71 percent. Move trades to 200: 92 percent. The target slider adds a dashed line: the hit rate needed for a given per-trade Sharpe ratio. Live mode treats each live tick as a one-tick trade; costs push the dot left and down, so you see why a five second move cannot pay a fourteen basis point round trip. What it does not show: independence of trades.

## Slide 28: Demo 4: honest versus misleading dashboard
[19:05] Demo 4. Same 19 trades of the basis strategy, shown two ways. Left: misleading. Right: honest. Click through the five tricks. One, gross not net: plus 1.31 gross, minus 25.29 net. Two, hit rate on gross: 37 percent won, but zero percent win after costs. Three, annualised short window: 17,182 dollars a year, from 40 minutes of data. Four, best strategy only: the other three together lost 28.41 net. Five, no drawdown: a win streak of two, hiding 99 percent of the window under water. Ask the room which one would have fooled them. Live mode does the same with a live paper position. What it does not show: every trick that exists.

## Slide 29: Demo 5: ship-readiness check
[19:09] Demo 5. Three sample projects built into the page. Predict: which would you ship, and what stops the other two? Tidy passes 14 of 14. Messy passes 3: no tests, a thin README, no licence, junk files. Leaky passes 9 and fails two: a .env and a wallet file id.json, caught by name and by content, and it never prints the secret. Click Choose a folder to run the same 14 checks on your own project; files are read in your browser tab and nothing is uploaded. Live mode asks the devnet RPC whether signatures in your docs exist. The same checks run from the terminal with npm run ship-check. What it does not show: it is a set of heuristics, a pass is not a security audit.

## Slide 30: Try the demos yourself
[19:13] The demos are all deployed at nus-solana-demos.vercel.app slash 0008. Scan the QR code, open it on your laptop, and move the sliders. They work from recorded data with nothing to install. Everything in the repo also opens from disk. Leave this up while people scan. Then we go straight into the mini-lab.

## Slide 31: Mini-lab
[19:15] Fifteen minutes. Four steps. Run: score the sample ledger on recorded data, npm run demo. Read: find the hit rate, the break-even hit rate and the max drawdown. Break: break one number on purpose. Change the costs, delete the five winning trades, double the loss on one trade, shorten the window. Explain: which scorecard line caught it, and why. Finish line: one number broken, and the scorecard line that showed it. Leads, walk the room. Beginners: just do the cost sliders in the browser. Advanced: edit the ledger JSON and rerun with --ledger.

## Slide 32: Build menu
[19:30] Open build until five to eight. Pick one or bring your own. Beginners: run the scorecard and put three numbers in your README, or finish your README from the template. Standard: a dashboard on your own ledger with --ledger, or a clean-checkout run by a peer. Advanced: a statistic that fits your lane, integrated into your project and tested, or a recorded-demo backup. Leads rotate. At 19:50 start pushing; we need a tested commit, a README, and one known limitation in the repo.

## Slide 33: Takeaways
[19:55] Three takeaways. One: hit rate means nothing without payoffs, costs and drawdown. Two: say what simulated numbers cannot say, on the dashboard itself. Three: ship what a stranger can run: README, tests, devnet evidence, one limitation. And remember what judges look at: utility, tests, devnet evidence, never simulated returns.

## Slide 34: Branch out
[19:56] After today, in your own time. Beginner: run ship-check on your project and fix every FAIL. Standard: score your own ledger with --ledger and add the drawdown chart to your README. Advanced: add a statistic that fits your lane, like failed-transaction rate or fee share, and test it. These feed straight into Build night 5 and Demo Day.

## Slide 35: Share back
[19:57] Before you leave: push your commit, your README and your one known limitation. Thursday the eleventh: bring your three-minute demo script and your peer feedback, we rehearse. Any time: send your repo link to the leads. Reports to the program team are due within 48 hours, so we will collect links tonight.

## Slide 36: Get the code
[19:58] Everything from tonight is in the repo: github.com slash travisim slash solana-agentic-trading-nus, folder 0008 performance scorecard shipping, then demo. Two commands from demo slash code: npm install, then npm run demo with --recorded. Node 24. No keys, no AI credits, recorded data is bundled. Reads use public mainnet data; every write is devnet only; no real funds, no seed phrases. Scan the QR code.

## Slide 37: Let's connect
[19:59] If you want to stay in touch: my LinkedIn and Telegram, two QR codes. Send me your repo link or ask questions about the project. Thanks everyone. See you next Thursday for the rehearsal.

## Slide 38: Solana
[20:00] Closing slide: the plain black slide with the official Solana logo. Leave it up while people pack up, scan the QR codes from the previous slides if they missed them, and hand their repo links to the leads. Remember the 48-hour report: event link, attendee counts, project links, blockers, next session date (Thu 11 Feb), GitHub handles.
