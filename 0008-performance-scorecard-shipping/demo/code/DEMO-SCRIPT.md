# Demo script: scorecard (3 minutes)

1. **The problem (20 s).** "A strategy that looks good in a chart can lose money once you count fees. I want one command that tells me the truth about a ledger."
2. **Run (60 s).** `npm run demo -- --recorded`. Point at: 45 trades, hit rate, break-even hit rate, gross versus net, max drawdown and time under water.
3. **Break one number on purpose (40 s).** `npm run demo -- --fee-bps 0 --slippage-bps 0`. Gross edge is visible. Run it again with the defaults: the same trades now lose money. "That gap is the lesson."
4. **Evidence (30 s).** `npm test` (all pass), then `npm run ship-check -- .` on this project: names what is still missing (devnet evidence: this project makes no devnet writes).
5. **The limit (30 s).** "40 minutes of one quiet night. Not a result, a demonstration."
6. **Backup.** If the network or laptop fails: `out/dashboard.html` and the screenshots in `slides/`.
