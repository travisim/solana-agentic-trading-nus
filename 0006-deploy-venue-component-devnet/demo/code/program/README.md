# mini_book: the on-chain program

A tiny limit order book for Workshop 3. **Devnet only. A teaching toy, not a venue.** Reads use public mainnet data; every write is devnet only; no real funds.

- Written in Rust with **no dependencies** (no `solana-program` crate, no allocator). The SBF input is parsed by hand and the one syscall used is `sol_log_`. That keeps the program at **5,528 bytes**, which keeps devnet rent small (a program costs rent for its size, twice while it is being deployed).
- State is **one account of 272 bytes** that the program owns: 4 header words (`"MBK1"`, next order id, fills, last fill price) then 16 slots of 4 words (id, side 0/1/2 = empty/bid/ask, price, quantity). All words are little-endian `u32`.
- Instruction data: `[0]` init; `[1, side, price u32, qty u32]` place; `[2, id u32]` cancel. Pass exactly one account: the book (writable, owned by the program, at least 272 bytes, 4-byte aligned).
- Rules: best price first, then lowest order id; fills at the resting order's price; leftover quantity rests; every order and fill is logged (`ORDER`, `FILL`, `REST`, `CANCEL`). A failing instruction returns a custom error (1 to 8, see `src/lib.rs`) and the runtime discards its writes, but the fee is still charged.
- Not in the toy on purpose: balances, owners, signer checks, more than 16 orders, price levels, fees. Anyone can cancel any order. Adding an owner and a signer check is the "advanced" branch-out task.

## Build, test, deploy

```bash
cargo test                      # 5 unit tests on the host (the engine is plain Rust)
cargo build-sbf                 # needs the Solana CLI (Agave 3.x) and its platform tools; writes target/deploy/mini_book.so
solana program deploy target/deploy/mini_book.so -u devnet --keypair <your throwaway key> --max-len 5528
```

`prebuilt/mini_book.so` is the exact file deployed in the recorded session (SHA-256 `866aef368c82ff3e47bb74ffa1098b4c3e218fb0f3bf6723922c1b01c131bcb2`), so you can deploy your own copy without building. `scripts/deploy-devnet.sh` (in `../scripts/`) builds, deploys and runs the scripted session. `target/` and program keypairs are git-ignored; never commit a keypair.

The deployed instance: program `UQLHxoX7P4RV4sPV9mS4DFmXD1a6pi1qSkh2vjEWwrL` on devnet (see `../recorded/devnet-deploy.json` for slot, signature and how it was verified).
