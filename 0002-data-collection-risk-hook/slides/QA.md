# Q&A prep: Build night 1, Data Collection and Risk Hook

Thu 22 Oct 2026. For the presenter, to use while presenting. Grouped by slide number (the 24-slide deck) and by demo. Each answer is something you can say aloud in 2 to 4 sentences; "If they push" is the sharper follow-up.

Rules for every answer: reads use public mainnet data, every write is devnet only, no real funds. Strategy results are "simulated, on recorded data; not advice". No prizes, no returns claims. Say "data collection" and "recorded data".

## Facts to have in your head (all from `demo-repo/code/out` and `recorded/`)

- Recorded data: 481 points, one every 5 s, 40 minutes, captured Wed 21 Oct 2026 17:13:59 to 17:53:59 UTC (Thu 22 Oct 01:14 to 01:54 SGT). Zero failed ticks. A quiet Asian night window, not a busy market.
- Last snapshot (slide 10): Jupiter quote 108.6246, Pyth oracle 108.6054 (confidence 2.68 bps, posted slot 459,720,770 = current slot, published 3 s before the read), Orca pool 108.5865. Gaps: Jupiter vs Pyth +1.8 bps, Orca vs Pyth -1.7 bps, Jupiter vs Orca +3.5 bps.
- Over the 40 minutes: Jupiter vs Pyth mean +1.8 bps, largest 11.2 bps. Orca vs Pyth mean +1.1, largest 7.2. Jupiter vs Orca mean +0.7, largest 6.3 bps. Widest spread between the highest and lowest of the three: 11.2 bps, at about 6.4 minutes in (the demo opens there). Mean spread 3.2 bps.
- Risk hook defaults: max notional 1,000 USD, max oracle gap 50 bps, max oracle age 60 s, plus a unit-sanity check. Ten example orders: 4 accepted, 6 rejected (5,000 USD: max-notional; two orders 100 bps off: max-oracle-gap; oracle 300 s old: max-oracle-age; price 100x (cents) and size -50: unit-sanity).
- Strategies at 5 bps fee + 2 bps slippage (per leg), simulated: cross-venue arbitrage 0 trades; basis 19 trades, gross +1.31, net -25.29 USD; trend 10 trades, gross +0.61, net -13.39; mean reversion 9 trades, gross +1.03, net -11.57; market maker 7 trades, gross +0.05, net -3.45 (fees only, no slippage). All net negative or zero. 1,000 USD per trade leg.
- Arbitrage makes 0 trades because its entry threshold is 8 bps and the largest Jupiter vs Orca gap in the window was 6.3 bps.
- Tests: 27 pass (`npm test` in `demo-repo/code`).

---

## Slide 1: Title

1. **What is a build night?** A short talk, a few demos, then mostly you building. Tonight about 10 minutes of talk, 20 of demos, 20 of mission and 50 of free build.
2. **Do I need to know Solana or trading?** No. Beginners are the target. If you can run a command and change a number, you can do tonight's mission.
3. **Do I need a wallet or any money?** No. No wallet, no keys, no seed phrases, no AI credits. Reads use public mainnet data and every write is devnet only.
4. **Is this the same as Workshop 1?** It builds on it. Workshop 1 was a first bot; tonight is about the data a bot reads and the code that can say no to it.

## Slide 2: Where we are

1. **What happened in Workshop 1?** We picked a trading bot and built a first one (Tue 13 Oct). Tonight is the first build night.
2. **What is next?** Build night 2 on Tue 27 Oct: data bars and change alerts. Bring your chart from tonight.
3. **What is the question for tonight?** Which data would hurt your agent most if it went stale? Think about it during the talk.
4. **I missed Workshop 1. Am I lost?** No. Everything tonight runs from the repo and the demos; the recorded data is included.

## Slide 3: Tonight

1. **When do I code?** The guided mission is 18:40 to 19:00, free build 19:00 to 19:50. Before that you predict and watch.
2. **What is show and tell?** At 19:50, two or three volunteers show one thing and say one next step. Even something small counts.
3. **Why predict first in the demos?** Guessing before you see the answer is how you learn what surprised you. There is no wrong guess.
4. **Do I have to finish something?** No. The finish line is one chart with a before and an after, and that is the mission, not the whole night.

