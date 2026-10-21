# Teaching script: Build night 3, Position Sizing and the Trade Ledger

Presenter: Travis Sim. Thu 12 Nov 2026, 18:00-20:00. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing: mini-talk slides 3-11 take 10 minutes (18:10-18:20); demo tour slides 12-15 take 20 minutes (18:20-18:40); try-it 16; mission 17 (18:40-19:00); build menu 18 (19:00); before the break 19 (19:35); takeaways and closing 20-25 at 19:50.
Say "data collection" and "recorded data". Say "simulated, not advice" for any strategy result. No prizes, no profit claims. The book ideas behind this session (bet sizing, overlapping outcomes) may be named out loud as "inspired by a machine-learning-for-finance textbook"; they are not on the slides.
Honest framing to repeat: the confidence number in the sample code is a stand-in, a made-up function of how big a momentum move was. It is not a calibrated probability. Tonight is about the plumbing (sizing, counting, recording), not about whether the signal is any good.
If the room is mostly beginners, run the five-minute primer in `notes/run-of-show.md` (bet, size, basis point) before slide 3.
This is the last session before the academic break. The restart note on slide 19 is the one thing everybody must leave with.

## Slide 1: Title
[18:00] Welcome back, thanks for coming. I'm Travis. Tonight is build night 3, the last one before the break. The plan is the same as before: a short talk, four demos where you guess the answer first, then most of the time you build. Tonight's topic is two bits of bookkeeping that decide whether a strategy survives: how big to bet, and how to write down what happened. Three ideas. Bets overlap, so count them together. Size should follow confidence, with caps. And a ledger should be append-only, so it can be replayed and trusted. In the last fifteen minutes everyone freezes a working commit and writes a restart note, so you can pick this up in January.

## Slide 2: Tonight
[18:02] Quick progress circle first. Go round the room, one line each: what did you build or try since the last session, and is anything stuck? Workshop 2 was last week, so some of you now have teams and a brief. Then tonight's question, on the slide: which sizing rule would you trust, and why? Keep an answer in your head, we come back to it at the end. The shape of the night: ten minutes of talk, twenty minutes of demos, twenty minutes of guided mission, fifty minutes of free build with the freeze at 19:35, and ten minutes of show and tell. In the demos I'll ask you to predict before I run anything. Be wrong out loud.

## Slide 3: Open bets overlap
[18:10] Here is the first idea. A bet is a call you make at a moment, and it stays open for a while, here five minutes. Each bar on this slide is one bet: mint is long, lavender is short. They are made up for the picture, real ones come in a moment. Look at the middle: at one moment, four bars are open at once. If you treat each bet as separate, you count the same price move four times. That is the trap. Open bets overlap in time, so before you size anything you have to ask: how many are open right now?

## Slide 4: Count them together
[18:12] Same bets, now with the count of how many are open at once, drawn underneath. It rises when signals cluster and falls when bets expire. Now the choice. If you add the bets up, three bets of fifty percent become one hundred and fifty percent, which is over the cap. One idea, counted three times. If you average them, three bets of fifty percent are fifty percent: one shared position that moves when the bets change. We average. The sample code also has the naive sum so you can compare them. Keep that comparison in mind for demo two.

## Slide 5: Size from confidence
[18:14] Second idea: how big should a bet be? We want size to grow smoothly with confidence. Take the confidence p, the chance your call is right. At fifty percent you have no edge, so size is zero. Turn it into a z-score, z equals p minus a half, over the square root of p times one minus p, then size is two times the normal curve of z, minus one. In plain words: zero at a coin flip, about sixteen percent of the cap at sixty percent confidence, thirty-four percent at seventy, eighty-two percent at ninety, and it never passes one hundred. Then we round to steps of a tenth of the cap, so a tiny change in confidence does not cause a trade. The confidence in our sample code is a stand-in, a made-up function of the size of a recent move. It is not calibrated. If your model's confidence is not a real probability, this curve will mislead you, so check it.

## Slide 6: Limits in order
[18:16] The size is only a proposal. Walk through an example at ninety percent confidence. Smooth size is eighty-two percent of the cap. Rounded to steps, eighty percent. The cap is twenty-five percent of a ten thousand dollar account, so the target position is two thousand dollars. Next the price-impact cap: we ask what Jupiter says the price would move for an order that size. On SOL/USDC that is almost nothing, so no cut. Then the risk hook from build night one: max notional is one thousand dollars, so the order is refused, with the rule and the reason. The sizing proposes, the hook can still say no. Layers, each doing one job.

