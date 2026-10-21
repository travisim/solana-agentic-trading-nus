// The Phoenix markets used in this session (addresses from the official SDK config.json, checked on chain: owner is the Phoenix program).
import { DEVNET_RPC, MAINNET_RPC } from "./rpc.ts";

export const MARKETS = [
  { name: "SOL/USDC", cluster: "mainnet", address: "4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg", url: MAINNET_RPC },
  { name: "JitoSOL/SOL", cluster: "mainnet", address: "2t9TBYyUyovhHQq434uAiBxW6DmJCg7w4xdDoSK6LRjP", url: MAINNET_RPC },
  { name: "mSOL/SOL", cluster: "mainnet", address: "FZRgpfpvicJ3p23DfmZuvUgcQZBHJsWScTf2N2jK8dy6", url: MAINNET_RPC },
  { name: "SOL/USDC (devnet test tokens)", cluster: "devnet", address: "CS2H8nbAVVEUHWPF5extCSymqheQdkd4d7thik6eet9N", url: DEVNET_RPC },
  { name: "wSOL/USDC (devnet test tokens)", cluster: "devnet", address: "626t4FAUCVWMSvZsjzyPDJjPAKvdrafJB2pAcC6Ags2m", url: DEVNET_RPC },
] as const;