## Slide 4: A smart agent with bad data

1. **Are those numbers real?** No, the slide is illustrative: a price read 1 second ago versus 4 minutes ago. The point is that the agent gives the same confident answer both times.
2. **Why does the agent not notice?** It only knows what it was given. Nothing in an old number says "I am old", unless you record a timestamp and check it.
3. **So a better model fixes it?** No. A smarter model with a stale input is still wrong, just more confidently. The fix is checking the data, which is what the risk hook does.
4. **Is this a real failure?** Yes, a common one: old prices, wrong units and old balances are everyday causes of bad agent decisions. If they push: tonight's demo 1 shows it with a slider.

## Slide 5: Four kinds of data, venue price

1. **What is a venue price?** The price you could actually trade at right now, for example "sell 1 SOL, get N USDC" from Jupiter. Fees and routing are already inside that number.
2. **What is Jupiter?** A free service that asks many pools and returns the best route. We use its public quote API, no key.
3. **Why is one venue's price not "the market"?** Different venues can differ by a few basis points at the same moment. In our recorded data Jupiter vs Orca differed by up to 6.3 bps.
4. **What is a basis point?** One hundredth of a percent. 100 bps is 1%. If they push: 5 bps on a 1,000 USD trade is 0.50 USD.

## Slide 6: Four kinds of data, oracle price

1. **What is an oracle?** A program on chain cannot look at a website, so an oracle writes a price on chain for programs to read. Pyth is one.
2. **What is the confidence number?** How unsure the price is, as a band around it. In our snapshot it was 2.68 bps, which is tight.
3. **How can an oracle price be bad?** It can be old, or its band can be wide. So you check the age and the confidence before you trust it.
4. **Why not just use the Pyth website?** The easy REST API is paywalled, so our code reads the Pyth price account straight from the chain over a public RPC. That is free and needs no key.

## Slide 7: Four kinds of data, ordering

1. **What is a slot?** The chain's clock tick, roughly 0.4 seconds. Each block has a slot number.
2. **Why does ordering matter?** Two prices from different slots are not from the same moment. Comparing them can look like a gap that is really just a time difference.
3. **What do postedSlot and currentSlot mean?** postedSlot is when the oracle price was written; currentSlot is where the chain was when we read it. In our snapshot they were both 459,720,770.
4. **Is a slot the same as time?** Roughly: 2.5 slots a second on average, not exact. That is why we also record publish time and age.

## Slide 8: Four kinds of data, inventory

1. **What is inventory here?** What you hold right now: token balances. It decides how much you can buy or sell.
2. **What is a lamport?** The smallest unit of SOL: 1 SOL is 1,000,000,000 lamports. Mix up the unit and your size is off by up to a billion times.
3. **Are we connecting a wallet tonight?** No. Inventory is just a number passed into the sample code. No wallet, no keys.
4. **How does inventory go bad?** An old balance, such as a trade you thought went through, or the wrong unit. Both make the order size wrong.

## Slide 9: The risk hook

1. **What is a risk hook?** Plain code between an agent's idea and any action. It checks the order against rules and either says yes, or says no and says why. There is no AI in it.
2. **What are the four rules?** Max notional 1,000 USD, max oracle gap 50 bps, max oracle age 60 seconds, and a unit-sanity check. They are the defaults; you can change them.
3. **Why say why?** So you can read the reason and fix the cause. "Rejected: 5,000 USD exceeds the 1,000 USD limit" is fixable; a silent block is not.
4. **Can the hook be wrong?** Yes, it only knows its rules. A bad rule or a stale input can still let a bad order through. It reduces mistakes; it does not remove risk.
5. **Does it guarantee I will not lose money?** No. It is a guard against some mistakes, not a promise about results. Tonight everything is simulated or devnet.

## Slide 10: Real numbers