## Slide 7: One row per decision
[18:18] Third idea: the ledger. Every order and every decision is one row, including the ones the hook refused. A row holds the time, why, the order, the hook's verdict, the fill with fee and slippage, the cash and position after it, and a hash. The hash is a fingerprint of the row and of the previous row's hash, so the rows form a chain. These are the first three rows of tonight's real run. Look at the arrows: each row carries the fingerprint of the one before. And there are only two ways in: append a row, or read them. No update, no delete.

## Slide 8: Edit a row and it shows
[18:19] Why bother with the chain? Because a reader can replay it. Start from the starting balance, apply every fill, and the cash and position must equal what the last row says. On the left, the real replay of tonight's ledger: it adds up. On the right, someone edits row five, changes one price by a dollar. Replay says: row five, hash does not match the row's contents. Two checks: the chain, and the balance. This is not security against a determined attacker, anyone can recompute all the hashes. It is evidence that tells an honest reader that nothing changed by accident. Later you can post the head hash somewhere public, like a devnet memo, to pin it in time.

## Slide 9: Real numbers
[18:19] Real numbers from tonight's run. All simulated, on recorded data, not advice. On the forty-minute window of real prices, a simple momentum rule makes thirty-seven bets, up to seven open at once, four on average. Their average uniqueness is zero point two three, meaning each bet shares most of its move with others. The ledger has thirty-eight rows: thirty-six fills and two refusals, and those two are deliberate test orders we added, an oversized order and a price typed in cents, so you can see the hook say no. Fees were about four dollars twenty. A few dollars either way on a ten thousand dollar account is noise, not a result.

## Slide 10: Real pool data
[18:19] This is the Solana part. Inventory comes from real token accounts: we read the Orca SOL/USDC pool's two vault accounts with the RPC. About one hundred seventy-eight thousand SOL and ten point seven million USDC. A thousand dollar order is under one hundredth of a percent of the USDC side. Price impact comes from real Jupiter quotes. For SOL/USDC, a hundred thousand dollar buy moves the price about five thousandths of a basis point. Very deep. For a thinner token we recorded, a hundred thousand dollars moves it about three basis points, and a million moves it twenty-eight. With a five basis point cap, the biggest order is over a million dollars on SOL, about one hundred fifty-nine thousand on the thinner token. The cap only bites on shallow pools. A basis point is one hundredth of a percent.

## Slide 11: The sizing in code
[18:20] The sizing really is this short. Two functions. probToSize takes the confidence, makes the z-score, and returns two times the normal curve minus one, with zero for anything at or under a half. discretize rounds a signed size to the nearest step and clamps it to plus or minus one. The normal curve is a short approximation in the same file, no libraries. Everything else tonight is plumbing around these. If you want to change the rule, this is where you start.

## Slide 12: Demo: the sizing curve
[18:20] Demo one. Predict first: with a ten thousand dollar account, a twenty-five percent cap and a thousand dollar hook limit, at what confidence does the hook start refusing the order? Take a few guesses. Then open the demo, slide confidence up. Answer: the order is accepted up to a size of forty percent of the cap, which is exactly a thousand dollars, and refused from a size of fifty percent, around confidence zero point seven six. Show the six stages on the right, and the sentence naming the limit that bound. Flip to the thinner token and lower the impact cap to show the cut. Then switch Live on: the pool balances are read from the chain right now and the impact comes from a live Jupiter quote. If Jupiter throttles, the page keeps the last quote and says so.

## Slide 13: Demo: overlapping bets
[18:26] Demo two. Predict: how many bets are open at the busiest moment? Answer from the recorded run: seven. Drag the replay position through the busy stretch. The amber line is the count, the mint line is the averaged size, the amber lower line is the summed size. Toggle Sum and see it hit the cap. Change the bet length to ten minutes and watch the overlap grow and uniqueness fall. In Live mode the same signal runs on the live oracle price, and new bets appear when the price moves enough. That takes a minute or two, so start it and come back.

## Slide 14: Demo: a ledger replay
[18:32] Demo three, the one to take your time on. Predict: edit row five, which check turns red and which row is named? Press Play and watch rows arrive. Point at the refused row, the oversized test order, with the rule and the reason. Then press Edit a row on row five: the hash chain turns red and the message names row five, and the balance check also turns red because the cash no longer matches. Press Delete a row: the chain breaks at the next row. Reset restores it. In Live mode the page appends paper rows from the live oracle and pool price. Nothing is sent anywhere. Every fourth row is an oversized test order so the hook refuses it live.

