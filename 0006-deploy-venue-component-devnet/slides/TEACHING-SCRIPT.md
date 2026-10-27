# Teaching script: Workshop 3, Deploy a Trading Venue Component on Devnet

Presenter: Travis Sim. Thu 21 Jan 2027, 18:00-20:00. Lead-led. Voice: direct, conversational, short sentences. Each block is embedded as the speaker notes of that slide.
Timing: doors 17:45; welcome slides 1-4 at 18:00-18:10; teaching slides 5-25 at 18:10-18:50; demos 26-31 at 18:50-19:15; mini-lab 32 at 19:15-19:30; open build 19:30-19:55; takeaways and closing 33-38 at 19:55.
Say "data collection" and "recorded data". Say "simulated, not advice" for any result that is not real. No prizes, no profit claims.
Numbers on data slides are filled in from `demo-repo/code/out/*.json` when the deck is built. If the room is mostly beginners, skip slides 8 and 13 and go straight to the funding levels.
Book ideas (inspired by AFML 19.3 tick rule and Roll model, 19.5 VPIN) belong here in the notes only, never on the slides.

## Slide 1: Title
[18:00] Welcome back after the break, thanks for coming. I'm Travis. Tonight is Workshop 3. The first two workshops were about agents and data. Tonight we go to the other side: the venue the agent trades on. You will read a real order book, we will look at a tiny venue component that is deployed on devnet, and then you pick a starter and build. The headline for tonight is simple: leave with a program address and transaction links. If you have not run the setup, do it now while I talk, and wave if you are stuck.

## Slide 2: Where we are
[18:02] Quick progress circle. Build night 3 was in November: position sizing and the trade ledger. Then the break. Tonight is Workshop 3, the venue side. Next Thursday the twenty-eighth of January is build night 4, backtest validation and failure testing, so whatever you build tonight can be failure tested next week. Go round the room: one line each, what did you do over the break, and is your project still running? Do not worry if the answer is nothing. Then we start.

## Slide 3: Tonight
[18:08] Here is the shape of the night. Forty minutes of slides, about twenty-five minutes of live demos where you predict before I run anything, a fifteen minute mini-lab where you read one market and compute a spread by hand, then twenty-five minutes of open build, and a five minute push at the end. The slides are in this order on purpose: first the numbers you can get from an order book, then what belongs on-chain, then why sent is not confirmed, then the thing we deployed.

## Slide 4: Goal and rules
[18:09] The goal is on the slide: leave with a deployed program address and transaction links, and be able to explain one accepted case and one rejected case. The three rules matter more than the goal. Reads use public mainnet data. Every write goes to devnet only. Nobody here needs real funds. And keys: never paste a seed phrase anywhere, and keep key files out of git. Our repo ignores them, but check your own. Devnet SOL is free but the faucet is rate limited, so we have a plan for that on the funding slide.

## Slide 5: An order book
[18:10] An order book is everyone's standing offers sorted by price. Bids on the left: people who want to buy, with the highest price at the top. Asks on the right: people who want to sell, lowest price at the top. The best bid and best ask are the top of the book. A trade happens when someone is willing to cross the gap. This book is made up so the maths stays simple: the real ones come in a few slides. Ask the room: if you wanted to buy right now at once, which side of the book do you hit?

## Slide 6: Spread and depth
[18:13] Two numbers. Spread: best ask minus best bid. We usually quote it in basis points, a hundredth of a percent, divided by the mid price, so different markets can be compared. Depth: how much size is standing within a band around the mid, for example within fifty basis points. A narrow spread with deep depth is a cheap market to trade. A wide spread or thin depth means you pay to get in and pay again to get out. Both are standard order book measures. They are cheap to compute and an agent can use them as a filter: do not trade when the spread is above a limit.

## Slide 7: Imbalance and microprice
[18:16] Imbalance compares the size at the top of the book: bid size minus ask size, divided by the total. Between minus one and one. Positive means more buyers waiting than sellers. The microprice is a size-weighted mid: it leans toward the side that is thinner, because that side is about to get consumed. Both are fast signals and both are noisy, so we treat them as features for an agent to consider, not as a trading rule. Nothing here predicts returns on its own. You will see a real test of that later in the order flow demo.

