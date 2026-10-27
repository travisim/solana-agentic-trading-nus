# Teaching script: Build night 1, Data Collection and Risk Hook

Presenter: Travis Sim. Thu 22 Oct 2026, 18:00-20:00. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing: mini-talk slides 4-11 take 10 minutes (18:10-18:20); demo tour slides 12-15 (and 16) take 20 minutes; mission 17-18; free build; closing 19-24 at 19:50.
Say "data collection" and "recorded data". Say "simulated, not advice" for any strategy result. No prizes, no profit claims.
Background reading for you only (not for slides): Advances in Financial Machine Learning, chapter 1 on why finance projects fail and chapter 2.2 on data types.

## Slide 1: Title
[18:00] Welcome, thanks for coming. I'm Travis. Tonight is a build night, so the plan is: a short talk, a few demos where you guess the answer first, and then most of the time you build. Tonight's topic is data collection and a risk hook. If you haven't run the setup yet, no stress, we'll sort it at the start of the mission.

## Slide 2: Where we are
[18:02] Quick progress circle. Workshop 1, on the 13th, we picked a trading bot and built a first one. Tonight is the first build night: we look at what data an agent actually needs, and how to stop it doing something silly. Next Tuesday, the twenty-seventh, is build night 2: data bars and change alerts. Go round the room: one line each, what did you build or try since Workshop 1, and is anything stuck? Then the question for tonight, on the slide: which data would hurt your agent most if it went stale? Keep that in your head. We come back to it at the end.

## Slide 3: Tonight
[18:10] Here is the shape of the night. Ten minutes of talk, twenty minutes of demos, twenty minutes of guided mission where we all do the same small thing, then fifty minutes of free build on whatever you want. Last ten minutes: show and tell and push. The demos are not me talking at you. Before each one I'll ask you to predict the result. Be wrong out loud, it's more useful.

## Slide 4: A smart agent with bad data
[18:12] Same agent in both cards. Left, it gets a price that is one second old. Right, it gets a price that is four minutes old. The agent says the same thing: buy a small size. It doesn't know the second price is old. It sounds just as confident. The numbers here are illustrative, not a market quote. The point: a smart agent doesn't fix bad data. It just acts on it with confidence. So we are going to spend tonight on the data, and on a guard.

## Slide 5: Four kinds of data: venue price
[18:13] Four kinds of data. I'll add one at a time and the picture stays in place. First, venue price. That's what you can actually trade at, right now. On Solana the easy way to ask is the Jupiter quote API: "if I sell one SOL, how many USDC do I get?" Jupiter routes across the pools, so the answer already includes fees and routing. No key needed. How it goes bad: it moves every second, and one venue is not the market. In the code this is the jupiterQuote collector.

## Slide 6: Four kinds of data: oracle price
[18:14] Second: oracle price. An oracle is a reference price that sits on chain, so programs can read it. We use Pyth. Reading its price account gives you three things: the price, a confidence band (how unsure it is), and when it was published. How it goes bad: it can be old, or the band can be wide. So you check the age and the confidence before you trust it. Collector name: pythOnChain.

## Slide 7: Four kinds of data: ordering
[18:15] Third: ordering. What happened in which slot. A slot is the chain's clock, roughly 0.4 seconds each. If you read a price at slot N and another price at slot N plus nine, they are not from the same moment. In our snapshot you can see this as postedSlot and currentSlot for the Pyth price: how many slots ago was it posted. A mismatch here looks like a trade opportunity but it is just two different times.

## Slide 8: Four kinds of data: inventory
[18:16] Fourth: inventory. What you hold right now. Token balances. Two classic failures. One, an old balance: you think you have the SOL, the last trade didn't go through. Two, the wrong unit: SOL is counted in lamports, one SOL is a billion lamports. Mix up the unit and your size is wildly off, up to a billion times. Tonight we won't connect a wallet. Inventory shows up as a number we pass in to the risk hook. All writes in this series are devnet only. Pause here and ask: which of these four have you used in your project?

## Slide 9: The risk hook
[18:17] Now the guard. A risk hook is plain code that sits between the agent's idea and any action. No AI in it. It looks at the order and the data and either says yes, or says no and tells you why. Four rules in our sample: a max order size, 1,000 USD; a max gap between the price you are about to trade at and the oracle, 50 basis points; a max age for the oracle, 60 seconds; and a unit sanity check. One basis point is one hundredth of a percent. The point of "say why": when the agent is rejected, you can read the reason and fix the cause. The hook is the same function whether the idea came from a rule, a model or a student at 3am.

## Slide 10: Real numbers
[18:18] Real numbers. SOL against USDC from three places: a Jupiter quote, the Pyth oracle, and the Orca pool. Look at the gaps in basis points. These are small, but they are not zero, and that gap is what a lot of strategies are trying to catch. Read the source line: these come from recorded data, with the capture date on the slide. Then the safety line, read it out: reads use public mainnet data; every write is devnet only; no real funds, no seed phrases. Nobody needs a wallet tonight.

## Slide 11: The collector
[18:19] And this is what a collector looks like. It's short. It calls the public Jupiter quote API, no key, and turns the answer into a number. Note the comment about decimals: USDC has six decimals, so we divide by a million. That one line is the wrong-unit failure from slide 8, handled. If anything fails, it throws a clear error. Rate limited? It says so. It doesn't make up a price. You'll read the other two collectors in the repo.

