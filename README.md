# Solana agentic trading: NUS workshops and build nights

Slides, interactive demos and sample code from the NUS Solana University program: students build an agentic trading project on Solana (an agent, an exchange component, or a tool) and show it at Demo Day.

**Website with all the demos:** https://nus-solana-demos.vercel.app/

## Sessions

| # | Date | Session | Folder | Demos |
|---|---|---|---|---|
| 0001 | 2026-10-13 | Workshop 1: Solana, Trading and Your First Bot | coming (added 2 days before) | |
| 0002 | 2026-10-22 | Build night 1: Data Collection and Risk Hook | [`0002-data-collection-risk-hook/`](0002-data-collection-risk-hook/) | [demos](https://nus-solana-demos.vercel.app/0002/) |
| 0003 | 2026-10-27 | Build night 2: Data Bars and Change Alerts | coming (added 2 days before) | |
| 0004 | 2026-11-03 | Workshop 2: Labeling Trades and Forming Teams | coming (added 2 days before) | |
| 0005 | 2026-11-10 | Build night 3: Position Sizing and the Trade Ledger | coming (added 2 days before) | |
| 0006 | 2027-01-19 | Workshop 3: Deploy a Trading Venue Component on Devnet | coming (added 2 days before) | |
| 0007 | 2027-01-26 | Build night 4: Backtest Validation and Failure Testing | coming (added 2 days before) | |
| 0008 | 2027-02-02 | Workshop 4: Performance Scorecard and Shipping | coming (added 2 days before) | |
| 0009 | 2027-02-09 | Build night 5: Demo Rehearsal | coming (added 2 days before) | |
| 0010 | 2027-02-16 | Demo Day: Demo Day | coming (added 2 days before) | |

Each session folder has the same layout:

```
NNNN-name/
  README.md      what the session covers and how to run it
  slides/        the deck (PDF + PowerPoint), speaker script, Q&A
  demo/
    lab/         interactive demos (open index.html, no server needed)
    code/        TypeScript sample code (npm install; npm run demo -- --recorded)
```

A session's folder is added two days before the session.

Everything runs from bundled recorded data (no keys, no AI credits). Demos can also read live public Solana data. Reads use public mainnet data; every write is devnet only. Nothing here is financial advice.

Maintainer: Travis Sim ([LinkedIn](https://linkedin.com/in/travisim), [Telegram](https://t.me/travisim)). See `THIRD-PARTY.md` for data sources and licences.