1. **Where do these numbers come from?** Recorded data: a real snapshot captured on 21 Oct 2026 at 17:53:59 UTC from Jupiter, the Pyth on-chain account and the Orca pool. The date is on the slide.
2. **Why do the three prices differ?** They are different kinds of price: Jupiter is a quote for 1 SOL including fees and impact, Pyth is the last pushed oracle price, Orca is the pool's marginal price. Some gap is expected.
3. **Are those gaps big?** No: +1.8, -1.7 and 3.5 bps. Over the whole 40 minutes the largest single gap was 11.2 bps (Jupiter vs Pyth).
4. **Is this real money?** No. We only read public data. Every write is devnet only, with no real funds and no seed phrases.
5. **Why not show live numbers?** Recorded data works with no network and gives every laptop the same answer. We switch to live in the demos.

## Slide 11: The collector

1. **What does this code do?** It calls the public Jupiter quote API for 1 SOL to USDC, with no key, and turns the answer into a price.
2. **Why divide by a million?** USDC has 6 decimals, so the amount comes back in millionths. Dividing by 1,000,000 gives dollars. That one line is the wrong-unit failure handled.
3. **What if the API says no?** The code stops with a clear error. If it is rate limited (HTTP 429) it says so. It never makes up a price.
4. **Where are the other two collectors?** In the repo: `collectors/pyth.ts` and `collectors/orca.ts`. They read the account bytes over RPC and decode them, with the layout written in the comments.

## Slide 12: Demo: the price gap

1. **What should I predict?** Do the three prices agree, and by how many bps? In the recorded window the typical gap is a few bps (mean spread 3.2 bps).
2. **What does the command do?** `npm run demo -- --recorded` prints the three prices and the gap of each against Pyth, using the bundled recorded data. No network needed.
3. **What is the gap chart?** The bottom-left chart shows Jupiter and Orca minus Pyth, in bps, over 40 minutes. It wanders within a few bps, with a few peaks.
4. **Is a gap an opportunity?** Only if it is bigger than your costs. A gap is a candidate, not a profit; demo 4 shows why.
5. **What is the yellow band?** The spread between the highest and lowest of the three prices at the selected time. The demo opens at the widest point: 11.2 bps.

## Slide 13: Demo: the risk hook

1. **What should I predict?** Which orders pass and which rule stops each one that does not. At default limits 4 of the 10 pass.
2. **What happens when I drag max notional?** Orders flip between accepted and rejected live. At 5,000 and above, the 5,000 USD order passes (if the other rules allow it).
3. **Why is the cents order rejected?** Its price is 100 times the oracle price, so unit-sanity catches it before any maths. It is the wrong-unit failure from slide 8.
4. **Why does one order say "oracle 300 s old"?** The example is built to have an old oracle price. It shows that max-oracle-age rejects an order even when the price itself looks fine.
5. **Who would raise the limit, and what goes wrong?** Someone who wants bigger trades. The risk is one mistake becoming a bigger mistake; that is the trade-off the limit controls.

## Slide 14: The strategy map

1. **What are the seven families?** Cross-venue arbitrage, oracle/venue basis, market making, trend/momentum, mean reversion, funding/basis carry, and liquidation/event-driven.
2. **What do the letters V, O, S, I mean?** Venue price, oracle price, slot (ordering) and inventory: the four kinds of data each family needs.
3. **Which ones do we have code for?** Five: arbitrage, basis, trend, mean reversion and a simulated market maker. Funding carry and liquidation are not simulated tonight.
4. **Which family is best?** None, and we are not recommending one. The map is a teaching tool; most edges vanish after costs and latency.
5. **Why do most need ordering?** Anything that trades two things "at the same moment" depends on which slot each price is from.

## Slide 15: Fees and slippage

