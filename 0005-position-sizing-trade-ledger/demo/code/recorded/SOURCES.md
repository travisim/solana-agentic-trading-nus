# Recorded data: sources and limits (Build night 3)

Everything here is real data captured from public Solana endpoints or copied unchanged from an earlier session. Nothing in these files is simulated or edited by hand. The simulation (bets, orders, fills, ledger) is computed from them by `npm run demo` and is labelled "Simulated, on recorded data; not advice".

## Files

| File | What | Captured |
|---|---|---|
| `series.json` | 481 real SOL/USD price samples, one every 5 s, from three sources at once: Jupiter quote for 1 SOL, Pyth oracle, Orca SOL/USDC pool price. **Copied unchanged from build night 1** (`0002-build-night-1-data-collection-risk-hook/demo-repo/code/recorded/series.json`; its `SOURCES.md` holds the endpoints and checks) | Wed 21 Oct 2026 **17:13:59 to 17:53:59 UTC** (= Thu 22 Oct 01:13:59 to 01:53:59 SGT), 40 minutes, 0 failed ticks |
| `jupiter-impact.json` | 16 real Jupiter quotes per pair (8 sizes from 100 to 1,000,000 USD, each as a buy and as a sell) for SOL/USDC and ORCA/USDC: Jupiter's own `priceImpactPct` for each size, converted to basis points (1 % = 100 bps), plus the executed price and routes | Wed 21 Oct 2026 **19:36 UTC** (= Thu 22 Oct 03:36 SGT) |
| `token-balances.json` | the Orca SOL/USDC pool's two real SPL token accounts (the vaults): SOL vault `EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9` and USDC vault `2WLWEuKDgkDUccTpbwYp1GToYktiSB1cXvreHUwiSUVP`, with mint, owner, raw amount, decimals and slot | Wed 21 Oct 2026 **19:36:08 UTC**, slots 459749513 and 459749514 |

## Endpoints and methods

| What | Endpoint | Method |
|---|---|---|
| Price impact | `GET https://lite-api.jup.ag/swap/v1/quote?inputMint=...&outputMint=...&amount=...&slippageBps=50` (public, no key) | USDC to token for buys, token to USDC for sells; `priceImpactPct` read verbatim; sells are sized in tokens using the token amount a 100 USD buy returned. 1.5 s between calls, retry with a wait on HTTP 429 (a handful of 429s were retried and none skipped) |
| Token balances | `https://solana-rpc.publicnode.com`, `getAccountInfo(address, {encoding: "base64"})` | SPL token account layout: mint bytes 0..32, owner 32..64, amount u64 little endian at 64..72. `getTokenAccountBalance` is **not** used: publicnode answers it with "Indexed requests require a personal token", while `api.mainnet.solana.com` allows it from Node but returns 403 for browsers. `getAccountInfo` works on every endpoint, in Node and in the browser |
| Test fixture | `test/fixtures/EUuUbDcafPrmVTD5M6qoJAoyyNbihBhugADAxRMn5he9.rpc.json` | the raw `getAccountInfo` response for the SOL vault (slot 459750472), used by the tests to decode known bytes |

## What the numbers say (read before drawing conclusions)

- **SOL/USDC is very deep.** At 100,000 USD Jupiter reports about 0.005 bps of impact for a buy and 0 for a sell; at 1,000,000 USD about 0.07 bps (buy) and 0.06 bps (sell). The pool pair holds about 178,700 SOL and 10.7 million USDC at capture. So for SOL/USDC at classroom sizes the price-impact cap never binds and the fee (4 bps per fill in this demo) is the cost that matters.
- **ORCA/USDC is thinner and shows what the cap is for**: about 3.3 bps at 100,000 USD (buy) and 28 bps at 1,000,000 USD (buy); 42 bps for a 1,000,000 USD sell. With a 5 bps cap the largest buy on this curve is about 159,000 USD. The ORCA/USDC curve is used only by demo 1 and `npm run demo` section 5 to show the cap; the simulation trades SOL/USDC.
- Impact is read at one moment. Quotes at small sizes are noisy (a few thousandths of a bp, sometimes exactly 0) because Jupiter picks different routes for different sizes. Between the 8 sizes the code interpolates linearly; beyond 1,000,000 USD it extrapolates, which is a guess.
- The demo does not know the live order book depth; `priceImpactPct` is Jupiter's estimate for a swap now, not a guarantee.

## Limits

- One 40-minute price window on one night (01:14 to 01:54 SGT, Asian night, US evening, a calm window). Strategy-like results (bets, equity, fees) describe this window only; they are simulated and are not advice.
- Prices are polled snapshots every 5 s, not tick data. Pyth's value changes only when Pyth publishes; the demo's "oracle age" is a proxy: **seconds since the Pyth value in the series last changed** (the recording stores no publish time). It is a lower bound on real age.
- The simulated account (10,000 USD of cash, nothing else) is not a real wallet. Fills happen at the Orca pool's marginal price plus the interpolated impact, with a 4 bps fee; there is no latency, no failed transaction, no slippage beyond that.
- A short position is simulated (a negative SOL balance). Spot SOL cannot be shorted without borrowing or a perpetual; treat it as "perp-style, no real funds".
