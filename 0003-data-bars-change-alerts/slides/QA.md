# Q&A prep: Build night 2, Data Bars and Change Alerts

For Travis (and the leads) to answer questions while presenting. Grouped by slide number and demo. Slide numbers refer to the 25-slide deck. Answers are written to be said aloud.

Facts used below come from the recorded data in `demo-repo/code/out/` (swaps from 17:48 to 18:30 UTC on 21 Oct 2026, which is 01:48 to 02:30 Singapore time on 22 Oct; file captured 19:03 UTC; the numbers below also match `npm run demo -- --recorded`) and match slides 10-12 at build time. **Re-check these numbers after any re-recording** (`out/*.json`, `build-report.json`):
- Orca SOL/USDC whirlpool `Czfq3xZZ...fu44zE`, 2,759 swaps used (2,900 recorded; 2 duplicates, 134 dust swaps under 1 USDC and 5 price outliers dropped), about 42 minutes, $2,322,236 traded (USDC side).
- 60-second time bars: 43 (0 empty minutes; volume per bar from $58 to $118,660). Dollar bars at $50,000: 44 (the last one still filling); they took 1 to 167 seconds to fill, median 52 seconds. Busiest minute (18:14 UTC): $118,660, which is 2 dollar bars; quietest minute (17:52 UTC): $58, which is 0 dollar bars.
- CUSUM at 15 bps: 681 one-second price ticks, 24 events (13 up, 11 down); 681 agent calls on every tick versus 24 on events only, which is 96.5% fewer.
- Staleness limits: 30 seconds and 75 slots. Real Pyth reads: 187 points, one every 5 seconds; typical age before the fault 11 seconds; real maximum age 51 seconds and 227 slots (16 real points would fail the check). The frozen feed is simulated: from the injected start the publish time and posted slot are repeated; the check first turns red 10 seconds after the freeze starts.

Rules to keep in every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated or computed on recorded data, not advice. No prizes, no promises about returns.

---

## Slides 1-3: Title, where we are, tonight

**Q: Do I need to have been at build night 1?** No. Tonight stands alone. Build night 1 was about data collection and a risk hook; tonight we use real swaps and a price age check. If you missed it, the setup takes ten minutes and a lead will help.

**Q: Do I need AI credits or an API key?** No. Everything runs on bundled recorded data with `--recorded`. A coding agent helps, but you can hand-edit one number and rerun.

**Q: What is the question for tonight?** How many agent calls does a day of price ticks really need? We answer it on slide 10 with real numbers.

**Q: What happens next week?** Thu 5 Nov is Workshop 2, labeling trades and forming teams. Bring your chart from tonight.

## Slide 4: Clock versus activity

**Q: What is a bar?** A summary of a group of trades: the first price (open), highest, lowest, last (close), and the dollars traded (volume). Thousands of trades become a handful of rows you can look at.

**Q: Why not just use every trade?** You can, and an agent can too, but it is a lot of calls and a lot of noise. Bars compress it. The choice of how to group is the interesting part.

**Q: Which is better, clock or activity?** Activity bars carry a more even amount of information per bar, because each holds about the same dollars. That is why people like them. Time bars are simpler, and are what most charts show. We compare both on real data tonight.
- *If they push:* "better" depends on the job. If you need a fixed schedule, a clock is natural. Do not take our one 42-minute sample as proof of anything.

**What this slide does not show:** any data. It is a picture of the idea.

## Slides 5-7: Time bars, dollar bars, same trades both ways

**Q: Are those real trades?** No, slides 5-7 are an illustration with made-up trades (labelled "Illustrative"). Real ones are on slide 12 and in demo 1.

**Q: Why is the first dollar bar so wide?** Because the trades before the busy stretch are small, so it takes a long time to reach $3,000. A wide dollar bar means a quiet period.

**Q: What is the dashed box on the last dollar bar?** That bar has not reached the threshold yet; it is still filling. Real code keeps it, marked as partial.

**Q: Can a dollar bar be bigger than the threshold?** Yes, slightly. The swap that crosses the line stays in that bar, so a bar can end a bit over.

