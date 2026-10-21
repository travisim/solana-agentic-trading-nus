# Recorded data: sources and limits

Everything in this folder is real data captured by `npm run collect` (`src/collect.ts`). Nothing is simulated or edited by hand.

## Capture

| | |
|---|---|
| Date | Wed 21 Oct 2026 (UTC) = Thu 22 Oct 2026 (SGT) |
| Start | 2026-10-21 17:13:59 UTC = 2026-10-22 01:13:59 SGT |
| End | 2026-10-21 17:53:59 UTC = 2026-10-22 01:53:59 SGT |
| Length | 40 minutes, 481 samples, one every 5 seconds, 0 failed ticks |
| Command | `node src/collect.ts --minutes 40 --interval 5` |

Files: `series.json` (all 481 points: unix time `t`, and the Jupiter, Pyth and Orca price in USD per SOL) and `snapshot.json` (the full last sample, with Pyth confidence and slots).

## Endpoints

| Venue | Endpoint | What was read |
|---|---|---|
| Jupiter | `GET https://lite-api.jup.ag/swap/v1/quote?inputMint=So111...112&outputMint=EPjFW...Dt1v&amount=1000000000&slippageBps=50` (public, no key) | `outAmount / 1e6`: USDC received for 1 SOL (price includes route fees and price impact of a 1 SOL swap) |
| Pyth | Solana public RPC `https://api.mainnet.solana.com`, `getAccountInfo` of `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` (Pyth push feed account for SOL/USD, owner `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ`, feed id `ef0d8b6f...c280b56d`) | `price * 10^exponent` from the 134-byte PriceUpdateV2 account |
| Orca | same RPC, `getAccountInfo` of `Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE` (Whirlpool SOL/USDC, tick spacing 4, fee 0.04%, owner `whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc`) | `(sqrtPrice / 2^64)^2 * 10^3` |

## How the Pyth and Orca reads were verified (2026-10-21)

- Pyth feed id re-checked against the public registry `https://hermes.pyth.network/v2/price_feeds?query=SOL/USD` (SOL/USD = `ef0d8b6f...`). The account decodes with the expected discriminator, owner and feed id; its price matched Jupiter and Orca within a few bps.
- Orca pool found with Orca's public API `https://api.orca.so/v2/solana/pools?tokensBothOf=<SOL>,<USDC>&sortBy=tvl`: it is the highest-TVL SOL/USDC pool (about 30 million USD TVL, about 113 million USD 24 h volume at the time; the next pools hold about 0.2 million USD). The account layout follows the Orca Whirlpool struct; the decoder checks both mint fields in the account bytes are SOL and USDC.
- Over the 40-minute capture, Orca versus Pyth: mean +1.1 bps, largest absolute gap 7.2 bps (limit for "verified" was 50 bps = 0.5%). Jupiter versus Pyth: mean +1.8 bps, largest 11.2 bps. Jupiter versus Orca: mean +0.7 bps, largest 6.3 bps.
- `test/fixtures/*.rpc.json` hold the raw RPC responses for the two accounts at slot ~459709297, used by the tests to decode known bytes.

## Limits (read before drawing conclusions)

- 40 minutes on one night (01:14 to 01:54 SGT, Asian night time, quiet US evening) is a short, calm window. It is not representative of busy markets. Gaps are small and few trades fire.
- Prices are polled snapshots every 5 s, not tick data. Jupiter's price is a quote for 1 SOL (it includes fees and impact); Pyth's price is the last on-chain push (it can be a few seconds behind); Orca's price is the pool's marginal price (no fee, no impact). These three are different kinds of price, so some gap is expected by construction.
- Timestamps are the local fetch time, rounded down to the second. The three reads of one sample are made in parallel and are within a second or so of each other, not atomic.
- No tick-level data, no order book, no slot-level ordering, no inventory data.
- Public RPC and Jupiter lite endpoints are free and rate limited; this capture used about 1 Jupiter and 2 RPC requests every 5 s and never hit HTTP 429.
- Strategy results computed from this file are simulations on this window only; not advice.

## Added for Workshop 4 (Thu 4 Feb 2027 session; captured Wed 21 Oct 2026)

`series.json` and `snapshot.json` above are a straight copy of the Build night 1 recording (`0002-data-collection-risk-hook`); this session adds one new capture:

### `solana-costs.json`: what Solana transactions cost and how often they fail

| | |
|---|---|
| Captured | Wed 21 Oct 2026, 19:53 UTC (Thu 22 Oct 03:53 SGT), command `node src/collectCosts.ts` |
| Source | Solana public RPC (`api.mainnet.solana.com`): `getBlock` with `transactionDetails: "accounts"` for five finalized blocks, about 40 slots apart (slots 459754249 to 459754409), and `getRecentPrioritizationFees` |
| What it holds | 2680 transactions: share that failed (35.3%, per block 27.8% to 43.6%), median and 90th percentile fee, share that paid a priority fee, the fee in USD and as basis points of a 1000 USD trade (using the recorded Pyth SOL price) |
| Not captured | Jito tips (ordinary transfers to tip accounts; not decoded here). The response contained no vote transactions, so none were filtered. |
| Limits | Five blocks on one evening is a sample, not a measurement of Solana. The 35% failure rate is mostly bot traffic that fails by design (failed transactions still pay the base fee), so it says little about YOUR transaction failure rate. `getRecentPrioritizationFees` returned 0 for all 150 slots (blocks had spare room), which is also just that moment. |

The Pyth price used to convert fees to USD comes from `snapshot.json` (2026-10-21 17:53 UTC), not from the capture time.