1. **What is a fee?** What the venue charges per trade. We use 5 bps per leg in the demo.
2. **What is slippage?** The difference between the price you expected and the price you got, because the price moved or your order moved it. We use 2 bps per leg.
3. **What does gross versus net mean?** Gross is the result before costs, net is after. Basis made +1.31 USD gross but -25.29 net over 19 trades (2 legs each, 1,000 USD per leg).
4. **Why does arbitrage show nothing?** It made 0 trades: it enters at 8 bps and the largest Jupiter vs Orca gap was 6.3 bps. No trade is a legitimate result.
5. **Are the numbers tuned to look bad?** No. They are untuned defaults and every strategy ended net negative or zero. A different window or market could differ; that is why this is simulated, on recorded data, not advice.
6. **What is break-even cost?** The per-leg cost at which gross just covers it. For basis it is about 0.3 bps, far below the 7 bps (5 + 2) we charge.

## Slide 16: Try the demos yourself

1. **What is the link?** nus-solana-demos.vercel.app/0002, or scan the code. Five demos, open in any browser.
2. **Do I need to install anything?** No. Each demo is one self-contained file; they also open from disk.
3. **Does it use my data or my wallet?** No. Recorded mode uses bundled data; Live mode only reads public data. Nothing is written.
4. **Will it still work next week?** Recorded mode will. Live mode depends on public endpoints that can be slow or rate limited.

## Slide 17: Your mission

1. **What is the mission?** Run the sample code on recorded data, predict what the risk hook will do, change one limit or add fees and slippage to a strategy, and chart the result before and after.
2. **What counts as the finish line?** One chart with a before and an after. Hand-drawn or spreadsheet is fine.
3. **I do not have a coding agent. Can I still do it?** Yes. Open `code/src/risk.ts`, change one number in `DEFAULT_LIMITS`, rerun `npm run demo -- --recorded` and compare. For strategies, change `--fee-bps` and `--slippage-bps`.
4. **What if setup fails?** Do not debug alone for more than a few minutes; pair with a neighbour or use a lead's laptop. The lab demos need no install.
5. **Can I use live data in the mission?** Not needed and not recommended: recorded is the default so everyone gets the same numbers.

## Slide 18: Build menu

1. **Which should I pick?** If you have your own project from Workshop 1, bring the risk hook into it. Otherwise pick from the menu.
2. **What is on the menu?** Beginner: compare two prices and flag the gap; make the project run fully offline. Standard: test one strategy family with fees and slippage; write a new risk rule. Advanced: add a data source.
3. **Is advanced realistic in 50 minutes?** Adding one collector (a new pool) is, using the existing three as examples. Do not try everything.
4. **Is there a prize?** There is no prize or reward tonight. Show and tell is just for sharing.

## Slide 19: Takeaways

1. **What are the three?** One bad input beats a smart agent. Four kinds of data: venue, oracle, ordering, inventory. The risk hook is plain code that can say no and say why.
2. **What did costs do to the sample strategies?** Every one ended net negative or zero after 5 bps fee and 2 bps slippage, on recorded data. Simulated, not advice.
3. **Which data would hurt most if stale?** There is no single answer. Oracle price often, because risk checks lean on it; ordering for anything two-sided.

## Slide 20: Branch out

1. **What do I do after tonight?** Beginner: change a limit and see which orders flip. Standard: run a second strategy with honest costs and compare charts. Advanced: add a collector, or a staleness check that fires on old oracle data.
2. **Can I connect a wallet?** Not in tonight's code. Any transaction you add later must be devnet only with a throwaway wallet.
3. **Can I trade real money with this?** The repo does not place trades and is not built for that. Nothing here is advice.

## Slide 21: Share back

1. **What do I push?** Your branch to your own repo. Then send the repo link to the leads; we use it for reporting.
2. **What do I bring on Tuesday?** Your chart. We start build night 2 (Tue 27 Oct) with those.
3. **Is it graded?** No. It is for sharing and for our reporting.

## Slide 22: Get the code

1. **What are the commands?** `npm install` then `npm run demo -- --recorded`, both from the `demo/code` folder of the session folder `0002-data-collection-risk-hook` in the shared repo `github.com/travisim/solana-agentic-trading-nus` (slides are in the same folder under `slides/`). Node 24 or newer.
2. **Do I need keys or credits?** No keys, no AI credits, no wallet. Recorded data is bundled.
3. **Does it write anything?** `npm run demo` writes four JSON files in `out/`. It writes nothing to any chain.
4. **The link does not open.** The public repo goes up only when the organisers publish it; until then use the copy on the USB stick or AirDrop from a lead.