## Slide 8: Order flow imbalance
[18:19] The measures so far look at one snapshot. Order flow imbalance looks at how the top of the book changed between two snapshots. If the best bid grew or moved up, that is buy pressure. If the best ask shrank or moved up, also buy pressure. The mirror cases are sell pressure. Add the changes up over a window and you have a flow measure. It is inspired by the order flow imbalance idea from Cont, Kukanov and Stoikov. The point for tonight is that you need the book at two moments, so you need a data collection run. That is why the demo has snapshots fifteen seconds apart.

## Slide 9: You must see the book
[18:22] Here is the link back to venues. Every measure so far needs the book: spread needs the best bid and ask, depth needs the ladder, order flow needs snapshots. If a venue hides its book you cannot compute any of this. On Solana the book of an on-chain venue is just an account anyone can read. That is a big part of why exchange builders matter: what they choose to publish decides what everyone else can measure. Keep this in mind when you design your own component.

## Slide 10: A real Phoenix ladder
[18:25] This is a real book. Phoenix is an on-chain order book on Solana, and this is the SOL/USDC market on mainnet, read straight from the market account and decoded by our own code, not by an SDK. We checked our decoder against the official SDK output on the same account, and the numbers match. Read the cards: best bid, best ask, spread in basis points, and the Orca price at the same moment for reference. Notice anything odd? The spread is very wide. Hold that thought, it is the next two slides. This is recorded data, captured on the date at the bottom. Reads only, no writes.

## Slide 11: Three markets
[18:28] Same decoder, three mainnet markets in the same minute: SOL/USDC, JitoSOL/SOL and mSOL/SOL, plus the two devnet markets for comparison. The spreads are hundreds or thousands of basis points. A thousand basis points is ten percent. That is not how a healthy market looks. The Phoenix markets we are reading here are the older legacy markets, and they are thin. Devnet is worse: one market has only an ask, the other is empty because its orders had expired. It is honest data, and the lesson is on the next slide.

## Slide 12: Thin books are the lesson
[18:31] A decoder that works is not the same as a market that is busy. In the eight minutes of data collection, the top five levels of the SOL/USDC book changed once. A feature like imbalance computed from a book that never moves is not information. So before you trust any book feature, check how often the top of the book changes, and compare the mid to an independent price such as Orca or Pyth. The right answer when a book is thin is not to hide it, it is to say so. The demo has a Live switch: if you turn it on you will see what the market is doing right now.

## Slide 13: Flow without a book
[18:33] When you cannot see a book you can still say something from trades. The tick rule labels each trade as a buy if the price went up from the previous trade, and a sell if it went down. The Roll model estimates the spread from how prices bounce back and forth. Both ideas are in the book Advances in Financial Machine Learning, chapter nineteen, section three. The number on the slide is from real Orca swaps. Careful with the story here: when we first ran this the tick rule agreed only thirty-nine percent of the time, which is worse than a coin flip. The cause was the recording: within one slot the swaps were stored in reverse. Once we put them back in order the agreement went to ninety-six percent. Lesson: check your data order before you trust a result.

## Slide 14: On-chain or off-chain
[18:36] The design question for any venue component: what goes on-chain? Put on-chain only what must be trusted by people who do not trust each other: who owns what, the rule that moves funds, and the record of what happened. Keep off-chain everything that is cheap to redo or that changes often: the strategy, charts, retries, monitoring. Our component keeps the matching rule and the record of fills on-chain, and everything that watches it off-chain. On-chain space and compute cost real money, so smaller is better.

## Slide 15: Sent is not confirmed
[18:38] A transaction passes through three commitment levels. Processed: a node has run it. Confirmed: a supermajority of validators voted for it. Finalized: it cannot be rolled back. Each step is slower and safer. The mistake to avoid is treating sent as done. Your wallet says sent, your code moves on, and then the transaction fails or is dropped. The rule for money: credit at the level your risk allows, and never before you know the transaction did not fail. For small devnet amounts, confirmed is fine. For large amounts, wait for finalized.

## Slide 16: Measured on devnet
[18:40] We measured it. Nine real devnet transactions, using websocket subscriptions to see the moment each level arrived. Median: processed in about a third of a second, confirmed in a bit over seven tenths of a second. On this devnet, confirmed and finalized arrived together, so you could not tell them apart. On a local validator, finalized took about seventeen seconds. So the gap can be large or invisible depending on the network. Do not hard-code a wait time. Subscribe, and credit when the level you chose arrives.

## Slide 17: The deposit watcher
[18:42] Starter number one, and a pattern you will see everywhere. A watcher subscribes to the logs of a vault address, and for each transaction it decides whether to credit. Our rule: credit at confirmed, only if the transaction did not fail. In the real devnet run there were three transfers to a fresh vault. Two succeeded and were credited. The third tried to send more than the sender held, it failed, and it was not credited. A watcher that only looks at the vault balance would miss the failed case entirely, and one that only looks at the log would credit it. Check the error field.

