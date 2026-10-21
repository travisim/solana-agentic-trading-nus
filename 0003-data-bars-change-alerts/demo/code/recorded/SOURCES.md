# Recorded data: sources and limits (Build night 2)

Everything in this folder is real data captured by `npm run collect` (`src/collect.ts`). Nothing in `swaps.json` or `pyth-reads.json` is simulated or edited by hand. The one simulation (the frozen Pyth feed) is created later by `src/staleness.ts` and written to `out/staleness.json`, where it is labelled `simulated`.

## Files and capture

| File | What | Captured |
|---|---|---|
| `swaps.json` | 2,900 real Orca SOL/USDC swaps (oldest first): block time, slot, side, SOL and USDC amounts, price, transaction signature | Wed 21 Oct 2026, recording ran 18:25 to 19:05 UTC (= Thu 22 Oct 02:25 to 03:05 SGT) in two runs; the swaps themselves happened **17:48:11 to 18:30:20 UTC** (= Thu 22 Oct 01:48 to 02:30 SGT), 42 minutes of chain time, one contiguous window, slots 459719147 to 459731046 |
| `pyth-reads.json` | 313 reads of the Pyth SOL/USD account, one every 5 s for 26 minutes, with publish time, posted slot, and the slot of the read; 0 failed reads | Wed 21 Oct 2026 **18:13:32 to 18:39:32 UTC** (= Thu 22 Oct 02:13:32 to 02:39:32 SGT) |

The swap window and the Pyth window overlap only from 18:13 to 18:30 UTC. They are two independent captures; the demos do not combine them.

Commands: `SOLANA_RPC_URL=https://solana-rpc.publicnode.com node src/collect.ts swaps --count 4000` (stopped by hand after 800 swaps; the window was then extended backwards in time with `--count 3000 --append`, SWAP_CONCURRENCY=3, SWAP_GAP_MS=50, and stopped again at 2,900 swaps) and `node src/collect.ts pyth --minutes 26 --interval 5`. Both runs of the swap recorder walk back in time from newer to older signatures; the second continues from the oldest swap of the first, so the window is contiguous.

## Endpoints

| What | Endpoint | Method |
|---|---|---|
| Pool and vault addresses | Solana public RPC `https://api.mainnet.solana.com` and `https://solana-rpc.publicnode.com`, `getAccountInfo` of `Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE` (Orca Whirlpool SOL/USDC, tick spacing 4, fee 0.04%, owner `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`; same pool as build night 1 `recorded/SOURCES.md`) | vault addresses at bytes 133..165 (SOL vault `EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9`) and 213..245 (USDC vault `2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP`); both mints checked in the account bytes |
| Swap list | `https://solana-rpc.publicnode.com`, `getSignaturesForAddress(pool, {limit: 1000, before})` | newest-first signatures that touched the pool |
| Swap amounts | `https://solana-rpc.publicnode.com`, `getTransaction(sig, {encoding: "jsonParsed", maxSupportedTransactionVersion: 1, commitment: "confirmed"})` | `preTokenBalances` and `postTokenBalances` of the two vaults |
| Pyth | `https://api.mainnet.solana.com`, `getAccountInfo` (commitment confirmed) of `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` (Pyth push feed account for SOL/USD, owner `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`, feed id `ef0d8b6f...c280b56d`) | decoder copied unchanged from build night 1; the slot of the read is the `context.slot` of the response |

`api.mainnet.solana.com` was too slow for the swap recording: its response headers showed a per-method limit of 10 `getTransaction` calls per 10 seconds when measured on 2026-10-21 (so about 1 per second). `solana-rpc.publicnode.com` allowed about 12 calls per second with 2 to 3 parallel workers; with 4 workers and no pause it answered HTTP 429, so the recorder paces itself and backs off on 429 (1 s, 2 s, 4 s ... up to 30 s) and pauses all workers. The first run logged no 429; the second run (3 workers, 50 ms pause) logged 218 retry lines, each waited out with back-off and retried. Earlier test runs against api.mainnet.solana.com hit many, which is why it was not used. A 429 is always retried, never skipped.

