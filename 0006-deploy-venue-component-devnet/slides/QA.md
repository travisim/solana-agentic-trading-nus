# Q&A prep: Workshop 3, Deploy a Trading Venue Component on Devnet

For Travis and the leads to answer questions while presenting. Grouped by slide and demo. Slide numbers refer to the 38-slide deck. Answers are written to be said aloud.

Facts come from `demo-repo/code/out/` and `recorded/` (Phoenix capture 21 Oct 2026 19:49:58 UTC, 32 snapshots 15 s apart; devnet session 21 Oct 2026 20:10:50 UTC; deposits 20:01 UTC). **Re-check after any re-recording or redeploy.**
- Phoenix mainnet SOL/USDC `4DoNfFBf...`: best bid 100.000, best ask 117.999, spread 1,651 bps (16.5%), Orca at the same moment 108.22; 1,297 bids and 336 asks in the account; top five levels changed once in about 8 minutes. JitoSOL/SOL 215 bps, mSOL/SOL 4,527 bps. Devnet SOL/USDC: no bids, 9 asks (3 expired); devnet wSOL/USDC: empty (2 expired).
- Flow: 2,900 recorded Orca swaps, 144 dust and 5 outliers dropped, 2,751 kept, 43 one-minute windows. Tick rule right on 95.7% (2,633 of 2,750) in execution order, 38.9% (1,071) in file order. Roll spread 4.33 bps. Imbalance versus same-window return correlation 0.46, versus next window 0.06.
- Devnet: program `UQLHxoX7P4RV4sPV9mS4DFmXD1a6pi1qSkh2vjEWwrL`, deployed at slot 513,637,896, 5,528 bytes, SHA-256 `866aef36...c131bcb2`; book account `51oS5WH5...FdA`; 9 transactions (1 failed on purpose, custom error 5), fees 50,000 lamports in total (5,000 per transaction, 10,000 for the init which has two signatures). Median processed 319 ms, confirmed 712 ms, finalized 712 ms; local validator 300 ms, 331 ms, about 17 s.
- Deposits: 1,000,000 and 1,500,000 lamports credited at confirmed; a deposit of 1,065,964,000 lamports (more than the sender held) failed and was not credited.

Rules in every answer: reads use public mainnet data; every write is devnet only; no real funds. Results on recorded data are simulated or computed, not advice. No prizes, no returns promises.

---

## Slides 1-4: Title, where we are, tonight, goal and rules

**Q: Do I need SOL or a wallet?** No. Level 1 needs nothing: read books, run tests, replay recorded devnet, finish the mini-lab. Level 2 needs about 0.003 devnet SOL and level 3 about 0.07, both from the leads. Devnet SOL has no value.

**Q: Why can't I just use the faucet?** You can try, but the public faucet is rate limited and returned HTTP 429 to every request when we prepared this. That is why leads pre-fund throwaway keys. If it works for you, great.

**Q: Is devnet real money?** No. Devnet is a public test network. Its SOL is free and worthless; tokens there are test tokens.

**Q: Where do I keep my key?** Outside the repo, for example `~/.config/solana-nus-workshop/`. Never paste a seed phrase or key anywhere. Share only the public address. If you want to hold real funds, use a different wallet entirely.

## Slide 5: An order book

**Q: What is an order book?** A list of standing orders: bids to buy and asks to sell, sorted by price. The best bid and best ask are the top of the book.

**Q: Why are there so many bids and asks at different prices?** Each is someone's limit order: "buy up to X at this price". They wait until somebody trades with them.

**Q: Is every Solana exchange an order book?** No. Orca uses a pool and a price curve (an AMM). Phoenix and the Drift order book use order books. Different designs make different things visible.

## Slide 6: Spread and depth

**Q: What is a basis point?** A hundredth of a percent. 100 bps is 1%. On the slide a $0.20 spread on a $100.00 mid is 20 bps.

**Q: Which band do you use for depth?** In the demo you choose (25 to 1,000 bps). On the slide it is 25 bps around the mid: 10 on the bid side and 7 on the ask side.

**Q: Is a narrow spread always good?** It means cheap to trade right now. It says nothing about how much you can trade: check depth too. If they push: a narrow spread on thin depth moves fast when you trade.

## Slide 7: Imbalance and microprice

**Q: Does positive imbalance mean the price will go up?** Not by itself. It says buyers are waiting in larger size at the top. Studies suggest a short-term link, but it is weak and noisy; demo 5 tests it on real data and finds almost nothing for the next minute.

**Q: Why does the microprice lean toward the thinner side?** If the ask is small it is about to be eaten, so the next price is more likely at or above the ask. The formula weights each price by the size on the other side.

## Slide 8: Order flow imbalance

