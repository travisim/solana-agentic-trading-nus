# Teaching script: Build night 2, Data Bars and Change Alerts

Presenter: Travis Sim. Thu 29 Oct 2026, 18:00-20:00. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing: mini-talk slides 4-13 take 10 minutes (18:10-18:20); demo tour slides 14-16 take 20 minutes (18:20-18:40, with the bar-sizes demo as a bonus); try-it 17; mission 18; free build 19; closing 20-25 at 19:50.
Say "data collection" and "recorded data". Say "simulated, not advice" for any strategy result. No prizes, no profit claims.
If the room is mostly beginners, run the five-minute primer in `notes/run-of-show.md` (swap, bar, slot) before slide 4.

## Slide 1: Title
[18:00] Welcome back, thanks for coming. I'm Travis. Tonight is build night 2. The plan is the same as last time: a short talk, three demos where you guess the answer first, and then most of the time you build. Tonight's topic: data bars and change alerts. Two ideas. One, cut trades into bars by how much traded, not by the clock. Two, wake your agent only when something actually changed. If you haven't run the setup yet, no stress, we sort it at the start of the mission.

## Slide 2: Where we are
[18:02] Quick progress circle. Build night 1 was last Thursday: data collection and the risk hook. Tonight is build night 2. Next Thursday the fifth is Workshop 2, labeling trades and forming teams, so what you build tonight can feed your team project. Go round the room, one line each: what did you build or try since Thursday, and is anything stuck? Then the question for tonight, on the slide: how many agent calls does a day of price ticks really need? Keep a guess in your head. We come back to it at the end.

## Slide 3: Tonight
[18:10] Here is the shape of the night. Ten minutes of talk, twenty minutes of demos, twenty minutes of guided mission where we all do the same small thing, then fifty minutes of free build on whatever you want. Last ten minutes: show and tell and push. In the demos I'll ask you to predict before I run anything. Be wrong out loud, it is more useful than being quietly right.

## Slide 4: Clock versus activity
[18:11] Two ways to cut a stream of trades into bars. A bar is just a summary of a stretch of trades: where the price opened, high, low, closed, and how much traded. Clock bars: one bar every minute, whatever happened. Quiet minute, you still get a bar, with almost nothing in it. Busy minute, everything is squeezed into one bar. Activity bars: one bar every X dollars traded. A quiet hour gives you a few bars, a busy minute gives you many. The idea: each bar then carries a similar amount of information. Which one is better is not obvious yet, so let's draw it.

## Slide 5: Time bars
[18:12] Same trades the whole way through, they stay in place. Each stick is one trade, taller means more dollars. The first picture is time bars, one per minute, so ten equal boxes. Look at the left: a minute with one small trade still gets a full bar. Now look at the busy stretch in the middle: lots of big trades, but they land in just a few bars. We lose the detail exactly where the action is. Illustrative trades here, real ones in a minute.

## Slide 6: Dollar bars
[18:13] Now I add dollar bars, below. A dollar bar closes when a set amount has traded, here three thousand dollars, no matter how long that took. So the boxes have different widths. In the quiet stretch one bar takes several minutes to fill, so it is wide. In the busy stretch bars fill fast, so they are narrow and there are more of them. The last box on the right is still filling, it is not closed yet. Same trades, different way to cut them.

## Slide 7: Same trades, both ways
[18:14] Both together. Count the bars in the busy stretch: time bars give you a few, dollar bars give you more, narrower ones. Count the bars in the quiet stretch: time bars give you one for every minute, dollar bars give you hardly any. Total bar counts are on the slide. Say it out loud: dollar bars spend their bars where the trading is. For an agent that means fewer empty rows and less noise, and more detail when it matters. Predict question for later: on real swaps, which makes more bars?

## Slide 8: Changes add up
[18:15] Second idea: a change alert. Top chart is a price, moving a little each tick. Below is the CUSUM filter, a running total of those moves. Up moves add, down moves subtract, and most of them cancel out, so the total wanders around zero. There are really two totals, one for up and one for down, we call them sPos and sNeg. Nothing exciting yet. The interesting bit is what happens when one of them gets big.

## Slide 9: The bucket fires
[18:16] Now the threshold, the dashed lines. Think of two buckets, one filling with up moves, one with down moves. Nothing happens while they are below the line. The moment one crosses it, we fire an event and empty the buckets. The marks on the price chart are the events. So the filter does not say the price is high or low. It says: enough change has piled up in one direction, something happened. A noisy wiggle that goes up and down never fills a bucket. A real move does.

## Slide 10: The agent wakes only on events
[18:17] Why do we care? Every call to an agent costs money and time, and most ticks do not matter. Top row: an agent that wakes on every tick, one call per dot. Bottom row: an agent that wakes only on events. Look at the numbers on the right, they come from our recorded data: the same series, the call count with and without the filter. Be honest about the trade: a higher threshold saves more calls but you catch the move later, and you may miss a small one. That is the knob you will turn in the mission. It's a simulation on recorded data, not advice.

## Slide 11: A frozen feed
[18:18] Third idea, and a nasty one: a feed that stops. Pyth gives you a price with a publish time and the slot it was posted in. If the oracle stops updating, the price still sits there looking perfectly normal. You catch it from the data. Check one: age, now minus publish time, in seconds. Check two: slots behind, current slot minus the slot it was posted in. A slot is about 0.4 seconds, so seventy-five slots is about thirty seconds. If either is over its limit, treat the price as stale. Same lesson as last week: a smart agent on an old price is confidently wrong.

