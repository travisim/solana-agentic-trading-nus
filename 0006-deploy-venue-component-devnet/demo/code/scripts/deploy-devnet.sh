#!/bin/zsh
# Build the program, deploy it to DEVNET, run the scripted session, and record the evidence. Devnet only.
#   scripts/deploy-devnet.sh [path/to/funded-devnet-keypair.json]
# Needs: Solana CLI (cargo-build-sbf), Node 24, and about 0.07 SOL on devnet (rent for a 5.5 KB program; the buffer's rent comes back).
# The keypair file is read by the Solana CLI and by src/exercise.ts and is never printed. Keep it OUTSIDE this folder.
# The public faucet is rate limited (HTTP 429); the lead pre-funds keypairs before the session.
set -e
cd "$(dirname "$0")/.."
KP="${1:-$HOME/.config/solana-nus-workshop/deployer-0006.json}"
[ -f "$KP" ] || { echo "keypair not found: $KP (generate one with: solana-keygen new -o <path>)"; exit 1; }
echo "deployer: $(solana address -k "$KP")  balance on devnet: $(solana balance -k "$KP" -u devnet)"
( cd program && cargo build-sbf )
SO=program/target/deploy/mini_book.so
PK=program/target/deploy/mini_book-keypair.json
ls -l "$SO"
solana program deploy "$SO" --program-id "$PK" -u devnet -k "$KP" --max-len "$(wc -c < "$SO" | tr -d ' ')"
PID="$(solana address -k "$PK")"
solana program show "$PID" -u devnet
sleep 3
node src/exercise.ts --keypair "$KP" --program "$PID" --url https://api.devnet.solana.com --out recorded/devnet-run.json
echo "now run: npm run demo -- --recorded   and rebuild the lab (cd ../lab && node build.mjs)"