**Q: How is this different from imbalance?** Imbalance is one snapshot. Order flow imbalance is the change between two snapshots: did the buyers add or the sellers pull back. It needs data collection over time.

**Q: Where does the idea come from?** It is the order flow imbalance idea of Cont, Kukanov and Stoikov. Our demo uses a simplified top-of-book version. (Book note, not for slides: the tick rule and Roll model are in AFML 19.3 and VPIN in 19.5; the order-book features here are ours.)

**Q: Why did the demo show mostly zeros on SOL/USDC?** The book barely changed in 8 minutes: that is the thin-book lesson.

## Slide 9: You can only compute it if you can see the book

**Q: Why do exchange builders matter for an agent builder?** The agent can only use what the venue exposes. Whether the book is a readable account, how fresh it is, and whether failed orders are visible all shape what you can build.

**Q: Can I see any Solana order book?** If it is an on-chain program with public accounts, yes: read the account and decode it. Some venues keep matching off-chain and only post results.

## Slides 10-12: Real ladder, three markets, thin books

**Q: Why is the spread 16.5%? Is the decoder wrong?** No: we checked it against the official Phoenix SDK output on the same account bytes. This is Phoenix v1 ("Legacy"), whose mainnet SOL/USDC book is thin. Best bid 100.000 and best ask 117.999 against Orca at 108.22.

**Q: So can I trade there?** Not sensibly. Spread and depth tell you the market is not usable for size; that is the point of the measure.

**Q: What are expired orders?** Phoenix orders can carry an expiry. They stay in the account after expiring but cannot fill. We drop them. The devnet wSOL/USDC book is empty for that reason (2 expired).

**Q: Why is devnet one-sided?** People place test orders and leave. Devnet markets have test tokens and no market makers.

**Q: What does "mid" mean on a one-sided book?** There is none. The demo shows the one side and says so rather than inventing a number.

*What this does not show:* a healthy market. Only thin legacy books and devnet test books were captured. The live switch shows what the book looks like now; it may differ from the slides.

## Slide 13: Flow without a book

**Q: What is the tick rule?** Label a trade a buy if its price is above the previous trade, a sell if below, and repeat the last label if equal. 95.7% of 2,750 swaps agreed with the recorded side.

**Q: What was the 39% problem?** The recorded file lists swaps oldest first by slot, but reversed inside each slot. With that order the rule agreed only 38.9% of the time (1,071 of 2,750). After putting each slot's swaps back in execution order it was 95.7%. It is a bug in how Build night 2's recording was ordered, not in the rule. Lesson: check your data order.

**Q: What is the Roll spread?** An estimate of the spread from price bounces: negative serial covariance in price changes implies a bid-ask bounce. Here 4.33 bps on Orca swaps. It is rough.

**Q: Why drop dust and outliers?** 144 swaps under 0.01 SOL (rounding noise in the price) and 5 more than 1% from the median (multi-leg transactions). The original file is unchanged.

## Slide 14: On-chain or off-chain

**Q: Why not put everything on-chain?** Cost, speed and privacy. Every byte stored costs rent, every instruction costs compute. Put on-chain only what strangers must trust.

**Q: What is on-chain in our component?** The book state and the matching rule, with each fill logged. Strategy, monitoring and charts are off-chain.

## Slide 15-16: Sent is not confirmed; measured

**Q: What are processed, confirmed and finalized?** Processed: a node ran the transaction. Confirmed: a supermajority of stake voted for the block. Finalized: it is rooted and cannot be rolled back.

**Q: Which should I use?** Reads for display: confirmed. Crediting money: confirmed for small amounts, finalized for large. Whichever you choose, never credit before you know it did not fail.

**Q: Why were confirmed and finalized the same on devnet?** On this devnet today the notifications arrived together (median 712 ms). On the local validator finalized took about 17 s. Do not hard-code a wait; subscribe.

**Q: How did you measure it?** A websocket `signatureSubscribe` per level, timed from the moment the transaction was sent, 9 transactions.

## Slide 17: Deposit watcher

**Q: Why not just check the balance?** A balance check misses failed transactions and cannot say which deposit it was. Watching logs by signature lets you credit each deposit once and skip failures.

**Q: What does the failing deposit prove?** It tried to send 1,065,964,000 lamports from a wallet that did not hold that much; the transaction failed on-chain, was never credited, and still paid a fee.

## Slide 18-20: mini_book, rules, loop

**Q: Why Rust with no libraries?** Size. The usual framework makes a program of 12 KB or more; ours is 5,528 bytes, which keeps devnet rent small (rent is per byte, twice during deploy).

**Q: Why only 16 orders?** One small account and a linear scan keep the code readable. Real venues use trees (Phoenix uses red-black trees) and many accounts.

**Q: Can anyone cancel my order?** Yes. There are no owners and no signer checks. That is the "advanced" branch-out.

