# Teaching script: Workshop 2, Labeling Trades and Forming Teams

Presenter: Travis Sim. Thu 5 Nov 2026, 18:00-20:00. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing (adapted from `general/NUS-Weekly-Session-Guide.md`, see `notes/run-of-show.md`): welcome and progress circle slides 1-3 (18:00-18:10); teaching slides 4-25 (18:10-18:50, 40 minutes); demos slides 26-29 (18:50-19:00, 10 minutes); team matching slides 30-31 and 25 (19:00-19:25, 25 minutes); mini-lab slide 32 (19:25-19:35, 10 minutes); open build slides 33 (19:35-19:55); closing slides 34-39 (19:55-20:00).
Say "data collection" and "recorded data". Say "simulated, on recorded data, not advice" for any strategy result. No prizes, no profit claims. The book that inspired the ideas (Advances in Financial Machine Learning, chapters 3, 4 and 7) may be named aloud, never on a slide; say "inspired by" where the method here is our own plain version.
Read `operations/post-workshop-report/workshop-1/CLAUDE.md` first: no AI credits are needed tonight, nothing depends on one endpoint, the room is mixed (beginners and advanced traders), scan the check-in QR at the door and again mid-session.

## Slide 1: Title
[18:00] Welcome, thanks for coming. I'm Travis. Tonight is Workshop 2. Two halves. First half: how to give every agent decision an outcome you can check, which we call a label, and why labels can quietly cheat. Second half: your project. You pick a lane, find a team or decide to go solo, and leave with a one-page brief. If you missed the earlier sessions, you are fine: everything runs on recorded data and nobody needs AI credits or a wallet tonight.

## Slide 2: Where we are
[18:03] Quick progress circle, one line each. Build night 2 was last Thursday: data bars and change alerts. Today is Workshop 2. Next Thursday the twelfth is Build night 3, position sizing and the trade ledger, and what your team makes tonight feeds into it. Go round the room: what did you build or try since last week, and is anything stuck? Then the question for tonight: how do we know if a decision was any good? Keep a guess in your head, we come back to it.

## Slide 3: Tonight
[18:08] Here is the shape. Forty minutes of teaching: labels, leaks, the second-opinion gate, then the three project lanes and the brief. Ten minutes of demos on real prices. Then twenty-five minutes of team matching, which is the part I most want you to enjoy. A ten-minute mini-lab where your new team labels ten decisions by hand. Then open build until eight. If you only remember one thing: by the end you have a lane, a team or a solo plan, and a one-page brief.

## Slide 4: Every decision needs a checkable outcome
[18:10] Your agent says buy SOL, it rose six basis points in the last minute. Was that a good decision? You cannot tell yet, because there is nothing to check it against. A basis point is one hundredth of a percent. What we need is a label: right, wrong, or nothing happened. A label turns a decision into a row of data you can count, chart and test. Everything tonight is about making labels that are honest. Illustrative example, real numbers come in a few slides.

## Slide 5: Fixed-time labels are crude
[18:13] The simplest label is: look two minutes later and see if the price is higher. Path A falls six basis points first, then recovers. Path B climbs steadily. A fixed-time label calls both of them plus. But a trader with a stop was already out of path A, losing, before it recovered. The fixed label ignores what happened on the way. Both paths here are illustrative. On the real data, a fixed-time label disagrees with the barrier label on 26 percent of decisions, 57 of 219, and we will see that on slide 11.

## Slide 6: The triple barrier: profit target
[18:15] The fix is the triple barrier, a method inspired by Advances in Financial Machine Learning, chapter 3, written here as plain code. We put walls around each decision. Wall one, above the entry price: a profit target. If the price touches it first, the decision worked and the label is plus one. The dot on the left is the decision, the line is the price afterwards. This diagram stays on screen for the next two slides and I add one thing each time.

## Slide 7: The triple barrier: stop
[18:16] Wall two, below the entry price: a stop. If the price touches the stop first, the decision failed and the label is minus one. Notice the walls are the same distance above and below. In practice you could make them different, a wider target than stop, but start symmetric: one number to explain. Ask the room: in this picture, which wall does the price hit first? Answer, the upper one. So this decision gets plus one.

## Slide 8: The triple barrier: time limit
[18:18] Wall three is a time limit on the right. If the price touches neither wall before then, nothing happened and the label is zero. The rule is: the first wall touched is the label. Plus one, minus one, or zero. That is the whole method. Zero is not a failure, it is information: this decision did not produce a clear move. Later we will see that in our recorded data about one in five decisions times out.

