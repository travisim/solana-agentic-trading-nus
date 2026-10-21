# Teaching script: Build night 4, Backtest Validation and Failure Testing

Presenter: Travis Sim. Thu 28 Jan 2027, 18:00-20:00. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing: mini-talk slides 4-13 take 10 minutes (18:10-18:20, say it briskly; slides 11-13 can move into the demo tour); demo tour slides 14-16 (18:20-18:40); try-it 17; mission 18 (18:40-19:00); build menu 19 (19:00-19:50); closing 20-25 from 19:50.
Say "data collection" and "recorded data". Everything with a result on it is "Simulated, on recorded data; not advice". No prizes, no profit claims.
Book note for you only (not on slides): the leakage, purge and embargo ideas are inspired by Advances in Financial Machine Learning chapter 7; the best-of-many-tries and luck benchmark ideas by chapters 11 and 12 (and the deflated Sharpe ratio idea); the feed alarm by the CUSUM-style structural break tests of chapter 17. The memoriser, the planted leak, the failure injector and the paper agent are ours.

## Slide 1: Title
[18:00] Welcome back, thanks for coming. I'm Travis. Tonight is build night 4, and the topic is not fooling yourself. The plan is the usual one: a short talk, three demos where you guess first, a guided mission, and then most of the night is you building. Tonight we try to break our own backtest, and then we break our own agent on purpose. If something we break tonight is something you have already shipped in your project, good. That is the point.

## Slide 2: Where we are
[18:02] Quick progress circle. Workshop 3 was on the twenty-first of January, deploying a venue component on devnet. Tonight is build night 4. Next Thursday the fourth of February is Workshop 4, performance scorecard and shipping, so what you validate tonight is what you will put a number on next week. Go round the room, one line each: what was your last result, and what do you suspect about it? Then the question for tonight: how do you break your own backtest before the market does? Keep a guess in your head.

## Slide 3: Tonight
[18:10] Shape of the night. Ten minutes of talk, twenty of demos, twenty of guided mission where we all hunt the same planted bug, then fifty minutes of free build on your own project. Last ten: show and tell and push. In the demos I will ask you to predict before I run anything. Be wrong out loud. If you did not set up yet, do it during the mission, I will help.

## Slide 4: Three ways to fool yourself
[18:11] Three traps, one card each. One, leakage: when test and training data sit next to each other, the model has already seen the answer. In our demo the same memoriser scores 60.4 percent balanced accuracy with shuffled folds and 53.9 percent when we cut by time and purge; a coin flip is 50. Two, best of many tries: try 50 random strategies and the best one looks brilliant, 1.00 in-sample here, and 0.17 on data it never saw. Three, a broken feed: an oracle that freezes still shows a normal looking number, but our alarm caught the simulated freeze 95 seconds after it started. Everything tonight is simulated on recorded data, not advice. For you only: leakage is inspired by chapter 7 of the book, tries by chapters 11 and 12, the alarm by chapter 17.

## Slide 5: Overlapping labels leak
[18:12] A label is what we are trying to predict, for example: does the price go up over the next h samples? So the label of moment i covers moments i to i plus h. The bracket under each moment shows that. Now look at the test block in lavender. The training moment just before it, the one with the red bracket, has a label that reaches into the test block. So the model trains on a piece of the test answer. Neighbours share futures. If you shuffle your folds, almost every test moment has such a neighbour. That is the leak. Illustrative picture, h of 6.

## Slide 6: Purge and embargo
[18:13] Same picture, two fixes. Purge: drop every training moment whose label overlaps a test label. Those are the red ones, crossed out. Embargo: drop a few more moments right after the test block, in yellow, because markets stay correlated for a while after the test window. The price is fewer training moments: on the real data with h of 24 and an embargo of 12, about 48 of roughly 346 training moments go in each fold. The reward is a score you can believe. Note shuffled folds cannot be purged at all: every training moment sits next to a test moment, nothing is left. So: cut folds by time first.

## Slide 7: The planted leak
[18:14] A second kind of leak is in the strategy itself. Look at the red line: shift equals one if leak. The windows end one step too late, so the decision at moment i quietly uses the price at i plus one. It looks harmless, and on the data the leaky version makes 18.84 dollars before costs against minus 1.76 for the fixed one, same 61 trades. A time split would not catch this because the future is peeked everywhere. The causality test does: cut the series off at i, recompute the signal, compare. 37 of 440 moments change for the leaky version, 0 of 440 for the fixed one. That is tonight's mission: find it, fix it. Simulated, on recorded data, not advice.