**Q: What threshold should I use?** There is no right answer. Smaller means more bars. Try halving it in the mission and see the count change before you run it.

**What this slide does not show:** how real bars look. It is a hand-made example, and the "4 time bars versus 7 dollar bars" in the busy stretch is only true for this picture.

## Slides 8-10: Changes add up, the bucket fires, the agent wakes only on events

**Q: What is CUSUM?** A running total of price changes. Up moves fill one bucket, down moves fill another. When a bucket crosses a threshold we fire an event and empty both. The name stands for cumulative sum.

**Q: What is a basis point (bps)?** One hundredth of a percent. 15 bps is 0.15%. On a $108 price that is about 16 cents.

**Q: Why two buckets?** One tracks upward drift, one downward drift. A noisy wiggle that goes up and down cancels out and never fills either.

**Q: Does it predict anything?** No. It only says that enough change has piled up in one direction. What the agent does about it is up to you.

**Q: How many calls does it really save?** On our recorded data, 681 one-second ticks became 24 events at 15 bps: 681 agent calls on every tick versus 24 on events only, 96.5% fewer. That is one recording of about 42 minutes, simulated, not advice.
- *If they push:* the saving is a trade. A higher threshold means fewer calls but a later alert, and you may miss a small move. A lower one catches more and costs more. That is the knob you turn in the mission.

**Q: Is a price tick the same as a swap?** Here a tick is one price per second, built from the real swaps. Not every second has a swap, so the price is carried forward.

**What this does not show:** whether the alerts were useful to trade on. We only count calls and mark events. No profit claims.

## Slide 11: A frozen feed

**Q: What is an oracle?** A program on Solana cannot look at a website, so someone writes a price on chain for programs to read. Pyth is one. It stores the price, a confidence band, a publish time and the slot it was posted in.

**Q: What is a slot?** Solana's clock tick, about 0.4 seconds. The slot number goes up each tick. Subtract the posted slot from the current slot to see how many ticks old a price is.

**Q: Why check both seconds and slots?** They are two views of the same question. Seconds come from the publisher's clock. Slots come from the chain's clock, so they cannot be faked by a stuck clock. If either is over the limit, treat the price as stale.

**Q: Why 30 seconds and 75 slots?** They are our teaching defaults; 75 slots is about 30 seconds. Your limits depend on how fast your strategy moves. Change them with `--max-age-sec` and `--max-slots-behind`.

**Q: Does Pyth freeze often?** In our real data the age was normally about 11 seconds, but 16 of the 187 real reads were over a limit (the real maximum was 51 seconds, 227 slots). Live, the age has been seen at 67 seconds. The data comes from reading the price account every 5 seconds over a public RPC, so some of that lag can be our own polling. Do not take it as a statement about Pyth's reliability.

**What this slide does not show:** a real outage. The chart on the slide is an illustration.

## Slide 12: Real numbers

**Q: Where do the swaps come from?** From the Orca SOL/USDC pool on Solana mainnet. We read the pool's two token vaults before and after each transaction. A swap moves them in opposite directions, so we can see how much SOL and USDC changed hands. Price is USDC moved divided by SOL moved.

**Q: Why only 2,759 swaps?** That is what the public endpoint let us collect: about 42 minutes of trading. It is a small sample. The public RPC allows roughly 10 transaction lookups per 10 seconds, so collecting is slow. A few records were dropped (duplicates, dust under 1 USDC, and price outliers); the demo prints how many.

**Q: Does the dollar amount include fees?** The price includes the pool's fee (0.04%), because it comes from the vault changes. We drop swaps under 1 USDC and swaps more than 1% away from their neighbours' median price, and print how many.

