// Collector 2: ORACLE price. Pyth push-feed account read on-chain over public RPC.
// (Pyth's Hermes REST API is paywalled; the on-chain account is free to read.)
//
// Account: PriceUpdateV2 owned by the Pyth Solana Receiver program.
// Address = PDA([shard u16 LE = 0, feed id 32 bytes], receiver program), derived with the official
// SDK scheme (@pythnetwork/pyth-solana-receiver getPriceFeedAccountForProgram). SOL/USD feed id
// comes from the public registry https://hermes.pyth.network/v2/price_feeds?query=SOL/USD
//
// Layout (bytes): 0..8 discriminator | 8..40 write authority | 40 verification level |
// 41..73 feed id | 73..81 price i64 | 81..89 confidence i64 | 89..93 exponent i32 |
// 93..101 publish time i64 | 125..133 posted slot u64
// Copied from build night 1 (0002 demo-repo/code/src/collectors/pyth.ts); the decoder is unchanged.
import { getAccount } from "./rpc.ts";

export const PYTH_RECEIVER_PROGRAM = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
export const SOL_USD_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
export const SOL_USD_ACCOUNT = "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE";
const DISCRIMINATOR = "22f123639d7ef4cd"; // first 8 bytes of sha256("account:PriceUpdateV2")

export interface PythPrice {
  price: number;
  confBps: number;
  publishTime: number;
  postedSlot: number;
  feedId: string;
}

export function decodePythPrice(bytes: Uint8Array): PythPrice {
  if (bytes.length < 133) throw new Error(`Pyth account too short: ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hex = (a: number, b: number) =>
    Array.from(bytes.slice(a, b), (x) => x.toString(16).padStart(2, "0")).join("");
  if (hex(0, 8) !== DISCRIMINATOR) throw new Error("not a Pyth PriceUpdateV2 account");
  const exponent = view.getInt32(89, true);
  const price = Number(view.getBigInt64(73, true)) * 10 ** exponent;
  const conf = Number(view.getBigInt64(81, true)) * 10 ** exponent;
  return {
    price,
    confBps: (conf / price) * 10_000,
    publishTime: Number(view.getBigInt64(93, true)),
    postedSlot: Number(view.getBigUint64(125, true)),
    feedId: hex(41, 73),
  };
}



export interface PythRead extends PythPrice {
  currentSlot: number; // slot of the RPC read (confirmed commitment)
}

/** Read the SOL/USD Pyth price account once. Throws if owner or feed id is not what we expect. */
export async function readPyth(): Promise<PythRead> {
  const acc = await getAccount(SOL_USD_ACCOUNT);
  if (acc.owner !== PYTH_RECEIVER_PROGRAM) throw new Error(`unexpected Pyth account owner ${acc.owner}`);
  const p = decodePythPrice(acc.bytes);
  if (p.feedId !== SOL_USD_FEED_ID) throw new Error(`Pyth account holds a different feed: ${p.feedId}`);
  return { ...p, currentSlot: acc.slot };
}
