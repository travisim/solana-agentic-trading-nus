# Recorded data: sources and limits (Workshop 3)

Everything here was captured by the scripts in `src/` on **Wed 21 Oct 2026, 19:49 to 20:11 UTC (Thu 22 Oct 03:49 to 04:11 SGT)**, except `swaps.json` (copied from Build night 2). Nothing is edited by hand. Reads are public mainnet or devnet reads; the only writes are devnet transactions (and one run on a local test validator).

| File | What | Captured (UTC) | How |
|---|---|---|---|
| `phoenix.json` | 5 Phoenix market accounts, 32 snapshots each, 15 s apart (8 minutes), top 100 price levels per side; Orca SOL/USDC pool price and Pyth SOL/USD price at each round (32 reads each, 0 failed reads) | 2026-10-21 19:49:58 to about 19:58 | `node src/collect.ts phoenix --minutes 8 --interval 15` |
| `swaps.json` | 2,900 real Orca SOL/USDC swaps (oldest first by slot), swaps between 17:48:11 and 18:30:20 UTC on 21 Oct | recorded in Build night 2 (2026-10-21 19:03 UTC), copied unchanged from `0003-build-night-2-data-bars-change-alerts/demo-repo/code/recorded/swaps.json` | see that folder's `SOURCES.md` |
| `devnet-deploy.json` | The real devnet deployment of `UQLHxoX7P4RV4sPV9mS4DFmXD1a6pi1qSkh2vjEWwrL`: deploy transaction, slot, size, SHA-256, upgrade authority, how it was funded | 2026-10-21 about 20:10 | `solana program deploy` (see `scripts/deploy-devnet.sh`) |
| `devnet-run.json` | The scripted session on devnet: 9 transactions with signatures, slots, fees, compute units, program logs, time to processed, confirmed and finalized (from a websocket `signatureSubscribe`), and the final book account bytes | 2026-10-21 20:10:50 | `node src/exercise.ts ...` |
| `deposit-run.json` | Two deposits and one failing deposit to a fresh vault address on devnet, watched with `logsSubscribe` at three commitment levels | 2026-10-21 20:01 | `node src/deposit-run.ts ...` |
| `local-run.json` | The same scripted session on a **local test validator** (Agave 3.1.10), for one comparison only | 2026-10-21 20:10:31 | same script, `--url http://127.0.0.1:8899` |
| `../test/fixtures/phoenix-*.account.gz` | gzip of three real Phoenix market accounts (devnet SOL/USDC, devnet wSOL/USDC, mainnet JitoSOL/SOL) and the values the **official Phoenix SDK** computes from them | 2026-10-21 19:49 | `node src/collect.ts fixtures`, then the SDK (see below) |

## Endpoints

| What | Endpoint |
|---|---|
| Mainnet reads (Phoenix, Orca, Pyth) | `https://solana-rpc.publicnode.com` (`getAccountInfo`, `getSignaturesForAddress`) |
| Devnet reads and writes | `https://api.devnet.solana.com` (`getAccountInfo`, `getLatestBlockhash`, `sendTransaction`, `getTransaction`, `getSlot`) and its websocket (`signatureSubscribe`, `logsSubscribe`) |
| Phoenix markets | addresses from the official SDK `config.json` (`@ellipsis-labs/phoenix-sdk` 2.0.3): mainnet SOL/USDC `4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg`, JitoSOL/SOL `2t9TBYyUyovhHQq434uAiBxW6DmJCg7w4xdDoSK6LRjP`, mSOL/SOL `FZRgpfpvicJ3p23DfmZuvUgcQZBHJsWScTf2N2jK8dy6`; devnet SOL/USDC `CS2H8nbAVVEUHWPF5extCSymqheQdkd4d7thik6eet9N`, wSOL/USDC `626t4FAUCVWMSvZsjzyPDJjPAKvdrafJB2pAcC6Ags2m`. Every account's owner was checked to be the Phoenix program `PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY`. |
| Orca pool | Whirlpool SOL/USDC `Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE` (same as Build nights 1 and 2) |

## How the Phoenix decoder was verified

`src/phoenix.ts` reads the market account without the SDK. Its layout was taken from the SDK source (`deserializeMarketData`), then compared with the **SDK's own output on the same account bytes**: bid and ask counts, and the first five price levels of each side for three markets, all equal (the expected values are stored in `test/fixtures/*.expected.json` and checked by `test/phoenix.test.ts`). The browser decoder in `../lab/shared/live.js` is checked against the same expectations by `../lab/verify.mjs`.

## Honest limits and things worth knowing

- **Phoenix here is the old "Phoenix Legacy" v1 program.** Its mainnet books are thin. The SOL/USDC book had best bid 100.001 and best ask 117.999 while Orca priced SOL near 108.2: a spread of 1,651 bps (16.5%), and only a handful of order changes in 8 minutes (the top five levels changed once). That is real, not a bug, and it is the lesson: spread and depth tell you whether a venue is usable.
- **Expired orders stay in the account.** Phoenix orders can carry an expiry (slot or time). The devnet wSOL/USDC book holds one bid and one ask that have expired, so the recorder drops them (`liveOrders`), and the book reads as empty. The counts of expired orders are in each snapshot (`orders.expiredBids`, `orders.expiredAsks`).
- **Devnet markets use test tokens**, not USDC or SOL. Prices there mean nothing.
- **Only the first 100 price levels per side are stored.** Depth bands are measured inside those levels.
- **Order of swaps inside one slot.** `swaps.json` lists swaps oldest first by slot, but *inside a slot* they are in reverse order. With the file's order the tick rule is right on 39% of swaps; after putting each slot's swaps back in execution order (`chronological()` in `src/analysis.ts`) it is right on 95.7%. We also drop 144 dust swaps (under 0.01 SOL, price rounding noise) and 5 price outliers (more than 1% from the median, multi-leg transactions) before computing flow numbers. The original file is not changed.
- **Finalization.** On devnet today the `confirmed` and `finalized` notifications arrive together (median 712 ms after sending), `processed` about 300 ms earlier. On the local test validator `finalized` took about 17 s. Do not assume either; measure the cluster you use.
- **Devnet rent** on this cluster is 5,080 lamports per byte (`solana rent`), lower than the usual figure; fees are 5,000 lamports per signature.
- **Funding.** The public devnet faucet answered HTTP 429 ("airdrop limit today") to every request during this session, from the standard RPC and from rpcpool. The program was deployed by a locally generated deployer key (kept outside the repository) funded by a 63,444,000 lamport transfer from a leftover devnet test wallet of an earlier experiment (`research/experiments/deposit-watcher`). The same wallet sent the deposits. All devnet, no real funds.