## Slide 9: Barrier width follows the noise
[18:20] How far away should the walls be? If you use a fixed width, then on a quiet period the price never reaches them, and on a busy period noise touches them in seconds. The width should follow recent volatility. Our rule: width is the larger of a floor and 0.8 times the recent noise per step times the square root of the number of steps. For one real decision, the noise was 0.92 basis points per step, the time limit is 24 steps of 5 seconds, 0.8 times 0.92 times about 4.9 gives 3.6 basis points. The formula is ours, a simple version; the book uses daily volatility.

## Slide 10: A win has to beat the cost
[18:23] Important honesty slide. A label of plus one is gross: it ignores fees. Swapping through the Orca pool costs 0.04 percent each way, so about 8 basis points for a round trip, before slippage. Our average barrier is only 3.4 basis points wide. So a win at that width still loses money after fees. In the agent results later, none of the 73 wins had a barrier as wide as the cost. The fix is the width floor: set it to your real costs. This is why we say simulated, gross of fees, not advice.

## Slide 11: Real labels
[18:26] Now real data. This is SOL/USDC from the Orca pool, 40 minutes recorded on 21 October, one price every 5 seconds, 481 samples, reused from build night 1. We make a decision every 10 seconds: 219 labelled decisions. 118 hit the upper barrier first, 56 the lower, 45 timed out. The average barrier is 3.36 basis points and the average decision lasts 13 steps. Note the price drifted up about 0.6 percent in this window, so plus ones outnumber minus ones. One calm night, do not generalise. Reads use public mainnet data, every write is devnet only, no real funds.

## Slide 12: Same agent, three price paths
[18:29] Same agent, same settings, three real price paths recorded at the same time: the Orca pool price, the Pyth oracle and the Jupiter quote. The labels differ. Pyth only updates about every ten seconds, so its path is stair-steps, and Jupiter's quote includes routing noise. On the Orca path the agent has a 51 percent hit rate with 143 trades, on Jupiter 32 percent with 75 trades, on Pyth 14.9 percent with 67. Labels agree between Orca and Pyth on 61 percent of decisions. Lesson: a label is only as honest as the price path it is made on. Label with the price your agent actually sees.

## Slide 13: The labeler in code
[18:31] This is the real function, from the repo, comments removed. It is short. Walk forward step by step from the decision up to the time limit. At each step check the upper barrier, then the lower. The first touch sets the label and the loop stops. If you get to the end, the label is zero. One more rule: if the time limit runs past the end of your data, return nothing, because the label is not known yet. You can run this on your own strategy's decisions tonight.

## Slide 14: Labels overlap
[18:33] Now the catch. We decide every 10 seconds but each label looks ahead up to 2 minutes. So label one looks at prices from second 0 to 120, label two from 10 to 130, and so on. The shaded part is future that two or more labels use. Each label feels like a new fact, but most of it is the same fact. This overlap is the reason many backtests flatter themselves. The idea of measuring it is inspired by the sample uniqueness material in the book; the counting here is our own.

## Slide 15: Overlap leaks into the test
[18:36] Here is the leak. You split your data: train on the early part, test on the later part. A label decided just before the cut can have its answer decided by prices after the cut. So training already contains a piece of the test period. Your test result is then too good, and you do not know it. The fix is simple: purge, which means drop the training labels that cross the cut before you fit anything. When the test set sits in the middle you also drop a few steps after it; that is called an embargo.

## Slide 16: Real numbers: overlap and leak
[18:38] Real numbers. At any moment on average 6.9 labels are alive at once, at most 13. The average label is only 16 percent unique, which means 84 percent of its life is shared with others. So 219 labels carry about 34 labels' worth of new information. At the 60 percent cut, step 282, nine training labels cross into the test period. That is why the next part purges them. Demo 2 lets you drag the cut and watch the number change.

## Slide 17: A second opinion
[18:40] Second idea, meta-labeling, again inspired by the book. The first agent picks the side: buy or sell. A second check, the gate, looks at the situation and estimates the chance this trade wins. Only act above a line. The gate is trained on what happened to past trades and scored on a later period it has not seen. It decides whether to act, and in a bigger system also how much. Ours is a small logistic regression written out in plain code, three features: signal strength, the gap between Orca and Pyth prices, and recent volatility.

