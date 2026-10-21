// Client side of the mini_book program: ids, instruction builders, account reads.
import { BOOK_LEN, ixCancel, ixInit, ixPlace, type BookView, decodeBook } from "./book.ts";
import { getAccount, rpcOnce } from "./rpc.ts";
import { systemCreateAccount, type Instruction } from "./tx.ts";

export const EXPLORER = "https://explorer.solana.com";
export const explorerTx = (sig: string, cluster = "devnet") => `${EXPLORER}/tx/${sig}?cluster=${cluster}`;
export const explorerAddr = (a: string, cluster = "devnet") => `${EXPLORER}/address/${a}?cluster=${cluster}`;

export const bookIx = (programId: string, book: string, data: Uint8Array): Instruction => ({
  programId,
  accounts: [{ pubkey: book, isSigner: false, isWritable: true }],
  data,
});
export const initBookIxs = (payer: string, book: string, programId: string, rentLamports: bigint): Instruction[] => [
  systemCreateAccount(payer, book, rentLamports, BigInt(BOOK_LEN), programId),
  bookIx(programId, book, ixInit()),
];
export const placeIx = (programId: string, book: string, side: number, price: number, qty: number) => bookIx(programId, book, ixPlace(side, price, qty));
export const cancelIx = (programId: string, book: string, id: number) => bookIx(programId, book, ixCancel(id));

export async function readBook(book: string, url: string, programId?: string): Promise<{ view: BookView; slot: number; bytes: Uint8Array }> {
  const a = await getAccount(book, url);
  if (programId && a.owner !== programId) throw new Error(`account ${book} is owned by ${a.owner}, not the book program`);
  return { view: decodeBook(a.bytes), slot: a.slot, bytes: a.bytes };
}

export const rentFor = (size: number, url: string) => rpcOnce<number>("getMinimumBalanceForRentExemption", [size], url);