## Slide 12: Demo: the price gap
[18:20] Demo one. First, predict. Do the three prices agree? How many basis points apart? Put a number on it, shout it out. Then I run the command. Default is recorded data, so it works without wifi. I'll run it live only if the network is behaving. Then open the price gap demo: scrub along the time axis and watch the gap open and close. Ask: is the gap ever big enough to matter after costs? We'll answer that in demo four. If the run fails: use the recorded flag, nothing else changes. Then flip the switch to Live: watch the slot number tick up and a new Jupiter, Pyth and Orca point land every five seconds. The prices move, the gaps stay small. If it hangs or shows the rate-limit pill, it has already gone back to Recorded; carry on from there.

## Slide 13: Demo: the risk hook
[18:26] Demo two. Before I run: here is a list of orders, from small to large. Which ones will the hook let through? Which rule stops each one that doesn't? Let people guess. Then run it. A 250 USD buy passes. A 5,000 USD buy is rejected by max notional, and it says exactly that. In the lab demo, drag the max notional slider and watch orders flip. Ask: who would raise the limit, and what could go wrong? Same fallback: recorded data, same decisions every run. Then switch to Live and look at the top row: a 250 USD order priced at the live Jupiter quote, checked against the live oracle and its age, with the rule that fired. Drag max oracle gap down to 1 bps and watch that live row flip to rejected.

## Slide 14: The strategy map
[18:31] Demo three. Strategies, the map. Seven families: cross-venue arbitrage, oracle versus pool basis, market making, trend, mean reversion, perpetual carry, and liquidations or events. Next to each, the data it needs. Click one in the demo and the data layers light up. Notice how many need more than one kind of data, and that most need ordering. Tell them the honest bit: most edges vanish after costs and latency. A strategy that looks good on a chart is only the start. We have five sample strategies in the repo, on recorded data, as examples to read. They are simulated and are not advice. Switch to Live and a signal box applies each sample strategy's entry rule to the live prices. Arbitrage needs an 8 bps gap and basis needs 4. Most of the time it says no trade, which is the honest picture.

## Slide 15: Fees and slippage
[18:36] Demo four, the one I care about most. Fees and slippage. Move the sliders and watch gross turn into net. Predict first: at 5 basis points of fee and 2 of slippage, which strategy keeps its result? Then drag. Many of them shrink a lot. Some flip negative. That is the honest picture. Results are simulated, on recorded data, not advice. Your mission in a second is to do this yourself in code. Then switch to Live: the strip under the sliders shows the live Jupiter versus Orca gap next to the cost line. The gap sits far to the left of it. That is the whole lesson in one picture, and it is labelled live, not part of the simulation.

## Slide 16: Try the demos yourself
[19:22] These same demos are live online, so you can open them on your own laptop right now. Scan the code or type the short address. Everything runs in your browser from recorded data, so nothing to install. Move the sliders, break the limits, and see what changes. You can come back to them any time this week.

## Slide 17: Your mission
[18:40] Mission, twenty minutes, everyone together. One: run the sample code on recorded data. Two: before you look at the output, predict what the risk hook will do. Three: change one thing, either one risk limit, or add fees and slippage to a strategy. Four: chart the result, before and after. The finish line is one chart with a before and an after. If you don't have a coding agent, you can still do it: hand edit the number in the limits file, rerun, and compare. I'll walk around; hands up if stuck.

## Slide 18: Build menu
[19:00] Now free build for about fifty minutes. Five ideas if you don't have your own. Beginner: compare two prices and flag the gap; make the project run fully offline. Standard: test one strategy family from the map with fees and slippage; write a new risk rule. Advanced: add a data source. If you have your own project from Workshop 1, bring the risk hook into it, that's a great use of the time. Show-and-tell at 19:50, so have something to show, even if small.

## Slide 19: Takeaways
[19:50] Three things. One bad input beats a smart agent. Four kinds of data: venue, oracle, ordering, inventory. And the risk hook is plain code that can say no and say why. Back to the question from the start: which data would hurt your strategy most if it went stale? Two or three answers from the room. And: what did costs do to your sample strategy?

## Slide 20: Branch out
[19:55] If you want to keep going after tonight. Beginner: change a limit and watch which orders flip. Standard: run a second strategy from the map with honest costs and compare the charts. Advanced: add a new pool or venue collector, or a staleness check that fires on old oracle data. Everything stays on recorded data or devnet.

## Slide 21: Share back
[19:57] Share back. Tonight: push your branch to your own repo. Thursday the twenty-ninth: bring your chart, we start with those. Any time: send your repo link to the leads. We use it for our reporting. Thank you. See you Tuesday for build night 2.

## Slide 22: Get the code
[19:53] Here's the code. The repo link and the folder name go up here, and the QR goes straight to tonight's folder, so scan it now. Everything from every session lives in one repo, one folder per session. Two commands, from the demo slash code folder: npm install, then npm run demo with the recorded flag. That's it. Nothing else is needed: no keys, no AI credits, no wallet. Node is the only requirement. The slides are in the same folder under slides. If you haven't cloned it yet, do it now before you leave.

## Slide 23: Let's connect
[19:58] If you want to talk trading, Solana or this series, here is how to reach me. LinkedIn on the left, Telegram on the right. Scan now, or take a photo of the slide.

## Slide 24: Solana
[20:00] That's it for tonight. Push your branch before you leave, keep building if you want to, and bring your chart next Thursday, the twenty-ninth, when we look at bars and change alerts. Thanks for coming. If you have questions or want help setting up, find me or Emma, or message us on Telegram.

