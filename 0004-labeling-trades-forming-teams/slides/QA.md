# Q&A prep: Workshop 2, Labeling Trades and Forming Teams

For Travis (and the leads) to answer questions while presenting. Grouped by slide number and demo; slide numbers refer to the 39-slide deck. Answers are written to be said aloud. Book ideas may be named here (never on slides): the triple barrier and meta-labeling are inspired by *Advances in Financial Machine Learning* chapter 3, overlap and purging by chapters 4 and 7; the code and several details (the volatility estimate, the width formula, the logistic gate, the checker) are ours.

Facts come from `demo-repo/code/out/` (recorded run, same as `npm run demo -- --recorded`) and `recorded/SOURCES.md`. **Re-check after any re-recording.**
- Data: 481 samples every 5 s, 40 minutes, Wed 21 Oct 2026 17:14 to 17:54 UTC (Thu 22 Oct 01:14 to 01:54 Singapore time), Orca SOL/USDC pool price (default), Pyth oracle and Jupiter quote recorded at the same time (collected in build night 1). Price range on the Orca path 107.99 to 108.68.
- Labels (Orca path, width 0.8 x noise x sqrt(24 steps), floor 2 bps, a decision every 2 steps): 219 decisions (11 dropped at the end); 118 upper (54%), 56 lower (26%), 45 time (21%); average width 3.36 bps; average hold 13.43 steps; a plain "sign after 24 steps" label disagrees on 57 (26%). Labels on the Pyth path agree with these on 61.2%, on the Jupiter path 67.1%.
- Three paths, same agent: Pyth 86 / 45 / 88, width 7.42 bps, 67 trades, hit rate 14.9%; Jupiter 94 / 58 / 67, 7.22 bps, 75 trades, 32%; Orca 118 / 56 / 45, 3.36 bps, 143 trades, 51%.
- Overlap: on average 6.947 labels alive at once (max 13); average uniqueness 0.1563; effective independent labels 34.2 of 219; cut at step 282 (60% of the labels): 9 training labels cross it.
- Agent (momentum, 12-step look-back, acts at 1x noise): 219 decisions, 143 trades, 76 holds; 73 wins, 43 losses, 27 timed out; hit rate 51%. 43 reasons given one simulated wrong claim (seed 7, 20%); checker caught 43, missed 0, 0 false alarms. Hit rate with a true reason 51.3% (113 trades), with a wrong claim 50% (30 trades). Round trip about 8 bps; 0 of the 73 wins had a barrier at least 8 bps wide.
- Gate: 82 training trades, 6 purged, 55 test trades; default threshold 0.5244 (training win rate 52.4%). Test: no gate 55 trades, 45.5% (+/- 13.2); with gate 47 trades, 48.9% (+/- 14.3); 8 blocked, 2 of them would have won. Gate fitted without purging: 49 trades, 46.9% (+/- 14). Learned weights: signal strength +0.01, venue gap -0.33, volatility -0.95.
- Devnet: three Memo transactions dry-run with simulateTransaction: err null, 44,922 to 45,286 compute units; **not sent** (faucet answered 429).

Rules for every answer: reads use public mainnet data; every write is devnet only; no real funds. Results are simulated, on recorded data, gross of fees, not advice. No prizes, no promises about returns.

---

## Slides 1-3: Title, where we are, tonight
**Q: Do I need the earlier sessions?** No. Everything tonight runs on recorded data and starts from scratch; the earlier sessions collected the data we reuse.
**Q: Do I need AI credits, a wallet or an API key?** No. The agent is an offline rule, the demos run in the browser, the code runs with `--recorded`.
**Q: What do we leave with?** A lane, a team or a solo plan, and a one-page brief with three first tasks.
**Q: Can I work alone?** Yes. A solo builder gets a lane and a brief too; we pair for reviews on 12 Nov.

## Slide 4: A decision needs a checkable outcome
**Q: What is a basis point?** One hundredth of a percent. 6 bps is 0.06%.
**Q: Why not just look at profit and loss?** You can, but P&L mixes the decision with sizing, fees and luck. A label judges one decision on one rule you can state.
**Q: What does "label" mean here?** A result attached to a decision: +1 it hit the profit target first, -1 it hit the stop first, 0 neither before time ran out.
**What this slide does not show:** any data; it is an illustration.

## Slide 5: Fixed-time labels are crude
**Q: Is path A real?** No, both paths are illustrations. The real number is on slide 11: a fixed-time label disagrees with the barrier label on 57 of 219 decisions (26%).
**Q: Is a fixed-time label wrong?** Not wrong, crude: it ignores the path. If you really hold for exactly N steps with no stop, it is the right label.
*If they push:* the triple barrier assumes you act on a stop and a target; if your agent does not, label the way it behaves.