## Slide 8: Best of many tries
[18:15] Now the second trap. We drew 50 random strategies: moving-average trends, mean reversion, oracle basis from build night 1 with random settings, plus a coin flip that has no skill by construction. Each dot is one strategy. Across is the score in-sample, up is the score on data it never saw. The winner in-sample is the highlighted dot, a coin flip called 704396, with a score of 1.00. On fresh data it scores 0.17. We picked the best, so of course it looked good. The score is mean over standard deviation of per-trade profit, before costs, with at least four trades. Illustrative of how selection works, from the recorded data.

## Slide 9: The luck benchmark
[18:16] How good should the best of N look by pure luck? There is a formula for the expected best of N zero-skill tries; it is the idea behind the deflated Sharpe ratio. The lavender line is that luck benchmark, it climbs as the number of tries grows. The mint line is the best score so far. Once the mint line is not clearly above the lavender one, you cannot tell your strategy from luck. At 50 tries the benchmark is 0.76 and the winner is 1.00. Over 20 draws the best in-sample averaged 0.51 and the same strategies averaged 0.12 on fresh data, and the best beat its benchmark in only 4 of 20 draws. With costs of 5 plus 2 bps per leg nothing wins at all in this calm window. Keep a count of your own tries.

## Slide 10: Real numbers
[18:17] Where the numbers come from. 481 samples, one every 5 seconds, 40 minutes of real Jupiter, Pyth and Orca prices recorded on the 21st of October, from earlier build nights. The leak table uses balanced accuracy, the average of the hit rate on rising and on falling moments, so always guessing one side scores 50. With h of 24: shuffled folds 60.4 percent, contiguous with purge and embargo 53.9; at h of 48, 56.8 versus 35.3. We use balanced accuracy because this window drifted up: plain accuracy for guessing up every time would be 63.5 percent at h of 24. Values under 50, like 35.3, are noise and regime change, not a trading signal. The lesson is the gap between fold schemes. With 433 test moments, one standard error is about 2.4 points. Reads use public mainnet data; every write is devnet only; no real funds.

## Slide 11: A broken feed raises an alarm
[18:18] Third trap. Take the gap between the venue price and the oracle price in basis points. When the feed is healthy it wobbles around 2 bps, standard deviation about 2.7. If the oracle freezes, the gap drifts away as the market moves. A CUSUM adds up the standardised gap minus a small slack and rings when the total passes a level. On the healthy 40 minutes: no alarm. On the simulated freeze: alarm 95 seconds after it started. Same idea as the CUSUM change filter from build night 2, pointed at feed health. The freeze is simulated, the prices are real. Try it yourself on the link, drag the alarm level. Book note: inspired by CUSUM structural break tests, chapter 17.

## Slide 12: Five Solana failures
[18:19] Our failure injector. Five faults, all simulated on top of real prices, nothing live is attacked. Stale oracle: the oracle stops updating and the market moves 80 bps. RPC outage: HTTP 429 for five minutes, the agent keeps its last prices; with a one second retry that is 300 calls, with back-off 14. Slippage shock: every fill 40 bps worse. Fee change: from 5 to 30 bps per leg. Duplicate submission: a timeout makes the agent send each order twice. A paper agent sends one 250 dollar order every 30 seconds through the build night 1 risk hook. Before the next slide, predict: which does the hook stop?

## Slide 13: What the hook caught and missed
[18:20] The hook is unchanged from build night 1. Stale oracle: it rejects 8 of 10 orders by oracle age and lets 2 through in the first minute, so the loss is 2.02 dollars instead of 10.04. RPC outage: same, 8 rejected, 2.05 instead of 10.17. Then the three it cannot see: slippage shock, all 10 accepted, 10 dollars lost; fee change, all accepted, 6.25 dollars of extra fees; duplicates, 20 accepted, 5000 dollars of exposure. Two tiny guards fix some of this: an idempotency key leaves 10 orders, a circuit breaker stops after 3 bad fills and the loss falls to 3 dollars. The lesson: every failure you can name should become a test. Simulated, on recorded data, not advice.