## Slide 18: The pretend agent writes reasons
[18:42] We need an agent to label, and we do not want to depend on AI credits. So the pretend agent is a plain momentum rule: if the price moved at least as much as the recent noise, follow the move. It writes a reason for every decision, like an LLM agent would. On the right, the checker reads the facts in that text, direction, size in basis points and the gap between the two venues, and compares them with the data the agent had. It works on plain text, so you can paste reasons from any real agent. To test the checker, one in five reasons is given one wrong claim on purpose. That is simulated, fixed seed, flagged in the file.

## Slide 19: Grade the reasons, then the result
[18:44] Two questions. One: was the reason true? Two: did the trade win? The checker caught 43 of the 43 wrong claims with no false alarms, which is easy because we made the errors ourselves; a real LLM will be messier. Now the surprise: trades with true reasons won 51.3 percent of the time, 113 trades; trades with a wrong claim won 50 percent, 30 trades. A true reason does not make a good trade. Facts first, then the label. Grade both.

## Slide 20: The gate on the test period
[18:46] The gate was trained on the first 82 training trades, with 6 purged for crossing the cut, and scored on the 55 test trades. Without the gate the hit rate is 45.5 percent plus or minus 13.2. With the gate, 47 trades, 48.9 percent plus or minus 14.3. It blocked 8 trades, 2 of which would have won. Those ranges overlap: with this few trades we cannot say the gate helps. I want you to leave with the method, with the plus-minus next to every hit rate, not a result to trust. Simulated, on recorded data, not advice.

## Slide 21: An on-chain record
[18:48] The Solana part. Each decision can be written to devnet in a Memo transaction, a short line with the step, the side, the label and a hash of the full record, so anyone can recompute it. We built the transaction by hand, no libraries. What is verified: devnet accepted three of them in a dry run, simulateTransaction, and the Memo program logged our exact text. What is not verified: sending. The public faucet refused our throwaway key with a 429, so no key was funded. A lead can fund one for you. We never fake a signature.

## Slide 22: Three lanes
[18:49] Now your project. Solo or a team of 3 to 4, in one of three lanes. Agent: a trading agent or strategy with honest validation, like tonight's labeler. Exchange: a venue component, an order book, matching, a deposit watcher or custody. Tooling: anything that helps the trading process, data collection, monitoring, risk, explainability, dashboards. You are judged on utility, tests, devnet evidence and a clear explanation, never on simulated returns. With about ten of us, aim for two or three teams and do not force all three lanes.

## Slide 23: Starters for each lane
[18:51] Starters you can run today, each with a first test you can measure, from our research notes. Agent: label your own strategy, the gate, the explanation checker. Exchange: a deposit watcher that caught a real devnet transfer about a second after it confirmed, a mini order book that gives exactly five trades on the ten-order fixture, an Orca Whirlpool devnet lab, Phoenix source reading. Tooling: a data collector, a change and staleness monitor, a label dashboard, a leak checker. Devnet SOL for any write comes from a lead: the public faucet rate-limits hard, as we saw.

## Slide 24: The one-page brief
[18:54] A brief has nine lines: who has the problem, the failure you observed with your evidence, the smallest useful component, a measurable success test, the devnet component, the limitations, each person's contribution, each person's learning goal, and three first tasks with names. Plus how you will communicate and when you are free. If you cannot fill a line, that is your first task. Beginners get a meaningful task too: tests, reproduction steps, design, documentation, user feedback all count.

## Slide 25: Team matching in 25 minutes
[19:00] The protocol, 25 minutes. Zero to five: each person pitches one problem with evidence they saw. Five to ten: choose your first interest and note a second choice. Ten to twenty: share what you bring and want to learn, find complementary people. Twenty to twenty-five: agree a provisional team of 3 to 4, a shared problem and first tasks. Fill the interest card: handle, first and second problem, skill I bring, skill I want to learn, availability. Teams can change by agreement, and we re-check on 12 November and 21 January. Leads rotate and help beginners find their contribution.

## Slide 26: Demo: triple barrier
[18:50] Demo 1. Open the triple barrier page. Predict first: if I double the width, do more labels become plus one or zero? Run npm run demo with mult 1.6, then drag the width slider. The room should see fewer touches and more time-outs, and the average width roughly doubles. Click a dot to see its three walls in the zoom panel. Then press Live: your browser reads real Orca and Pyth prices every five seconds and labels them with a shorter horizon. If Live is slow or rate limited, say so and stay on Recorded.

## Slide 27: Demo: overlap and leakage
[18:55] Demo 2. Each line is one label from decision to exit, the bottom chart is how many are alive at once. Predict where the cut should go so nothing leaks. Drag the cut: the red labels are the ones crossing it. Press Purge and they are dropped. Increase the time limit and watch the overlap and the leak grow. Effective independent labels: 34 out of 219 at the defaults. Live mode runs the same functions on the live path.