**Q: Why is there no balance or token transfer?** Because that is where the real complexity is. The toy shows matching and logs only.

**Q: Fill price?** The resting (maker) order's price. In step 7 the ask at 99 fills against the bid at 101 first at 101.

## Slide 21-22: Deployed, nine transactions

**Q: How do I know it is really on devnet?** Open the program address in the Solana explorer with `?cluster=devnet`. We also dumped the program from the chain and compared its SHA-256 with our build: equal.

**Q: Who paid?** A locally generated deployer key outside the repo, funded by a 63,444,000 lamport transfer from a leftover devnet test wallet, because the faucet returned 429.

**Q: What did it cost?** The 9 transactions cost 50,000 lamports in fees. The book account holds 2,032,000 lamports of rent. The program needs rent for 5,528 bytes (and a buffer during deploy).

**Q: Can the program be changed?** Yes: the deployer is the upgrade authority. Real programs often freeze or hand that to a multisig (Squads).

## Slide 23: Rejected and limits

**Q: Did the rejected order change the book?** No. A failed transaction's writes are discarded. It still paid the 5,000 lamport fee and used 141 compute units.

**Q: Is it safe to deploy?** On devnet yes. Never deploy the toy on mainnet.

## Slides 24-25: Starters, funding

**Q: Which starter?** Beginner: deposit watcher. Standard: mini order book or Phoenix ladder reader. Advanced: Orca whirlpool lab. If unsure, deposit watcher, or the ladder reader if you have no SOL.

**Q: I have no SOL, can I still finish?** Yes: the ladder reader and Orca lab need none.

## Demo 1: Order book ladder (slide 26)

**Q: What am I looking at?** Price levels with depth bars, bids and asks, and measures beside them: spread, depth bands, imbalance, microprice, and the cost of walking the book for a size.

**Q: What does Live do?** Reads the current Phoenix market account over `solana-rpc.publicnode.com` and the Orca price, redraws the ladder. After three failed reads in a row it falls back to recorded and shows a pill.

*What this does not show:* healthy liquidity; only thin books. Live data may be empty or one-sided.

## Demo 2: Matching step by step (slide 27)

**Q: Is this the real program?** Two things run: the real devnet logs are shown from the recorded session, and a JavaScript port of the same engine runs in your browser on the same bytes. A test checks both agree on every step and on the final account bytes. Your own orders in the demo are simulated in the browser; nothing is sent.

**Q: What does Live do?** Reads the real book account on devnet and shows its decoded orders.

*What this does not show:* signatures, balances, fees on your own orders, or what two users racing would do.

## Demo 3: Devnet replay (slide 28)

**Q: Are these real signatures?** Yes. Each links to the explorer. Times come from a websocket subscription at each commitment level.

**Q: What does Live do?** Lists the latest signatures of the program on devnet; anything sent to our program while you watch will show.

*What this does not show:* a congested network; devnet here was quiet.

## Demo 4: Deposit flow (slide 29)

**Q: What can I change?** At which commitment level the ledger credits, and whether the transaction fails. Credit at processed and the failing deposit gets credited by mistake; the demo marks that.

**Q: What does Live do?** Shows the real devnet slot at processed, confirmed and finalized right now.

*What this does not show:* a reorg or a dropped transaction.

## Demo 5: Order flow imbalance (slide 30)

**Q: What does the correlation 0.46 mean?** Within a minute, more net buying goes with a higher price move: expected, partly mechanical. 0.06 for the next minute: almost nothing to predict with.

**Q: What does Live do?** Reads new Orca swaps over RPC and appends them to the windows. Simulated or recorded results are not advice.

*What this does not show:* costs, slippage or a strategy.

## Live mode, in plain words

Students see a pill: LIVE, the last update time, the slot or source. If the RPC is slow or rate limits, it retries once, and after three failures in a row it goes back to Recorded and says so. Only the presenter runs Live; the campus shares one IP. Slot: the chain's clock tick, about every 0.4 s. Basis points: hundredths of a percent. Commitment: how sure the network is. Lamport: one billionth of a SOL.

## General questions

**Is this real money?** No. Reads are public mainnet data; writes are devnet only.

**Can I lose funds?** Not in this workshop: no real wallet, no mainnet writes.

**Can I use this for a real strategy?** No. The program is a toy; the demos run on recorded data. Nothing here is advice and nothing promises returns.

**What if setup fails?** Pair up, use the lab HTML (open from disk), tell a lead. Note the blocker for the report.

**Where do I get help later?** The repo's `code/README.md`, the Q&A in the slides folder, the lead in the program group chat, and Telegram `t.me/travisim`.

**Is Phoenix still the right venue to learn from?** It is the on-chain order book with a public SDK and readable accounts, which is why we use it; the legacy markets are thin, and newer venues exist. Check current status before building on it.