## Slide 15: Demo: equity before and after
[18:37] Demo four, and it is the mission in miniature. Predict: what does doubling the fee do to the final equity? Pick the before curve, the no-cost run, then move the fee slider from four to eight. The equity curve drops, the fees paid double, and the table shows the change. Try halving the cap, then summing the bets. The summed run is refused forty-two times by the hook, which is the hook working. Be honest about the scale: this is forty minutes on one night, a few dollars either way. It is a tool for seeing what a change does, not a result about the market. Live mode adds a strip with the live gap between the pool and the oracle next to what a round trip costs.

## Slide 16: Try the demos yourself
[18:40] All four demos are online and also in the repo, so open them on your laptop. Scan the code or type the address. No install. Everything works offline from the recorded data. If someone's laptop is slow, they can share with a neighbour. Live mode is there on every demo, but the room shares one internet address and Jupiter limits calls, so recorded stays the default. I'll keep live mode on the projector.

## Slide 17: Your mission
[18:40] Guided mission, twenty minutes, same small thing for everybody. One: run the sample sizing on the sample ledger. npm install, then npm run demo with the recorded flag. Two: add one limit or one cost. A smaller cap, a bigger fee, impact on or off. One change, not five. Three: chart equity before and after, either with the demo or your own plot, keep your first chart so the before is honest. Four: check the ledger still reconciles, the demo prints replay OK. Finish line is one chart with a before and an after. If setup fails, pair up, and use the lab demo four instead.

## Slide 18: Build menu
[19:00] Now fifty minutes of free build. Pick one thing from the menu, or bring your own project. Beginner: give your project an append-only ledger, one row per order; or add fees and impact to the ledger you have. Standard: add daily-loss or drawdown halts, or compare two sizing rules on one ledger. Advanced: post the ledger's head hash to devnet with a Memo transaction, use a throwaway devnet key kept outside the repo. We did not build that part for you, deliberately, because it needs devnet SOL and we have not verified it end to end. Leads are around. Remember the freeze is at 19:35.

## Slide 19: Before the break
[19:35] Stop building. Fifteen minutes, three things, everybody. Freeze: commit a working main, then run it once from a clean clone so you know it works for someone else. Restart note: a short file with how to run it, what you should see, and your first task for January. Write it for a tired person who has forgotten everything. Devnet check: the leads check that every team has devnet SOL before the break, so nobody is blocked in January. Reading week, exams and vacation come first, nothing is expected over the break, no agents running unattended, no paid services. Workshop 3 is Thursday the twenty-first of January.

## Slide 20: Takeaways
[19:50] Three takeaways. One: open bets overlap, so average them, do not stack them. Two: size grows with confidence, and then the caps and the risk hook have the last word. Three: a ledger is append-only and replays to the balance, refusals included. Now back to the question from the start: which sizing rule would you trust, and why? Take two or three answers. Then: what would a reader of your ledger need to reproduce your run?

## Slide 21: Branch out
[19:52] Branch out, after tonight, in your own time. Beginner: run the sizing with a cap of ten percent and then forty, and compare the biggest size and the equity curve. Standard: add a daily-loss halt, and write the halt into the ledger as a row so the reason is on record. Advanced: compare two sizing rules on one ledger, or post the head hash to devnet with a memo. Pick the one that fits the time you have.

## Slide 22: Share back
[19:53] Share back. Tonight: freeze main and push your branch. When we return, Thursday the twenty-first of January for Workshop 3, bring your restart note and your ledger. Any time before then, send your repo link to the leads. Show and tell now: one minute each, one line on what you built and what you will do first in January.

## Slide 23: Get the code
[19:56] The code is in the public repo, in this session's folder. Scan the code or type the address. In the demo folder, code, run npm install, then npm run demo with the recorded flag. Node twenty-four. No keys, no AI credits, the recorded data is bundled. Reads use public mainnet data, every write is devnet only, no real funds. The README lists the build menu and a path that needs no AI tools: change one number on the command line.

## Slide 24: Let's connect
[19:58] If you want to stay in touch: LinkedIn and Telegram, both on the slide. Send your repo link, a question, or a chart. Thank you for coming. Have a good break, rest, and see you on the nineteenth.

## Slide 25: Solana
[20:00] Thank you. Slide stays up while people pack up. Leads: collect the restart notes list and send the 48-hour report by Saturday 14 November.