## Slides 6-8: The triple barrier
**Q: Why the same distance above and below?** To keep one number to explain. You can use a wider target than stop; try it as a branch-out.
**Q: What if the price jumps over a wall between two samples?** We only see a sample every 5 seconds, so a touch between samples is not seen. The first sample at or beyond the wall decides.
**Q: Why is zero a label?** It says "nothing clear happened". On the real data 45 of 219 decisions (21%) time out.
**Q: Where does this come from?** It is inspired by the triple-barrier method in the book (chapter 3); here it is plain code you can read in `labels.ts`.

## Slide 9: Barrier width follows the noise
**Q: What is "noise"?** The exponentially weighted standard deviation of the one-step price changes, in bps. For the example decision it was 0.92 bps per step.
**Q: Why the square root of the number of steps?** If steps are independent, uncertainty grows with the square root of time, not linearly. It is a simple model; real prices are not exactly like that.
**Q: What is the floor for?** A flat stretch has almost no noise; without a floor the walls would sit on the price. We use 2 bps.
**Q: Why 0.8?** It is a setting, not a law. Demo 1 lets you move it; on this data 0.8 gives about 21% time-outs and 1.6 gives many more.

## Slide 10: A win has to beat the cost
**Q: What does the Orca pool charge?** The pool fee is 0.04% each way (recorded in `recorded/SOURCES.md`), so about 8 bps for a round trip, before slippage and network fees.
**Q: So is the agent useless?** On this data and these widths, no win was wide enough to pay the fee, so the labels do not show a tradable edge. That is the point of the slide: label with widths that match your costs.
**Q: What should I set the floor to?** At least your round-trip cost; try `--min-width-bps 8`. On the recorded data that leaves 34 wins, every one wide enough to pay the 8 bps, but the hit rate falls to 23.8% with 96 of 143 trades timing out: honest labels are harder to win.
**What this slide does not show:** slippage or network fees, which make it worse.

## Slide 11: Real labels
**Q: Why are there more +1 than -1?** The price drifted up about 0.6% in the window (107.99 to 108.68), so upper barriers were touched more. One calm night; do not generalise.
**Q: Why a decision every 10 seconds?** A setting (every 2 steps of 5 seconds). It makes labels overlap, which is the next topic.
**Q: Is this live data?** Recorded: 21 Oct 2026, 17:14 to 17:54 UTC. Demos have a Live switch that reads fresh prices.

## Slide 12: Labels depend on the price path
**Q: Why does the same agent score 51%, 32% and 14.9%?** The three paths differ. Pyth updates about every 10 seconds, so its path is stair-steps and a momentum rule sees stale moves; the Jupiter quote includes routing noise; the Orca pool price moves smoothly. The agent follows moves, and smooth paths make moves easier to follow.
**Q: Which one is right?** The one your agent really sees and trades against. Label on that.
**Q: Does 51% mean it makes money?** No: gross of fees, one calm window, and see slide 10.
**What this slide does not show:** that Orca is better; only that labels depend on the path.

## Slide 13: The labeler in code
**Q: Can I label my own strategy?** Yes: call `labelAt(prices, times, vol, i, params)` for each decision step i.
**Q: Why return null at the end?** A decision whose time limit runs past the data has no label yet. Guessing would leak the future.
**Q: Do I need TypeScript experience?** No; Node 24 runs the `.ts` files directly and the file has no libraries.

## Slides 14-16: Overlap, leak, real numbers
**Q: What is overlap, in one sentence?** Two labels made 10 seconds apart both look at almost the same next 2 minutes, so they are nearly the same fact.
**Q: What is "uniqueness"?** For one label, the average of 1/(labels alive) over its life. 0.16 means 84% of its life is shared.
**Q: So is 219 labels useless?** No, but they carry about 34 labels' worth of independent information. That matters for how much you can trust a hit rate.
**Q: What is leakage?** Information from the test period getting into training. A training label decided just before the cut can be decided by prices after it. 9 labels cross the cut at step 282.
**Q: What is purging, and an embargo?** Purging drops those 9 training labels. An embargo also drops a few steps after a test block when the test sits in the middle; we only cut once so we only purge.
*If they push:* our uniqueness and purge code are simple versions inspired by the book (chapters 4 and 7), not the book's full method.

## Slide 17: A second opinion
**Q: Why not just make the first agent better?** A second check is simpler to test: it answers one yes-or-no question ("will this trade win?") on features, and you can see what it blocked.
**Q: What features does it use?** Signal strength (move over noise), the Orca-Pyth gap in bps, and recent volatility.
**Q: Is it deep learning?** No: a three-weight logistic regression written out in `meta.ts`, trained with plain gradient descent, repeatable.