## Slide 23: Let's connect

1. **How do I reach you?** LinkedIn linkedin.com/in/travisim and Telegram t.me/travisim; the QR codes are on the slide.
2. **Where do I get setup help?** Find a lead in the room, or message on Telegram.
3. **Where is program support?** The program support contact is @Aaron_Solanki on Telegram.

## Slide 24: Solana

1. **What do I do before I leave?** Push your branch, and bring your chart next Tuesday.
2. **When is the next session?** Build night 2, Tue 27 Oct 2026, 18:00 to 20:00.
3. **Is there a feedback form?** Yes, the leads share it after the session; please fill it in.

---

## Demo 1: Four data layers (`01-four-data-layers.html`)

Used around slides 4 to 8 if you want to show the stale-data idea live (not a numbered slide).

1. **What am I looking at?** Four layers (venue price, oracle price, ordering, inventory). Pick one and move the slider to make it older.
2. **Why does the agent still say BUY with 98% confidence?** Because it only knows its last input. Past 30 seconds the layer turns STALE, the decision turns "wrong" and the confidence number does not change.
3. **Where do the numbers come from?** Recorded snapshot (Jupiter 108.62, Pyth 108.61, slot 459,720,770) and the 40-minute series for the aged values.
4. **Is the inventory real?** No. 12 SOL is an example wallet; nothing is read from a wallet.
5. **Why 30 seconds?** An illustrative threshold for the demo. Real limits depend on your strategy; the sample hook uses 60 s for the oracle.

**What this does not show:** a real agent. The "agent" box is a scripted decision to make the point.

## Demo 2: Price gap (`02-price-gap.html`)

1. **How do I read it?** Top chart: three prices over 40 minutes. Bottom left: each venue minus Pyth in bps. Right: values at the scrubbed time, and the spread.
2. **What is the biggest gap?** 11.2 bps spread at about 6.4 minutes in. Mean spread is 3.2 bps. Largest Jupiter vs Orca gap: 6.3 bps.
3. **Is the gap tradeable?** Only if it beats costs, and these are quotes and polled snapshots, not executable fills.
4. **Why do the lines not move together exactly?** Different price kinds and a poll every 5 s with reads within about a second of each other, not at one instant.

**What this does not show:** tick data, depth or fills; 40 minutes of a quiet night is not a busy market.

## Demo 3: Risk hook (`03-risk-hook.html`)

1. **What do N, G, A, U mean?** Max notional, max oracle gap, max oracle age, unit sanity. A green tick is pass, a red cross is fail.
2. **Which rule wins if two fail?** Only one reason is shown: the first failing rule. The demo checks unit sanity first, then notional, gap and age. (The TypeScript `risk.ts` checks age before notional and gap, so with two failures the terminal and the demo can name different rules; each order still gets rejected.)
3. **Why do the numbers match the terminal?** The browser re-runs the same four rules on the same orders. At the default limits it matches the recorded decisions (10 of 10).
4. **Can I add a rule?** That is a build-menu task: add a function in `risk.ts` and a case in the demo.

**What this does not show:** a real order flow, or whether a limit is the right one for your strategy.

## Demo 4: Strategy map (`04-strategy-map.html`)

1. **What happens when I click a family?** The data layers it needs light up and a one-line idea appears with the sample result if we have one.
2. **Why do two families say "Not simulated tonight"?** We have no funding-rate or liquidation data tonight.
3. **What does "net -25.29 USD over 19 trades" mean?** The basis sample after 5 bps fee and 2 bps slippage per leg. Simulated, on recorded data; not advice.

**What this does not show:** which strategy works. It shows what data each needs.

## Demo 5: Fees and slippage (`05-fees-slippage.html`)

