# Recorded data: sources and limits (Workshop 2)

Nothing in `series.json` or `swaps.json` was captured for this session; both files are **copied unchanged** from the earlier sessions, so Workshop 2 labels the same real market data that Build night 1 and Build night 2 collected. The only new file is the devnet simulation record. Nothing is simulated or edited by hand, except where a file says so.

## Files

| File | What | Captured | Copied from |
|---|---|---|---|
| `series.json` | 481 samples, one every 5 s for 40 minutes, of three SOL/USDC prices: Jupiter quote (1 SOL to USDC), Pyth oracle (on-chain account) and Orca Whirlpool pool price (on-chain account); 0 failed ticks | Wed 21 Oct 2026, **17:13:59 to 17:53:59 UTC** (= Thu 22 Oct 01:13:59 to 01:53:59 Singapore time); recording ended 17:53:59 UTC | `0002-build-night-1-data-collection-risk-hook/demo-repo/code/recorded/series.json` (see its `SOURCES.md`) |
| `swaps.json` | 2,900 real Orca SOL/USDC swaps (2,759 after cleaning), found from the pool's token-vault balance changes; 42 minutes of chain time | swaps on Wed 21 Oct 2026 **17:48:11 to 18:30:20 UTC** (= Thu 22 Oct 01:48 to 02:30 Singapore time); file captured 19:03 UTC | `0003-build-night-2-data-bars-change-alerts/demo-repo/code/recorded/swaps.json` (see its `SOURCES.md`) |
| `devnet-simulation.json` | the result of asking devnet to dry-run three Memo transactions built by `src/memo.ts` (`simulateTransaction`, signatures not checked, **nothing sent**) | Thu 22 Oct 2026, devnet | produced by `node src/memo.ts --simulate --payer <a funded devnet address> --write` |

Endpoints, how the Pyth and Orca accounts were decoded, the Jupiter quote URL and the limits of each capture are in the two source files named above. In short: Jupiter `https://lite-api.jup.ag/swap/v1/quote` (public, no key); Pyth SOL/USD push account `7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE` and Orca SOL/USDC whirlpool `Czfq3xZZDmsdGdUyrNLtRhGc47cXcZtLG4crryfu44zE` read with `getAccountInfo`; swaps from `getSignaturesForAddress` plus `getTransaction` (jsonParsed). This session's code reads through `https://solana-rpc.publicnode.com` by default.

## What the labeler does with them

- `--source orca` (default), `pyth` or `jupiter`: one of the three price columns of `series.json` is the path that gets labelled. The second venue for the gap feature is Pyth for Orca and Jupiter, Orca for Pyth.
- `--source swaps`: the cleaned swaps become dollar bars (default $10,000 each; build night 2 idea) and one step is one bar close; there is no second venue, so the gap feature is 0.
- Why Orca is the default: Pyth's push feed updates only about every 10 s (252 of 480 one-step changes are exactly zero) and Jupiter's quote carries routing noise, so both give choppier paths. `out/sources.json` shows the same agent on all three; labels differ because the paths differ (that is a lesson, not a bug).

## Live collection

`npm run collect -- --minutes 10` records fresh Jupiter, Pyth and Orca samples into `recorded/series-live.json`; `npm run demo -- --live` records 6 minutes (73 samples) and labels them with a 12-step time limit, writing to `out-live/`. Dry run on 21 Oct 2026 19:43 to 19:50 UTC: 73 samples, 0 failed reads. A 6-minute window is far too short to conclude anything; it shows the pipeline on fresh data. On any failure the demo says so and falls back to the recorded files.

## Limits (read before drawing conclusions)

- One 40-minute window on one night (Asian night, US evening), a calm period: price range 107.99 to 108.68 on Orca. Do not generalise.
- During the window the price drifted up by about 0.6%; a momentum rule benefits from that. The labels and hit rates describe this window only.
- Labels and hit rates are **gross of fees and slippage**. A round trip through the Orca pool costs about 8 bps in pool fees alone (0.04% each way); the default barrier is about 3.4 bps wide, so no winning label is wide enough to pay that. This is stated on slides, in the demos and in the code's output.
- Prices are polled snapshots every 5 s, not tick data; a barrier touched between two samples is not seen.
- Pyth and Orca timestamps are our local fetch times, rounded down to the second.
- The agent, its written reasons, the wrong claims injected into 20% of them and the "gate" are computed from this data by plain code in this repo; the wrong claims are simulated (fixed seed) and flagged `injected` in `out/agent.json`.
- **Devnet write status:** `npm run memo -- --send` could not be completed end to end on 22 Oct 2026: the public devnet faucet answered HTTP 429 ("airdrop limit reached") for a fresh throwaway key, and no funded key was available to the builder. What was verified instead: the hand-built Memo transaction (legacy message, one signer, Node's built-in ed25519) is accepted by devnet's `simulateTransaction` and the Memo program logs the exact memo text (`devnet-simulation.json`, payer is a public devnet address, nothing signed or sent); the message layout and a real ed25519 signature round-trip are covered by `test/memo.test.ts`. A lead with a funded devnet key can run `--send` in the room. No signature was invented.