## Slide 18: The component
[18:44] Now the thing we deployed. mini_book is a limit order book in one account, 272 bytes: a header with a magic number, the next order id, the number of fills and the last price, then sixteen slots, each with an id, a side, a price and a quantity. Three instructions: init, place and cancel. Written in Rust with no libraries so the compiled program is about five and a half kilobytes, which keeps the devnet rent small. The warning on the slide matters: this is a teaching toy. It has no balances, no owners and no signer checks. It is not a venue.

## Slide 19: Matching rules
[18:46] Four rules. Price priority: the best price fills first. Time priority: at the same price the lowest order id, the oldest order, fills first. Maker price: a fill happens at the price of the order that was already resting. Leftovers rest: any quantity not filled joins the book. The example is from the real run: an ask for nine at ninety-nine arrives when bids of seven at one hundred and one and six at ninety-nine are resting. It fills two at one hundred and one first, because that is the better price for a seller, then six at ninety-nine, and the last one rests. Pause here and ask someone to predict before showing the demo later.

## Slide 20: The matching loop
[18:47] This is the core of the program, with comments stripped. A loop: find the best resting order that crosses, fill the smaller of what is left and what is resting, write a FILL line to the log, clear or reduce the resting order, repeat. When nothing crosses, whatever is left rests. The logs are the receipt: every order and every fill is a text line in the transaction logs, so an explorer shows exactly what happened. The same logic is also written in TypeScript against the same bytes, and a test checks that the two agree with what the chain actually did.

## Slide 21: Deployed on devnet
[18:48] Real addresses, all devnet. The program id, the slot it was deployed in, the size, the hash of the file, and the signature of the deploy transaction. We verified the on-chain bytes equal our built file by dumping the program back from the chain and comparing hashes. Be honest about the caveat on the slide: the faucet returned rate-limit errors all day, so the deployer was funded by a transfer from a leftover devnet test wallet. That is why you may need the same trick for your own keys. Open the explorer link on your laptop and look at the program account.

## Slide 22: Nine real transactions
[18:49] A scripted session against the deployed program: init, two asks, two bids, a bid that crosses, an ask that crosses two orders, a bad order, and a cancel. Nine transactions, each with a real signature and slot. Look at the compute units column: the init is cheap and the crossing orders cost more because they do more work. Total fees were fifty thousand lamports, 0.00005 SOL. Find the one that failed. We come back to it on the next slide.

## Slide 23: Rejected, and limits
[18:49] Step eight: a bid with quantity zero. The program returned custom error five. The book did not change, because the runtime discards every write of a failed transaction. But the fee was still charged. A rejected transaction is not free. On the right: what this toy does not do. No balances, no owners, no signer checks, and only sixteen orders. Real venues add all three. If a student asks why we did not add them, it is because each one is a lesson on its own, and a venue is a team project, not a workshop.

## Slide 24: The four starters
[18:51] Pick one. The deposit watcher is the gentlest: a ledger, commitment levels and failed transactions. The mini order book is for people who want to extend the Rust or the TypeScript mirror: a new order type, more tests. The Phoenix ladder reader is for anyone who wants a book feature for their agent: spread, depth, imbalance. The Orca whirlpool lab turns a sqrt price into a price and reads swaps, and it is the hardest. Every starter reads real data and writes devnet only. If you are not sure, take the one with the tier you are comfortable with.

## Slide 25: Three ways to take part
[18:53] Devnet SOL is the one thing we cannot guarantee. Level one: no SOL at all. You run the Phoenix reader and the Orca lab and all the recorded demos, and you can still finish the mini-lab. Level two: about three thousandths of a SOL, enough to run the deposit watcher and place orders on the book we deployed. Level three: about seven hundredths of a SOL, enough to deploy your own copy of the program. The faucet is rate limited. We will pre-fund throwaway keys for people who need them. Never send funds from a real wallet to a devnet key.

## Slide 26: Demo 1, order book ladder
[18:55] Demo one. Predict first: how wide is the spread on this market, in basis points? Take guesses from three people. Then open the ladder. You will see bids and asks as depth bars, with spread, depth bands and imbalance beside them. Move the slider to change the band, switch market with the buttons. The Live switch reads the account over the public RPC right now; if it fails three times in a row it falls back to recorded and says so. What to point out: the one-sided devnet market and the expired orders.

