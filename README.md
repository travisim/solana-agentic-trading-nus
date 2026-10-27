# Solana agentic trading: NUS workshops and build nights

Slides, interactive demos and sample code from the NUS Solana University program: students build an agentic trading project on Solana (an agent, an exchange component, or a tool) and show it at Demo Day.

**Website with all the demos:** https://nus-solana-demos.vercel.app/

## Sessions

| # | Date | Session | Folder | Demos |
|---|---|---|---|---|
| 0001 | 2026-10-13 | Workshop 1: Solana, Trading and Your First Bot | held (materials not in this repo) | |
| 0002 | 2026-10-22 | Build night 1: Data Collection and Risk Hook | [`0002-data-collection-risk-hook/`](0002-data-collection-risk-hook/) | [demos](https://nus-solana-demos.vercel.app/0002/) |
| 0003 | 2026-10-29 | Build night 2: Data Bars and Change Alerts | [`0003-data-bars-change-alerts/`](0003-data-bars-change-alerts/) | [demos](https://nus-solana-demos.vercel.app/0003/) |
| 0004 | 2026-11-05 | Workshop 2: Labeling Trades and Forming Teams | [`0004-labeling-trades-forming-teams/`](0004-labeling-trades-forming-teams/) | [demos](https://nus-solana-demos.vercel.app/0004/) |
| 0005 | 2026-11-12 | Build night 3: Position Sizing and the Trade Ledger | [`0005-position-sizing-trade-ledger/`](0005-position-sizing-trade-ledger/) | [demos](https://nus-solana-demos.vercel.app/0005/) |
| 0006 | 2027-01-21 | Workshop 3: Deploy a Trading Venue Component on Devnet | [`0006-deploy-venue-component-devnet/`](0006-deploy-venue-component-devnet/) | [demos](https://nus-solana-demos.vercel.app/0006/) |
| 0007 | 2027-01-28 | Build night 4: Backtest Validation and Failure Testing | [`0007-backtest-validation-failure-testing/`](0007-backtest-validation-failure-testing/) | [demos](https://nus-solana-demos.vercel.app/0007/) |
| 0008 | 2027-02-04 | Workshop 4: Performance Scorecard and Shipping | [`0008-performance-scorecard-shipping/`](0008-performance-scorecard-shipping/) | [demos](https://nus-solana-demos.vercel.app/0008/) |
| 0009 | 2027-02-11 | Build night 5: Demo Rehearsal | [`0009-demo-rehearsal/`](0009-demo-rehearsal/) | [demos](https://nus-solana-demos.vercel.app/0009/) |
| 0010 | 2027-02-18 | Demo Day: Demo Day | [`0010-demo-day/`](0010-demo-day/) | [demos](https://nus-solana-demos.vercel.app/0010/) |

Each session folder has the same layout:

```
NNNN-name/
  README.md      what the session covers and how to run it
  slides/        the deck (PDF + PowerPoint), speaker script, Q&A
  demo/
    lab/         interactive demos (open index.html, no server needed)
    code/        TypeScript sample code (npm install; npm run demo -- --recorded)
```

Everything runs from bundled recorded data (no keys, no AI credits). Demos can also read live public Solana data. Reads use public mainnet data; every write is devnet only. Nothing here is financial advice.

Maintainer: Travis Sim ([LinkedIn](https://linkedin.com/in/travisim), [Telegram](https://t.me/travisim)). See `THIRD-PARTY.md` for data sources and licences.
