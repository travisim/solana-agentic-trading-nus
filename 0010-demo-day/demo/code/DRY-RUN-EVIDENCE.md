# Dry-run evidence: Demo Day code

Run on Thu 22 Oct 2026 (about 03:45 SGT) on macOS with Node v24.22.0, from a clean copy of `demo-repo/code` (no `node_modules`, no `out/`) placed at `.../clean/demo/code`. Output below is verbatim from the terminal.

Notes on the output:
- `npm run demo -- --recorded` runs with no network (recorded real reads from `recorded/`). `--live` read the mainnet slot twice (4 s apart) from `api.mainnet.solana.com` and the two sample signatures from `api.devnet.solana.com`, both read only; both signatures were `finalized` on devnet.
- The gaps example scores 3/11 inside `npm run demo` but 4/11 when `npm run ship` is pointed at the folder directly: the demo adds a key-shaped `id.json` (64 zeros, not a key) to a temp copy so the secrets check has something to catch. The extra pass is the secrets check.
- Test output is trimmed to the summary lines (38 tests, all pass; the per-test lines are omitted).

```text
$ node -v
v24.22.0

$ npm install

added 3 packages, and audited 4 packages in 503ms

found 0 vulnerabilities

$ npm test

> demo-day-kit@1.0.0 test
> node --test test/*.test.ts

ℹ tests 38
ℹ suites 0
ℹ pass 38
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 268.544

$ npm run typecheck

> demo-day-kit@1.0.0 typecheck
> tsc --noEmit


$ npm run demo -- --recorded

> demo-day-kit@1.0.0 demo
> node src/demo.ts --recorded

1. projects.json: 3 projects (agent 1, exchange 1, tooling 1), 0 errors, 1 warnings
   warning example-tooling / devnetSignature: no devnet evidence (add a transaction signature or a program address)
2. recorded: mainnet slot 459749459 and 2 devnet signature checks captured 2026-10-21T19:35:56.392Z
3. gallery: 3 cards -> out/gallery.json and out/gallery.html
   [agent   ] EXAMPLE: Spread Watch Agent  | tests: 14/14 passing (self-reported) | devnet: finalized on devnet at slot 513629343
   [exchange] EXAMPLE: Order Book Component  | tests: 22/24 passing (self-reported) | devnet: finalized on devnet at slot 513629341
   [tooling ] EXAMPLE: Clean Checkout Checker  | tests: 9/9 passing (self-reported) | devnet: no devnet evidence
4. schedule: 7 slots of 3+2 min, 18:20-18:55; rubric Utility 30, Reproducible tests 25, Devnet evidence 25, Clear explanation 10, Sustained contribution 10 (returns: not scored)
5. ship-readiness check
   ready-example: READY (11/11 checks, 7/7 required)
   gaps-example: NOT READY (3/11 checks, 1/7 required)

Done (recorded). Wrote /private/tmp/claude-501/-Users-r-Downloads-cody-solanaEvents/51ab7ba1-3422-4e2d-9534-b97a851ab0f0/scratchpad/clean/demo/code/out/: validation.json gallery.json gallery.html schedule.json rubric.json ship.json
Reads use public mainnet data; every write is devnet only; no real funds. Nothing here sends a transaction.

$ npm run validate -- projects.json

> demo-day-kit@1.0.0 validate
> node src/validate.ts projects.json

projects.json: 3 projects (agent 1, exchange 1, tooling 1)
  warning example-tooling / devnetSignature: no devnet evidence (add a transaction signature or a program address)
valid

$ npm run ship -- --dir recorded/ship-fixtures/gaps

> demo-day-kit@1.0.0 ship
> node src/ship.ts --dir recorded/ship-fixtures/gaps


gaps: NOT READY  (4/11 checks, 2/7 required)
  FAIL  req  README says how to run it: README.md has no run command
              fix: Add the exact commands, for example npm install then npm run demo.
  FAIL  req  A test command exists: no test script in package.json (and no Cargo.toml or pytest config)
              fix: Add a test script to package.json (or pytest, cargo test).
  pass  req  Test files exist: 1 test file(s), for example test/smoke.test.ts
  pass  req  No keys or secrets in the folder: no key files, .env or private key blocks found
  FAIL  req  No transaction is sent on mainnet: src/index.ts sends transactions and mentions mainnet
              fix: Every write is devnet only. Point sending code at devnet.
  FAIL  req  A devnet signature or link is written down: no transaction signature or devnet explorer link in README.md, DEVNET.md or DEMO-PACK.md
              fix: Put the transaction signature or explorer link in README.md or DEVNET.md.
  FAIL  req  A recorded backup of the demo exists: no recorded/ folder and no screen recording found
              fix: Add a recorded/ folder or a short screen recording in case the network fails.
  pass  rec  Dependencies are locked: package-lock.json present
  FAIL  rec  .gitignore covers .env and node_modules: .gitignore is missing .env or node_modules
              fix: Add a .gitignore with .env and node_modules/.
  FAIL  rec  README names a limitation: no Limitations heading in README.md
              fix: Add a Limitations heading. A clear negative result is valuable.
  pass  rec  A license file is present: LICENSE present

$ npm run demo -- --live

> demo-day-kit@1.0.0 demo
> node src/demo.ts --live

1. projects.json: 3 projects (agent 1, exchange 1, tooling 1), 0 errors, 1 warnings
   warning example-tooling / devnetSignature: no devnet evidence (add a transaction signature or a program address)
2. live: reading the mainnet slot from api.mainnet.solana.com and signatures from api.devnet.solana.com (read only)...
2. live: mainnet slot 459751606 (about 4.9 slots/s), 2 signature checks
3. gallery: 3 cards -> out/gallery.json and out/gallery.html
   [agent   ] EXAMPLE: Spread Watch Agent  | tests: 14/14 passing (self-reported) | devnet: finalized on devnet at slot 513629343
   [exchange] EXAMPLE: Order Book Component  | tests: 22/24 passing (self-reported) | devnet: finalized on devnet at slot 513629341
   [tooling ] EXAMPLE: Clean Checkout Checker  | tests: 9/9 passing (self-reported) | devnet: no devnet evidence
4. schedule: 7 slots of 3+2 min, 18:20-18:55; rubric Utility 30, Reproducible tests 25, Devnet evidence 25, Clear explanation 10, Sustained contribution 10 (returns: not scored)
5. ship-readiness check
   ready-example: READY (11/11 checks, 7/7 required)
   gaps-example: NOT READY (3/11 checks, 1/7 required)

Done (live). Wrote /private/tmp/claude-501/-Users-r-Downloads-cody-solanaEvents/51ab7ba1-3422-4e2d-9534-b97a851ab0f0/scratchpad/clean/demo/code/out/: validation.json gallery.json gallery.html schedule.json rubric.json ship.json
Reads use public mainnet data; every write is devnet only; no real funds. Nothing here sends a transaction.
```