## Slide 27: Demo 2, matching step by step
[19:00] Demo two: orders matching one at a time. Predict first: when the ask at ninety-nine arrives, which resting order fills first? Then step through. On the left the book before and after, on the right the log lines the program wrote. Both the TypeScript engine and the on-chain program produced these lines, and they match. Step seven is the one to dwell on: the price priority. Step eight shows the rejected order. If someone asks, the Live mode here reads the real book account on devnet.

## Slide 28: Demo 3, devnet replay
[19:04] Demo three is an explorer-style replay of the nine real transactions. Predict first: which one fails and does it still cost a fee? Each row has the signature, the slot, the fee, the compute units and the processed, confirmed and finalized times. Click a row to see the logs. The signatures link to the Solana explorer, so you can open the real thing. Live mode reads the signatures of the deployed program from devnet, so anything people send to our book while we talk shows up.

## Slide 29: Demo 4, deposit flow
[19:08] Demo four: a deposit travelling from wallet to vault to ledger, with sent and confirmed as two stages. Predict first: at which stage should the ledger credit, and what happens if the transaction failed? Use the toggle to fail a deposit and see the ledger refuse to credit it. This is the watcher from the starter, drawn out. Live mode watches the vault we used and shows the real devnet slots.

## Slide 30: Demo 5, order flow imbalance
[19:11] Demo five goes back to the question from the start. Real Orca swaps, grouped into one-minute windows, each with a buy volume, a sell volume and an imbalance. Predict first: does the imbalance in one minute say anything about the next? The numbers say: it correlates with the return in the same window, but almost not at all with the next one. That is the honest answer. A feature that explains the minute that just happened is not a prediction. This is recorded data, simulated and not advice.

## Slide 31: Try the demos yourself
[19:14] Scan the code or type the address. No install: the five demos open in a browser, recorded by default. The same files are in the repo and open from disk if the Wi-Fi is bad. Switch Live on to see real Solana data. If Live fails, the demo falls back to recorded by itself. Take one minute now to open demo one on your laptop. Then we start the mini-lab.

## Slide 32: Mini-lab
[19:15] Fifteen minutes. Four steps. Read: open the ladder demo and pick a market. By hand: take the best ask minus the best bid, divide by the mid, multiply by ten thousand. In code: run the ladder command and compare. Pick a starter and start extending it. You are done with the lab when your hand number and your code number agree. If they differ, find out why: the usual cause is a rounding or using the wrong price units. Leads rotate and help.

## Slide 33: Takeaways
[19:55] Three things. Spread, depth and imbalance all come from seeing the book. Put on-chain only what must be trusted. Sent is not confirmed: credit at the level your risk allows. Two questions for the discussion, or take them home. What does the on-chain component add for this user? Does a successful transaction prove the project did the right thing? My answer to the second is no: a transaction can succeed and still do the wrong thing, and that is exactly what next week's failure testing is for.

## Slide 34: Branch out
[19:56] Three ways to go further, by level. Beginner: run the deposit watcher against a second kind of failure, for example a transfer to the wrong address. Standard: add a new order type to mini_book with a test, such as an order that only rests and never fills. Advanced: add an owner and a signer check to the program, so only the owner can cancel an order. Pick one, write it down, and bring it to the next session.

## Slide 35: Share back
[19:57] Share back so we can learn from each other and so I can report the session. By tonight: push your code and paste your program address in the group. Within forty-eight hours: post your transaction links and one lesson learned. Next session: bring it to build night 4 for failure testing. Do not paste any key or seed phrase, ever. Addresses and signatures are public and safe to share.

## Slide 36: Get the code
[19:58] Everything from tonight is in one public repo: the demos, the sample code, the program source and the recorded data. Scan the code or type the address. Then three commands from the code folder: install, test, run the demo with the recorded flag. The recorded flag is the default so it works offline. Writes are devnet only. The folder is the one on the slide, and the program's README explains how to build and deploy your own copy.

## Slide 37: Let's connect
[19:59] If you want to follow up, ask a question, or share what you built, here are LinkedIn and Telegram. Scan either one. Thanks everyone. Push your code before you leave, and I will see you at build night 4 next Thursday.

## Slide 38: Solana
[20:00] End of session. Leave this slide up while people pack up. Remind everyone to submit the post-workshop feedback form and that the report goes out within forty-eight hours, so by Thursday the twenty-first of January.