## How the swap method was verified (2026-10-21)

- A swap moves the pool's two vaults in opposite directions. The decoder (`swapFromTx` in `src/swaps.ts`) reads each vault's balance before and after from the jsonParsed transaction and calls it a swap only if the SOL vault and the USDC vault both changed, in opposite directions. SOL vault up = the trader sold SOL ("sell"); SOL vault down = a buy.
- Test fixtures `test/fixtures/swap-transactions.json` hold two real transactions (one buy, one sell) exactly as returned by the RPC; the tests decode them to the amounts in the recorded file.
- Examples seen: a 300 USDC buy of 2.7566 SOL at 108.83, a sell of 0.3664 SOL for 39.87 USDC at 108.82. Prices in the window range from 107.78 to 109.06 USDC per SOL, in line with the Pyth reads of the same evening (108.51 to 109.10).
- The inspected transactions that were swaps came through the Orca program directly or through aggregators (log lines `Instruction: SwapV2`, `SwapTobV3`, `Swap2`); the vault method does not care which route was used.

## What the recorder skipped and what the demo drops

- Listed signatures: about 32,000. About 15,300 of them had failed on chain (bots); about 13,400 more were successful transactions that did not change both vaults (for example bots that read the pool). The rest are the 2,900 swaps. This is why about 16,000 `getTransaction` calls were needed for 2,900 swaps.
- When the demo loads the file it also drops 2 duplicate signatures, 134 dust swaps (under 1 USDC, where price = USDC / SOL is mostly rounding noise) and 5 price outliers (more than 1% from the median of the 21 swaps around them; the largest was a "swap" priced at 5,753 USDC per SOL, a transaction that did more than one thing). 2,759 swaps are used. The counts are printed by `npm run demo` and written into `out/swaps.json`.

## Pyth observations (real)

- The push feed does not update every slot. Over the 26 minutes the account changed 140 times; the median gap between publish times was about 10 s.
- At the contract limits (30 s age, 75 slots behind) **16 of the 187 real reads before the simulated fault were flagged stale**, in two real episodes where the account did not change for 30 to 50 s: about 18:17:17 to 18:18:17 UTC (age up to 51 s, 227 slots behind) and 18:21:17 to 18:21:42 UTC (age up to 46 s). The check works on real data too, and 30 s is tight for this feed. This is why the demo has `--max-age-sec` and `--max-slots-behind`.
- Age = the time of our read (local clock, rounded down to the second) minus Pyth's publish time. If our clock and Pyth's differ by a second or two, ages are off by that much.

## The simulated fault (read this)

The **frozen feed in `out/staleness.json` is simulated**, applied on top of real data. From the point 60% of the way through the series (18:29:07 UTC), `publishTime` and `postedSlot` are repeated from the last real read, while `t` and `currentSlot` keep their real values, so age and slots-behind grow like a feed that has stopped. Every such point has `simulated: true`, and `injectedFault.kind` is `frozen feed (simulated by repeating the last value)`. Nothing in the real Pyth feed froze at that time.

## Limits (read before drawing conclusions)

- One window of 42 minutes of swaps, on one night (01:48 to 02:30 SGT; Asian night, US evening). Activity varied from 3 to 165 swaps per minute and from 58 USD to about 119,000 USD per minute, but it is one night. Do not generalise.
- Swap prices include the 0.04% pool fee and the price impact of that swap. Buys print slightly above and sells slightly below the pool's mid price, so tick-to-tick noise of a few bps is expected.
- Block time has one-second resolution; many swaps share a second, and dollar bars that fill within one second show a duration of 0 s.
- Transactions that swap more than once in this pool, or swap and change liquidity, show only the net vault change. The demo's outlier rule removes the worst of them, not all.
- The swap list comes from `confirmed` transactions; a swap that was later dropped (not finalized) would be rare but is not excluded.
- Only Orca's SOL/USDC pool is used, not the whole SOL/USDC market (other pools and Jupiter routes are not included).
- The first and last time bars cover only part of a minute because the window starts and ends mid-minute.
- Strategy-like results (CUSUM events, agent-call counts) describe this window only; not advice.