## Slide 28: Demo: agent report card
[18:57] Demo 3. The pretend agent's reasons, each checked, each with its outcome. Predict: do trades with true reasons win more often? Raise the wrong-reasons slider to 40 percent, filter to Flagged, and read a checker message. Say clearly: the wrong claims are simulated with a fixed seed to test the checker. The point is that reason quality and outcome are two separate checks. In Live mode each new decision is written and checked from real Orca and Pyth reads; its outcome stays pending until a barrier is touched.

## Slide 29: Demo: meta gate
[18:59] Demo 4. Every trade the agent wanted is a dot; height is the gate's estimated chance of winning; the dashed line is your threshold. Drag it. Blocked trades are struck through. Predict which blocked trades would have won: 2 of the 8 at the default. Look at the plus-minus: it is as wide as the gap. Switch to All trades to see the training period, where the gate looks better because it learned from those. Live mode scores new live decisions with the same weights.

## Slide 30: Demo: lane and team picker
[19:02] Demo 5, used in the team matching. Pick a lane, or answer two questions. Pick a starter and the brief fills in: the smallest component, the success test, the devnet evidence and the limitation come from our research notes. Add your skills, availability and three tasks. The right panel is the one-page brief; copy it or download it as a markdown file. Teammate matches use example cards, invented for the demo, not real people. The live button adds a real market reading to your evidence line.

## Slide 31: Try the demos yourself
[19:00] Everyone open the demos on your laptop now: scan the code or type the address. No install, they run in the browser from recorded data, and each has a Recorded and Live switch. Do not all switch on Live at once: we share one campus connection, so the public endpoints rate limit. The same files are in the repo and open from disk. The picker is demo five; use it during team matching. Laptops open? Then we start the matching on slide 25.

## Slide 32: Mini-lab: label ten decisions by hand
[19:25] Mini-lab, ten minutes, in your new teams. One: open out/minilab.md, it has ten real decisions with barrier prices and the next 24 prices each. Two: label each one, plus one, minus one or zero. Three: check against out/minilab-answers.md. Four: run the demo with mult 1.5 and relabel decision 1. You are done when your team agrees on all ten and can say why decision 1 changed. Argue about the ones you disagree on, that is the learning.

## Slide 33: Build menu
[19:35] Open build, about twenty minutes, on your own project or your team's first task. The menu: label your own strategy's past decisions; build volatility-scaled barriers for another token; build the gate with your own features; build an explanation checker that flags reasons contradicting the data; label your Session 0 strategy and log it to devnet. Beginner and advanced items are marked. No AI credits needed: every item works with hand edits and npm run demo. Leads rotate; ask early.

## Slide 34: Takeaways
[19:55] Three things to keep. One: a label turns a decision into a checkable outcome. Two: overlapping labels leak, so purge before you test, and always put a plus-minus next to a hit rate. Three: your team brief is the first thing you build. Before you leave, make sure your brief has your name on it and three first tasks.

## Slide 35: Branch out
[19:56] Branch out after tonight. Beginner: change the width, time limit and floor and write down what moves. Standard: label your own decisions with labelAt, or add a feature to the gate and compare with the plus-minus range. Advanced: grade the reasons of your own LLM agent, write a purged k-fold split, or log your labels to devnet with the Memo logger.

## Slide 36: Share back
[19:57] Share back: by Friday the sixth, post your one-page brief in the group. On Thursday the twelfth, bring your first task done to Build night 3. On the twenty-first of January we check team fit again before Workshop 3. Fill in the post-workshop feedback form too, and send the 48-hour report details to the leads: GitHub handles, team lanes, blockers.

## Slide 37: Get the code
[19:58] Everything is in one public repo: github.com/travisim/solana-agentic-trading-nus, in the folder for tonight, 0004-labeling-trades-forming-teams. Scan the code. Then cd into demo slash code, npm install, npm run demo with recorded. Node 24 or newer. Reads use public mainnet data, every write is devnet only, no real funds. Never paste a seed phrase or a private key anywhere in this project.

## Slide 38: Let's connect
[19:59] If you want to talk about your project, or you want a code review before the next session, find me on LinkedIn or Telegram. The codes are on screen. Thanks for coming. See you on the twelfth for Build night 3: position sizing and the trade ledger.

## Slide 39: Solana
[20:00] End slide. Leave it on screen while people pack up. Leads: scan the last check-in QR, take photos for the report, note GitHub handles and each team's lane.