## Slide 18: The pretend agent writes reasons
**Q: Is this an LLM?** No. It is a rule that writes sentences from a template, so nobody needs credits. It stands in for an LLM.
**Q: Can the checker grade a real LLM?** It parses plain text with three patterns (rose/fell, "N bps in the last", "Nx the recent noise", "within N bps"). If your LLM writes in that format it works; otherwise adapt `parseReason`.
**Q: Why inject wrong claims?** To test the checker. They are simulated, fixed seed 7, 20% of reasons, flagged `injected` in `out/agent.json`.
**What this slide does not show:** that a real LLM's mistakes look like ours.

## Slide 19: Grade the reasons, then the result
**Q: 43 of 43 caught: is the checker perfect?** No: we made the errors, so they are easy. A real agent will make subtler ones.
**Q: Why does a true reason not win more?** The reason only says what the agent saw, not what the market will do next. 51.3% with true reasons (113 trades) against 50% with a wrong claim (30 trades): no meaningful difference.
**Q: Then why check reasons?** To find agents that misread their own data, which is a bug you can fix, and to stop a nice story hiding a bad trade.

## Slide 20: The gate on the test period
**Q: Did the gate help?** Not provably. 48.9% (+/- 14.3) with the gate against 45.5% (+/- 13.2) without: the ranges overlap heavily. 8 trades were blocked and 2 of them would have won.
**Q: What does "+/-" mean?** A rough 95% range for a hit rate from n trades: 1.96 x sqrt(p(1-p)/n). With 55 trades it is about 13 points wide.
**Q: What did it learn?** To avoid high volatility (weight -0.95) and a wide venue gap (-0.33); signal strength barely mattered (+0.01).
**Q: Why default threshold 0.5244?** It is the win rate of the training trades (52.4%): act only when the odds beat the average trade.
**Q: What does fitting without purging do?** It leaves 6 leaking trades in training; test hit rate was 46.9% (+/- 14) on 49 trades: a small difference here, a bigger risk in general.

## Slide 21: An on-chain record
**Q: What did you actually verify on devnet?** Three Memo transactions built by hand were accepted by devnet's `simulateTransaction`: err null, and the Memo program logged our exact text. A dry run, nothing was sent.
**Q: Why not send them?** The public devnet faucet answered HTTP 429 for our throwaway key and we had no funded key. A lead can fund one; then `npm run memo -- --send`.
**Q: What is the hash `h`?** The first 16 hex characters of the sha256 of the decision's record in `out/agent.json`, so anyone can recompute it.
**Q: Is this real money?** No: devnet SOL has no value.

## Slides 22-24: Lanes, starters, brief
**Q: Which lane is best?** The one where you can name a user, a failure and a first test. Agent suits people who like judging decisions, exchange people who like plumbing, tooling people who like making things others use.
**Q: Are the starters required?** No; they are suggestions from our research notes. Bring your own idea.
**Q: What are the exchange starters?** A deposit watcher (a real 0.021 SOL devnet transfer was credited about a second after it confirmed in testing), a 390-line mini order book (10 fixture orders give exactly 5 trades), an Orca Whirlpool devnet lab, and Phoenix source reading (MIT licence since May 2026, use current master only).
**Q: Do I need devnet SOL?** Only for writes. The public faucet is rate-limited; leads hand out SOL from a pre-funded pool.
**Q: What if I am a beginner?** Tests, reproduction steps, documentation, design and user feedback are real contributions.
**Q: How is the project judged?** On utility, tests, devnet evidence and a clear explanation, never on simulated returns. No prizes or funding are promised.

## Slide 25: Team matching
**Q: How do I choose a team?** Pitch a problem with evidence, note a first and second choice, share what you bring and want to learn, then agree a provisional team of 3 to 4.
**Q: Can teams change?** Yes, by agreement; we re-check on Thu 12 Nov and Thu 21 Jan.
**Q: What if nobody picks my problem?** Join another, or work solo with a brief; the lead will pair you for reviews.

## Slides 26-30: Demos (see the demo sections below)

## Slide 31: Try the demos yourself
**Q: Do I need to install anything?** No, they run in a browser; the same files are in the repo.
**Q: Why not everyone on Live?** All students share one campus connection, so public endpoints rate-limit (Jupiter answers 429 after about one call). Recorded is the default.