**Q: Why are the bar counts so close (43 time bars, 44 dollar bars)?** The counts happen to be close, but the bars are not alike. The busiest minute held $118,660 (two dollar bars' worth) and the quietest only $58 (none). Dollar bars took between 1 and 167 seconds to fill. Same counts, very different bars. Change the threshold in demo 1 and watch the counts move.

**Q: Is it real money?** No. Reads use public mainnet data; every write is devnet only; no real funds. Nobody needs a wallet tonight.

**What this slide does not show:** a representative day. It is one short recording.

## Slide 13: The bar builder

**Q: Do I need to read the code?** No, but it is short. It walks the swaps in order, adds up the dollars, and closes a bar at the threshold.

**Q: What if I get the amounts in the wrong unit?** The swap amounts are already in SOL and USDC. If you add a token, check its decimals (USDC has 6, SOL has 9). That mix-up is the classic mistake.

**Q: Where is the test?** `npm test`. One test checks that the bars' volume adds up to the swaps' volume, so nothing is lost or counted twice.

**What this does not show:** time bars (that is in the same file, `timeBars`) or any strategy.

## Slide 14 and Demo 1: Time bars versus dollar bars (`01-time-vs-dollar-bars.html`)

**Q: What am I looking at?** The same swaps drawn two ways side by side. Left is the fixed one-minute clock, right is the fixed dollar threshold. Counts are shown for each.

**Q: What do the sliders do?** Dollar bar size changes the threshold; time bar length changes the clock. Move them and the counts change.

**Q: What do I hover for?** A bar's open, high, low, close and volume.

**Q: Why do they look so similar?** Because it is a short recording. Look for the quiet and busy stretches; the dollar bars thin out and bunch up where trading did.

**What this demo does not show:** which bar type makes a better strategy. It only shows how they are cut.

**Live mode.** Switch Live on and the demo reads real Orca data from a public RPC in your browser and adds new points. Look for the same logic applied to new swaps: a dollar bar closes when the dollars add up, while the clock bar waits for the minute. If the endpoint is slow or rate limited, the page shows a pill and falls back to recorded data by itself; say so and carry on.

## Slide 15 and Demo 2: A change alert (`02-cusum-bucket.html`)

**Q: What do the two buckets show?** The up total and the down total. They fill as prices move and empty when one crosses the threshold, which is when an event fires.

**Q: What is the counter?** Agent calls: every tick versus events only. It updates when you move the threshold slider. At 15 bps on the recorded data: 681 versus 24.

**Q: What happens at a very low threshold?** Many events, so the savings shrink. At a very high one, few or none. Find the knob you like.

**What this demo does not show:** whether the events were worth acting on.

**Live mode.** Switch Live on and real price ticks feed the same buckets. Look for most ticks to do nothing, and an alert to fire only when the total crosses the line.

## Slide 16 and Demo 3: A frozen feed (`03-frozen-feed.html`)

**Q: Is the freeze real?** No. The underlying Pyth reads are real, one every 5 seconds, and the freeze is simulated on top: from the injected start the last publish time and posted slot are repeated. It is labelled as simulated in the data and in the demo.

**Q: What does the button do?** It injects the frozen feed. The age and slots behind keep rising, and the check turns red once either limit is crossed. In our recording that is 10 seconds after the freeze starts.

**Q: What would the agent have done?** The demo shows it: on the stale price it acts as if nothing is wrong; with the check it holds. Same agent, different input.

**Q: Why does it sometimes turn red without the button?** Real reads occasionally lag. 16 of our real reads would fail the check. Part of that may be our polling.

**What this demo does not show:** a real oracle failure, or how often one happens.

**Live mode.** Switch Live on and the demo reads the real Pyth SOL/USD price account over a public RPC. Look at the age and slots behind: while the feed is healthy they stay small. The freeze button is still how you see the red state.

## Slide 17: Try the demos yourself

**Q: Do I need to install anything?** No. Open the link on your laptop or phone and move the sliders. The same files are in the repo and open from disk.

**Q: Is Live on by default?** No, Recorded is the default. Switch Live on to watch real data.

## Slides 18-19: Mission and build menu

**Q: What if I do not have a coding agent?** Change one number by hand (for example `--threshold-usd 25000`) and rerun `npm run demo -- --recorded`. Compare the bar counts. Chart with a spreadsheet or pen and paper.

**Q: What does "predict the bar count" mean?** Before you run it, write down a number. Then run it. Being wrong is useful.

**Q: Can I use my own project?** Yes. Bring the change alert or the staleness check into it.

**Q: Is there a devnet transaction to try?** Not in the sample code. The Memo-per-decision idea was left out because we could not verify it end to end. If you build it, use a throwaway devnet wallet kept outside the repo.

## Slides 20-25: Takeaways, branch out, share back, get the code, connect, close

**Q: How do I get the code?** Slide 23: the QR goes to tonight's folder in the shared repo, `github.com/travisim/solana-agentic-trading-nus/tree/main/0003-data-bars-change-alerts` (slides are in the same folder under `slides/`). Then `npm install` and `npm run demo -- --recorded` from the `demo/code` folder, Node 24.

**Q: Where do I send my work?** Push your branch to your own repo and send the link to the leads. Bring your chart to Workshop 2 on Thu 5 Nov.

**Q: How do I reach you?** Slide 24: LinkedIn `linkedin.com/in/travisim` and Telegram `t.me/travisim`.

---

## Caveats to say out loud (live mode and the frozen feed)

- **The real Pyth feed often goes over the 30 second limit by itself.** In our recording 16 of 187 real reads were flagged stale, and live the age has been seen at 67 seconds. So the check can turn red with no button pressed. That is the check working, not a bug. Part of the lag can come from reading a public RPC every few seconds. Do not present it as a verdict on Pyth.
- **Live swaps arrive slowly.** On the real pool a $50,000 dollar bar takes anywhere from 1 to 167 seconds to fill in our recording (median 52 seconds), and live can be slower. To see bars close in Live mode, lower the dollar bar size with the slider.
- **Live age uses the viewer's own clock.** The browser compares the publish time with the laptop's clock, so a clock that is a few seconds off shifts the age by that much. Slots behind come from the chain and do not have that problem.
- **Demo 3's freeze is simulated** on top of real reads (publish time and posted slot repeated). Nothing on the real feed froze. The first red after the freeze came 10 seconds in, in the recorded run.

## Live mode, in plain words

- **What students see:** a LIVE pill, the last update time and the source (slot or price). New points appear on the chart and feed the same logic as the recorded data.
- **If an endpoint is slow or rate limited:** the page shows an error pill and falls back to recorded data by itself. Say: "that is a public endpoint shared by everyone; recorded is the default for exactly this reason." Do not wait for it.
- **Reads only:** no keys, no wallet, no writes.

## Plain-words glossary

- **Swap:** one trade against a pool: someone gave X SOL and got Y USDC.
- **Bar:** a summary of a group of swaps (open, high, low, close, volume).
- **Slot:** Solana's clock tick, about 0.4 seconds.
- **Oracle age:** how long ago the price was published; compare with now.
- **bps (basis point):** one hundredth of a percent.
- **CUSUM:** a running total of changes that fires when it crosses a threshold.
- **Fees and slippage:** fees are what the pool or exchange charges; slippage is the price moving against you between deciding and filling. Tonight's demos do not simulate either; the pool fee is already inside the swap price.

## General questions

**Is this real money? Can I lose funds?** No. Reads use public mainnet data; every write is devnet only; there are no real funds, no wallet, no keys. Nothing in this repo signs or sends a transaction.

**What is devnet?** Solana's test network. Its tokens have no value. It is for trying things.

**Can I use this for a real strategy?** Tonight is about learning the building blocks. Results are simulated or computed on recorded data, not advice, and a short recording says little about the future. Do your own research, and do not risk money you cannot lose.

**What if setup fails?** Do not debug for more than 3 minutes: pair with a neighbour or a lead's laptop, or use the demos in the browser (slide 17). Tell a lead so we can note the blocker.

**Where do I get help?** Ask a lead in the room; message Travis on Telegram (`t.me/travisim`); program support is @Aaron_Solanki on Telegram.

**Any prizes or funding?** Nothing is promised. Do not advertise any.
