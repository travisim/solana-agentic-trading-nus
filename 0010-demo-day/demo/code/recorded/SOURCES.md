# Recorded data: sources and limits (Demo Day)

Everything in this folder is real data captured by `npm run collect` (`src/collect.ts`), except the two tiny example repos in `ship-fixtures/`, which are hand-written EXAMPLES. Nothing here is simulated or edited by hand.

| File | What | Captured |
|---|---|---|
| `network.json` | Two real mainnet `getSlot` reads (commitment confirmed), 6 seconds apart, giving a slots-per-second figure. | Wed 21 Oct 2026 19:35:56 UTC (= Thu 22 Oct 03:35 SGT), from `api.mainnet.solana.com` |
| `signature-checks.json` | Real devnet `getSignatureStatuses` (with `searchTransactionHistory`) for two sample transactions. Both are devnet Memo-program transactions found with `getSignaturesForAddress(MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr)` on 22 Oct 2026. **They belong to nobody in this program.** They stand in for the signature a student would paste into `projects.json`. | Same minute, from `api.devnet.solana.com` |
| `ship-fixtures/ready/`, `ship-fixtures/gaps/` | Two tiny EXAMPLE repos for the ship-readiness check. The gaps example gets one extra file at run time, in a temp folder: `id.json` holding 64 zeros, which is key-shaped but not a key. No real keypair exists anywhere in this repo. | Hand-written 22 Oct 2026 |

Results captured: mainnet slot 459,749,459 at 19:35:56 UTC, about 4.63 slots per second over the 6-second window (a later `npm run demo -- --live` measured about 4.9); both sample signatures `finalized` on devnet at slots 513,629,343 and 513,629,341.

## Limits and honesty

- Devnet history is pruned over time. A signature that is `finalized` in the recorded file may show `not found` in Live mode weeks later. That is the check working, not a bug. Re-run `npm run collect` to refresh the recorded copies.
- Slots per second from two reads 6 seconds apart is a rough figure, not an average over a day.
- `api.mainnet.solana.com` is used from Node only. Browsers use `solana-rpc.publicnode.com` for mainnet reads (the public endpoint returns 403 to browser origins).
- The EXAMPLE projects in `../projects.json` use `example.com` links and `@example-handle-*` names. No real student work or names are in this repo.