## Slide 12: Real numbers
[18:19] Real numbers now. These are real swaps on the Orca SOL/USDC pool, read over public mainnet RPC, recorded on the date in the source line. The cards show how many swaps, how many dollars traded, and how many bars each method made from the very same swaps. Read the counts: the two methods disagree, and that is the point. Then the safety line, read it out: reads use public mainnet data; every write is devnet only; no real funds. Nobody needs a wallet tonight. Quick note: a bar here is a summary of swaps, nothing more.

## Slide 13: The bar builder
[18:20] This is what the bar builder looks like. It is short. Walk through the swaps in order. Keep a running dollar total. When it reaches the threshold, close the bar with its open, high, low, close and volume, and start the next one. That's the whole trick. Change one number, the threshold, and you change how many bars you get. In the mission you will change that number and predict the new bar count before you run it.

## Slide 14: Demo: time bars and dollar bars
[18:20] Demo one. First, predict. From the same recorded swaps, which makes more bars, the clock or the dollars? By how many? Shout a number. Then I run the command. Default is recorded data so it works without wifi. Then open the bars demo: move the threshold slider and watch the dollar bars change, hover a bar to see its open, high, low, close and volume. Look for the quiet and busy stretches. The bonus demo, bar sizes, shows how long each dollar bar took to fill. If the run fails: recorded flag, nothing else changes. Then flip the demo to Live mode: new real Orca swaps arrive and you can watch a dollar bar close when the dollars add up, while the time bar waits for the clock. Live swaps arrive slowly, so lower the dollar bar size to see bars close, and be ready to say the live age uses your own laptop clock.

## Slide 15: Demo: a change alert
[18:27] Demo two. Before I run: how many agent calls will the filter save, and roughly where will it fire? Guess a percentage. Then run it. The output shows the number of calls if the agent wakes every tick, and the number if it wakes on events only. In the lab demo, drag the threshold slider and watch the buckets fill and empty and the call counter move. Ask the room: who would pick a lower threshold, and what is the price of that? Same fallback: recorded data, same events every run. Then switch Live mode on: the real price ticks feed the same buckets, so watch for an alert firing when the total crosses the threshold, and for how quiet most ticks are.

## Slide 16: Demo: a frozen feed
[18:34] Demo three. Pyth publish time against the current slot. The data underneath is real Pyth reads, one every five seconds. Then comes the part I have to be honest about: the freeze is simulated, I repeat the last value on top of the real data to mimic a feed that stopped. It's labelled as such in the demo. Predict: how many seconds until the staleness check turns red? Press the button and see. Then move the limits and watch what the agent would have done on the stale price: it would have acted. That is the point of the check. Then switch Live mode on: it reads the real Pyth price account, so look at the age and slots behind; while the feed is healthy they stay small, and be ready: the real feed sometimes goes over the 30 second limit on its own (we have seen 67 seconds), so it may turn red without the button, which is the check doing its job. The age uses your laptop clock. The freeze button is simulated.

## Slide 17: Try the demos yourself
[18:40] Before the mission: all the demos are online, so you can open them on your own laptop, no install. Scan the QR or type the short link. Open the first one, move the sliders, hover the bars. This is the quickest way to get a feel for the threshold before you touch any code. If your wifi is slow, the same files are in the repo and open from disk.

## Slide 18: Your mission
[18:40] Mission, twenty minutes, everyone together. One: run the sample bar builder on recorded data. Two: before you look at the output, predict the bar count. Three: change one thing, the threshold or the token. Four: chart the result, before and after. The finish line is one chart with a before and an after. If you don't have a coding agent, you can still do it: hand edit the threshold number, rerun, compare. I'll walk around; hands up if stuck.

## Slide 19: Build menu
[19:00] Free build for about fifty minutes. Four ideas if you don't have your own. Beginner: bars for another token. Standard: a CUSUM alert bot, or a staleness monitor. Advanced: wire bars into an earlier strategy and compare agent calls. If you have your own project, bring the change alert into it, that's a great use of the time. Show and tell at 19:50, so have something to show, even if small.

## Slide 20: Takeaways
[19:50] Three things. Activity bars carry more even information than clock bars. A CUSUM filter wakes the agent only on a real change, so it makes fewer calls. And check how old a price is, in seconds and in slots. Back to the question from the start: how many agent calls does a day of ticks really need? Two or three answers from the room. And: what did your threshold change do to the bar count, and to the calls?

## Slide 21: Branch out
[19:53] If you want to keep going after tonight. Beginner: run the bar builder on another token, or halve the threshold, and compare the bar counts. Standard: try three CUSUM thresholds and chart calls against the events you catch. Advanced: feed your bars into an earlier strategy and compare agent calls. Everything stays on recorded data.

## Slide 22: Share back
[19:55] Share back. Tonight: push your branch to your own repo. Thursday the fifth, Workshop 2: bring your chart, we start with those, and it feeds the team matching. Any time: send your repo link to the leads, we use it for our reporting. Thank you. See you next Thursday.

## Slide 23: Get the code
[19:57] Here's the code. The QR goes to tonight's folder in the one shared repo on GitHub, scan it now. Two commands, from the demo slash code folder: npm install, then npm run demo with the recorded flag. That's it. No keys, no AI credits, no wallet. Node is the only requirement. The slides are in the same folder under slides. If you haven't cloned it yet, do it now before you leave.

## Slide 24: Let's connect
[19:58] If you want to talk trading, Solana or this series, here is how to reach me. LinkedIn on the left, Telegram on the right. Scan now, or take a photo of the slide.

## Slide 25: Solana
[20:00] That's it for tonight. Push your branch before you leave, keep building if you want to, and bring your chart to Workshop 2 next Thursday. Thanks for coming. If you have questions or want help setting up, find me or one of the leads, or message us on Telegram.