1. **What do the bars mean?** Outlined bar: gross. Filled bar: net (mint above zero, red below).
2. **How is net computed?** Gross minus trades x legs x notional x (fee + slippage). It is re-priced in the browser from the recorded trade counts.
3. **Why does market maker pay no slippage?** In the simulation it is a resting quote, so it pays fees but not slippage.
4. **Why is cross-venue-arb flat?** It made 0 trades on this data.

**What this does not show:** real fills, queue position, or any future result.

---

## Live mode (all five demos)

**What students will see.** A Recorded / Live switch at the top right. Recorded is the default and works offline. Live turns the pill to LIVE with the time of the last update and the current slot, and refreshes every 5 seconds. Open `?live=1` to start live. Reads are public: a Jupiter quote, the Pyth price account and the Orca pool account over a public RPC. Nothing is written.

**What changes in each demo.**
- Demo 1: live Jupiter and Pyth prices, the latest slot and the oracle's real age ("published N s ago"). If the oracle layer goes over 30 s old it turns STALE for real.
- Demo 2: a new point every 5 seconds is added to the chart (up to 120 are kept).
- Demo 3: the example orders are re-priced to the live oracle, plus a live order at the Jupiter quote, all run through the same four rules, showing accepted or rejected with the rule. Drag max oracle gap down to 1 bps to see a live rejection.
- Demo 4: each strategy's entry rule applied to the live prices (arbitrage 8 bps, basis 4 bps), with no trade placed. Trend and mean reversion need 60 points (about 5 minutes).
- Demo 5: a strip with the live Jupiter vs Orca gap next to the cost line (2 legs x (fee + slippage)). It is labelled live and is not part of the simulation.

**If an endpoint is slow or rate limited.** The page shows a pill ("rate limited, back to recorded") and goes back to recorded data by itself. Say: "That is the public endpoint asking us to slow down. That is why recorded is the default." Flip back to Recorded and carry on; do not debug on stage.

**Plain-words glossary.**
- Slot: the chain's clock tick, about every 0.4 seconds.
- Oracle age: now minus the time the oracle price was published.
- Basis point (bps): one hundredth of a percent.
- Fee: what the venue charges. Slippage: the price you get versus the price you expected.
- Gross versus net: before and after costs.
- Notional: the size of an order in dollars.

**Live questions.**
1. **Why do the live prices differ from the slides?** The slides use recorded data from 21 Oct. Live is now.
2. **Why is the oracle sometimes several seconds old?** The oracle price is pushed periodically, not in every slot, so some age is normal. In our checks it was about 3 to 8 seconds.
3. **Why does the live gap look bigger or smaller than recorded?** Different moment. The recorded window was a quiet night.
4. **Can live data place trades?** No. Live only reads.
5. **Why not use the main Solana RPC?** It rejects requests from browsers, so the demos use a public RPC that allows them.

---

## General questions

1. **Is this real money?** No. Reads use public mainnet data; every write is devnet only; no real funds, no seed phrases.
2. **Can I lose funds?** Not with this repo: it holds no wallet and signs nothing.
3. **What is devnet?** Solana's test network, where tokens are free and worth nothing. Writes for this series happen there only.
4. **Can I use this for a real strategy?** The code is a teaching sample. Results are simulated, on recorded data; not advice. Any real use is your own decision and responsibility.
5. **Will it make money?** We make no claims about returns. In the recorded run every sample strategy ended net negative or zero after costs.
6. **What if setup fails?** Pair with a neighbour or use a lead's laptop; the lab demos need no install. Do not spend more than a few minutes on it at the door.
7. **Where do I get help?** Ask a lead in the room, message on Telegram (t.me/travisim), or the program contact @Aaron_Solanki.
8. **Why recorded data by default?** It works offline, gives everyone the same numbers and never hits a rate limit.
9. **Did you use a book for this?** The design is inspired by ideas from Advances in Financial Machine Learning (chapter 1 on why finance projects fail, chapter 2.2 on data types). The four data families and the order-book style features are ours, not the book's. Mentioned here only; the slides carry no attributions.
10. **Is there a prize?** No. Do not promise or imply one.