## Slide 14: Demo: split leakage
[18:20] Demo 1. Predict first: does the memoriser score higher with shuffled folds or with a purge, and by how many points? Run it, or open the demo: pick shuffled folds, then contiguous, switch purge on and drag the embargo slider. Watch the purged cells turn red, the training count drop, and the balanced accuracy fall (50 percent is a coin flip). Fallback: recorded data is default, no network. Live mode is a strip that shows the live Pyth age and pool price; it is not part of the simulation. If someone asks why accuracy goes below 50 percent: small sample, regime changes, a few points of noise.

## Slide 15: Demo: many strategies
[18:27] Demo 2. Predict: how much of the winner's score survives on data it never saw? Slide the number of tries from 1 up to 50 and watch the best dot move up while the luck benchmark rises with it. Change the draw: another seed gives another 50 strategies and a different winner. Then raise the cost slider to a few bps and see the cloud sink below zero. Honest caveat: in draw 1 the winner is a coin flip that still clears its benchmark by 0.25, which tells you the benchmark itself is a rough guide with only about 48 noisy scores behind it.

## Slide 16: Demo: failure injector
[18:34] Demo 3. Predict: which of the five faults does the risk hook stop? Pick a fault, set its length and size, then watch each order on the timeline: accepted, rejected with the rule, or bad fill. Tighten the max oracle age slider from 60 to 20 seconds and watch the first-minute leak shrink. Toggle the extra guards and see duplicates and slippage get handled. In live mode a real Pyth read goes through the same hook every five seconds and the fault buttons simulate staleness on top. Everything injected is simulated.

## Slide 17: Try the demos yourself
[18:40] All four demos are static pages, no install, they work on your phone or laptop. Scan the code or type the address. The same files are in the repo and open from disk, so if the campus Wi-Fi misbehaves you still have them. Recorded is the default; Live is opt-in and falls back to recorded by itself if an endpoint is rate limited. Take two minutes now, then we move to the mission.

## Slide 18: Your mission
[18:42] Twenty minutes, all of us on the same small thing. Step one, run the sample leaky strategy and note its profit. Step two, find the planted leak: run the causality test and see which moments change when the future is cut off. Step three, fix it, change the shift to zero, and score with a purged split instead of a plain one. Step four, chart before and after. Finish line: one chart with a before and an after. If you finish early, run the causality test on a signal from your own project.

## Slide 19: Build menu
[19:00] Fifty minutes of free build. Pick one. Beginner: audit your own project for a leak, look for any place that uses a future value, a full-sample mean, or shuffled folds. Standard: put a purged split on your strategy. Or a feed-health alert that rings when your oracle gap drifts. Advanced: write a regression test for a failure you injected, one that fails first and then passes after your fix. Or bring your own project and tell me what you want to break. I will walk around.

## Slide 20: Takeaways
[19:50] Three things. One: neighbouring moments leak, so cut folds by time, then purge and embargo. Two: the best of many tries is mostly luck, so deflate it against a luck benchmark and test on fresh data. Three: inject failures; our hook stopped stale data but not slippage, fees or duplicates, and every failure you name should become a test. Ask the room: which assumption failed in your project tonight? Could a user tell something went wrong? What test stops it coming back?

## Slide 21: Branch out
[19:53] After tonight, in your own time. Beginner: run the causality test on a signal from your own project. Standard: raise the number of tries from 10 to 100 and chart the best score against the luck benchmark. Advanced: add a guard for a fault the hook missed, with a regression test that fails first. Everything is in the repo, and you need no AI credits and no keys for any of it: you can hand-edit one parameter and rerun.

## Slide 22: Share back
[19:55] Before you leave, push your branch to your own repo. By Thursday the fourth of February, bring one honest number to Workshop 4, with its limitations next to it. And any time, send your repo link to the leads. Show and tell now: one line each, what did you break, and what did you fix?

## Slide 23: Get the code
[19:57] Everything from tonight is in the shared repo, in the folder for session 0007. Scan the code. From the demo code folder run npm install, then npm run demo with the recorded flag. Node 24. No keys, no AI credits, recorded data is bundled. Reads use public mainnet data and every write is devnet only, no real funds.

## Slide 24: Let's connect
[19:58] If you want to keep going, find me on LinkedIn or Telegram. Send me what you broke and what you fixed, I like reading those. Thank you, see you next Thursday for Workshop 4.

## Slide 25: Solana
[20:00] End of the session. Leave this slide up while people pack up and take photos. Remind everyone the 48-hour report is the leads' job, but the feedback form after every workshop is theirs. Thank you.