## Slides 32-33: Mini-lab and build menu
**Q: How do I label by hand?** Walk the next 24 prices; +1 if one reaches the upper barrier first, -1 for the lower, 0 if neither does. The key is `out/minilab-answers.md`.
**Q: What if my team disagrees?** Good: find the price where you differ and say why.
**Q: What can I build without AI credits?** Every item on slide 33; hand-edit a setting and rerun.

## Slides 34-39: Closing
**Q: Where is the code?** `github.com/travisim/solana-agentic-trading-nus`, folder `0004-labeling-trades-forming-teams`.
**Q: What do I do before next week?** Post your brief by Fri 6 Nov and bring your first task to Build night 3 on Thu 12 Nov.

---

## Demo 1: Triple barrier (`01-triple-barrier.html`)
**Q: What do the sliders do?** Width scales the walls (0.2 to 3 x noise); Time limit is the vertical wall in steps; Decide every sets decision spacing; Width floor sets the minimum in bps; Decision picks the one drawn in the zoom.
**Q: Why does doubling the width change the counts?** Wider walls are touched less, so more decisions time out (label 0).
**Q: Why does the average width show a warning?** When it is below 8 bps, a "win" still loses money after the pool fee.
**What this demo does not show:** fees, slippage, or what happens between samples.
**Live:** the browser reads the Orca pool and Pyth accounts every 5 s (public RPC) and labels them with a shorter volatility window (8 steps) and a 12-step limit; open decisions are grey rings until a wall is touched or the limit passes. If slow: say so and go back to Recorded.

## Demo 2: Overlap and leakage (`02-overlap-leakage.html`)
**Q: What are the red lines?** Labels decided before the cut that end after it. At the defaults there are 9.
**Q: What does Purge do?** Greys them out: they would be dropped from training.
**Q: What happens if I raise the time limit?** Labels live longer, more are alive at once, and more cross the cut.
**What this demo does not show:** a model; it only counts overlap and leakage.
**Live:** the same functions on the live path; the cut sits at 60% of the path.

## Demo 3: Agent report card (`03-agent-report-card.html`)
**Q: What does Wrong reasons do?** It sets how many reasons get one simulated wrong claim; the checker must catch them.
**Q: What does Act above do?** The minimum move-over-noise before the agent trades; higher means fewer trades.
**Q: What is the amber ring?** The checker found a claim that contradicts the data.
**What this demo does not show:** real LLM errors; ours are made up with a fixed seed.
**Live:** each new decision is written and checked from live Orca and Pyth reads; outcomes stay pending until a barrier is touched. In a calm minute the agent mostly holds.

## Demo 4: Meta gate (`04-meta-gate.html`)
**Q: What is the dashed line?** Your threshold: trades whose estimated chance of winning is below it are blocked (struck through).
**Q: Why does the training period look better?** The gate learned from those trades; only the test period is a fair score.
**Q: What do the faint dots mean?** Trades purged for crossing the cut.
**What this demo does not show:** that the gate helps: the +/- ranges overlap.
**Live:** new decisions are scored with the same weights; volatility uses a shorter window so the estimates are indicative.

## Demo 5: Lane and team picker (`05-lane-team-picker.html`)
**Q: Are the teammates real?** No: the example cards are invented for the demo and labelled as such.
**Q: Is my card saved?** In your browser only (local storage); copy or download the brief to keep it.
**Q: What does "Add a market reading" do?** Adds the recorded Orca and Pyth prices to the brief, or the live ones when Live is on.
**What this demo does not show:** a real matching algorithm; the fit score is a simple count.

## Live mode, in plain words
- **What students will see:** a pill with LIVE, the time, the Solana slot and a Jupiter quote or "Jupiter throttled".
- **Slot:** the chain's clock; one slot is about 0.4 seconds.
- **Oracle:** Pyth's price account on chain; it updates about every 10 seconds, so it can lag.
- **If an endpoint is slow or rate limited:** the demo retries once, then after three failures in a row falls back to Recorded with a red pill; say "that is the public endpoint, we are back on recorded data".
- **Never:** run Live on every laptop at once; the room shares one connection.

## General questions
**Q: Is this real money? Can I lose funds?** No. Reads use public mainnet data; every write is devnet only, with test SOL that has no value.
**Q: What is devnet?** A practice Solana network with free test tokens.
**Q: Can I use this for a real strategy?** No. It is a teaching sample on one 40-minute window, gross of fees. Do not trade on it.
**Q: What do I do if setup fails?** Pair with a neighbour and use the demos in the browser; ask a lead; recorded data needs no network.
**Q: Where do I get help?** Leads in the room; Telegram @Aaron_Solanki for program questions; Travis on t.me/travisim.
**Q: Are there prizes?** Nothing is promised; do not assume any.
