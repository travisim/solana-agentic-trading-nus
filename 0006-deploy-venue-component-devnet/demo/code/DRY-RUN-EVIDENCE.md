# Dry-run evidence (Workshop 3, venue-starters)

A clean copy of `demo-repo/code/` (no `node_modules/`, no `out/`, no `program/target/`) was made in an empty temp directory on the build laptop (macOS, Node 24) on 22 Oct 2026 and the commands below were run in it, in this order. The output is pasted verbatim (the Phoenix capture and devnet numbers come from `recorded/`, so they are the same on every machine). Network was available but is not used by these commands: `--recorded` is the default.

Not covered by this file: sending transactions to devnet (`npm run exercise`, `npm run deposit-run`, `scripts/deploy-devnet.sh`). Those were run once for real on 21 Oct 2026 and their results are stored in `recorded/devnet-*.json` and `recorded/deposit-run.json`; the faucet was rate limited (HTTP 429) all session, so the deployer key was funded by a transfer (see `recorded/SOURCES.md`). The Rust program has its own tests: `cd program && cargo test` (5 tests pass).

```text
$ node -v
v24.22.0

$ npm install

added 3 packages, and audited 4 packages in 486ms

found 0 vulnerabilities

$ npm test

> venue-starters@1.0.0 test
> node --test test/*.test.ts

✔ chronological puts each slot's swaps back in execution order and leaves slot order alone (1.79575ms)
✔ cleanSwaps drops dust and price outliers and says how many (0.18375ms)
✔ flow windows conserve volume and the tick rule is right on a clean up-down sequence (0.606291ms)
✔ snapshot features: a one-sided book has no spread and is measured from its only price (0.286417ms)
✔ the recorded on-chain session replays exactly in the TypeScript engine (2.021541ms)
✔ recorded devnet evidence is internally consistent (0.364417ms)
✔ init writes the magic and refuses a second init (0.687209ms)
✔ fills happen at the resting price, best price first, then oldest first (1.831791ms)
✔ an order that does not cross rests; leftover after a partial fill rests at its own limit (0.329958ms)
✔ a market order is a limit order at an extreme price (0.186958ms)
✔ rejected orders change nothing, even the next id (0.374792ms)
✔ a full book rejects a resting order and leaves the book unchanged (0.385916ms)
✔ cancel removes one order; cancelling twice fails with OrderNotFound (0.299875ms)
✔ instruction data is exactly what the program expects (1.242459ms)
✔ the byte layout is stable: header, then 16 byte slots (0.253ms)
✔ top of book: spread, mid and spread in bps (0.495791ms)
✔ an empty side gives no spread and no mid (0.07075ms)
✔ depth within a band counts only levels inside it (0.078083ms)
✔ imbalance runs from -1 to +1 (0.064916ms)
✔ microprice leans toward the thinner side (0.096041ms)
✔ order flow imbalance: a bigger bid at the same price is buying pressure (0.087917ms)
✔ walking the book: volume weighted price and slippage versus the best price (0.108667ms)
✔ tick rule: up is +1, down is -1, unchanged repeats the last sign (0.44175ms)
✔ tick rule accuracy against reported sides (0.130708ms)
✔ Roll estimate recovers the spread of a bouncing price (3.360542ms)
✔ trade imbalance (0.113625ms)
✔ out/*.json exist (run `npm run demo -- --recorded` first) (0.4745ms)
✔ ladder.json: markets, snapshots, features (6.17675ms)
✔ matching.json and devnet.json describe the same session (0.769042ms)
✔ flow.json: windows, tick rule, compact swaps (1.53625ms)
✔ decoder matches the official SDK on 2t9TBY... (2.830708ms)
✔ decoder matches the official SDK on 626t4F... (1.952ms)
✔ decoder matches the official SDK on CS2H8n... (1.533ms)
✔ devnet SOL/USDC test market is one-sided: asks only (1.263875ms)
✔ bids are sorted high to low and asks low to high, earliest first within a price (1.060584ms)
✔ market metadata is read from the header (0.915125ms)
✔ expired orders are dropped (0.104583ms)
✔ a short or foreign account is refused, not misread (0.22ms)
✔ base58 round trip, including leading zero bytes (0.846292ms)
✔ ed25519 signing matches RFC 8032 test vector 1 (empty message) (1.687375ms)
✔ a keypair whose public half does not match its seed is refused (0.327833ms)
✔ a generated keypair file is private (mode 600) and never serializes (1.340625ms)
✔ a transfer message has the legacy layout and a valid signature (1.012958ms)
✔ a memo instruction names the memo program and carries the text (0.091959ms)
✔ writes are refused on anything but devnet or a local validator (0.246833ms)
✔ a deposit is credited at confirmed, not at processed (0.752375ms)
✔ a failed transaction is never credited, even when it is finalized (0.077833ms)
✔ duplicate notifications do not move the first-seen time (0.061292ms)
✔ websocket URL: https to wss; a local validator uses the next port (0.106917ms)
ℹ tests 49
ℹ suites 0
ℹ pass 49
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 183.889166

$ npm run demo -- --recorded

> venue-starters@1.0.0 demo
> node src/demo.ts --recorded

Workshop 3 sample code. Reads use public mainnet data; every write is devnet only; no real funds.

1. Order books: 5 Phoenix markets, 32 snapshots each, every 15 s, captured 2026-10-21T19:49:58.101Z
   SOL/USDC                         mainnet bid  100.0010  ask  117.9990  spread   1651.2 bps  depth within 1%: 0.00/0.00 within 10%: 599.57/311.00 (bids/asks, base units)  top-5 changed in 1 of 31 intervals
   JitoSOL/SOL                      mainnet bid    1.2822  ask    1.3100  spread    214.8 bps  depth within 1%: 0.00/0.00 within 10%: 36.41/32.85 (bids/asks, base units)  top-5 changed in 0 of 31 intervals
   mSOL/SOL                         mainnet bid    1.3878  ask    2.2000  spread   4527.3 bps  depth within 1%: 0.00/0.00 within 10%: 0.00/0.00 (bids/asks, base units)  top-5 changed in 0 of 31 intervals
   SOL/USDC (devnet test tokens)    devnet  bid       n/a  ask  175.7050  spread      n/a bps  depth within 1%: 0.00/0.02 within 10%: 0.00/0.04 (bids/asks, base units)  top-5 changed in 0 of 31 intervals
   wSOL/USDC (devnet test tokens)   devnet  bid       n/a  ask       n/a  spread      n/a bps  depth within 1%: 0.00/0.00 within 10%: 0.00/0.00 (bids/asks, base units)  top-5 changed in 0 of 31 intervals

2. Matching: the TypeScript engine replays 9 recorded steps from devnet: logs equal the chain's on 9/9 steps; final book bytes equal: true
    1 ok     init: create the book account and initialize it
    2 ok     ask 5 @ 101 rests
    3 ok     ask 4 @ 102 rests
    4 ok     bid 6 @ 99 rests
    5 ok     bid 3 @ 98 rests
    6 ok     bid 7 @ 101 crosses: fills 5 @ 101, rests 2
         FILL taker=5 maker=1 px=101 qty=5
    7 ok     ask 9 @ 99 crosses: price priority, then rests 1
         FILL taker=6 maker=5 px=101 qty=2
         FILL taker=6 maker=3 px=99 qty=6
    8 FAILED bid with quantity 0 is rejected (fee still paid)
    9 ok     cancel order 4

3. Evidence (devnet, api.devnet.solana.com): program UQLHxoX7P4RV4sPV9mS4DFmXD1a6pi1qSkh2vjEWwrL (deployed in slot 513637896, 5528 bytes, sha256 866aef368c82...)
   book account 51oS5WH5st6nhUKBHRqB92w494BkhgJ7h5C8tdtJ4FdA
   9 transactions (1 failed on purpose), fees 50000 lamports, median confirmed after 712 ms, finalized after 712 ms
   for comparison, a local test validator: median processed 300 ms, confirmed 331 ms, finalized 16981 ms
   deposits (devnet):
     deposit 1: ok, credited true, amount 1000000 lamports, processed 410 ms, confirmed 932 ms, finalized 931 ms
     deposit 2: ok, credited true, amount 1500000 lamports, processed 231 ms, confirmed 534 ms, finalized 533 ms
     failing deposit (more than the sender holds): FAILED, credited false, amount 0 lamports, processed 317 ms, confirmed 654 ms, finalized 652 ms

4. Trade flow: 2900 real Orca SOL/USDC swaps recorded; dropped 144 dust swaps (< 0.01 SOL) and 5 price outliers; 2751 swaps kept in execution order, in 43 one-minute windows; tick rule agrees with the reported side on 95.7% (2633/2750); Roll spread 4.33 bps; imbalance vs same-minute return correlation 0.46, vs next minute 0.06

wrote out/ladder.json, out/matching.json, out/devnet.json, out/flow.json

$ ls out
devnet.json
flow.json
ladder.json
matching.json

$ npm run typecheck

> venue-starters@1.0.0 typecheck
> tsc --noEmit


$ npm run ladder

> venue-starters@1.0.0 ladder
> node src/ladder.ts

SOL/USDC (mainnet, Phoenix market 4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg)  recorded 2026-10-21T19:49:58.101Z, slot 459755590

          price        size
  ask    135.0020      0.0010
  ask    135.0010      0.0010
  ask    133.8740     30.0000
  ask    133.8730    120.0000
  ask    129.0000      0.8000
  ask    128.9990      1.0870
  ask    118.0000    200.0000
  ask    117.9990    111.0000
       ---- spread 17.9980 = 1651.2 bps ----
  bid    100.0010     99.5660
  bid    100.0000    500.0000
  bid     90.0190     60.6250
  bid     90.0100     42.2250
  bid     89.0190      5.6160
  bid     71.0090    145.6560
  bid     70.1790      7.1280
  bid     60.0300    167.9920
depth within  100 bps of mid: bids 0.000  asks 0.000  imbalance n/a
depth within  500 bps of mid: bids 0.000  asks 0.000  imbalance n/a
depth within 1000 bps of mid: bids 599.566  asks 311.000  imbalance 0.32
a market buy of 5 would fill at an average 117.9990 (0.0 bps worse than the best ask)
```
