//! mini_book: a tiny on-chain limit order book for Workshop 3 (devnet only).
//!
//! * No dependencies, no allocator: the book is ONE account with a fixed layout (272 bytes = 68 little-endian u32 words).
//! * Price-time priority: best price first, then the lowest order id (ids only go up).
//! * Fills happen at the resting (maker) price. Leftover quantity rests in the book.
//! * Every accepted order and every fill is written to the transaction log, so an
//!   explorer (or `getTransaction`) shows what happened.
//! * Demo only: there are no balances, no owners and no signer checks. Anyone can place
//!   or cancel any order. It teaches matching and settlement logs, it is not a venue.
//!
//! Layout (u32 words): [magic "MBK1", next order id, fills so far, last fill price] then 16 slots of
//! [id, side (0 empty, 1 bid, 2 ask), price, qty]. The TypeScript mirror in ../src/book.ts uses the same bytes.
#![cfg_attr(target_os = "solana", no_std)]

pub const SLOTS: usize = 16;
pub const WORDS: usize = 4 + SLOTS * 4; // 68
pub const BOOK_LEN: usize = WORDS * 4; // 272
pub const MAGIC: u32 = u32::from_le_bytes(*b"MBK1");
pub const BID: u32 = 1;
pub const ASK: u32 = 2;
const H: usize = 4;

pub type Book = [u32; WORDS];

// Custom program errors (shown as "custom program error: 0x<n>" on an explorer).
pub const ERR_BAD_INSTRUCTION: u64 = 1;
pub const ERR_BAD_ACCOUNT: u64 = 2;
pub const ERR_NOT_INITIALIZED: u64 = 3;
pub const ERR_BAD_SIDE: u64 = 4;
pub const ERR_ZERO_PRICE_OR_QTY: u64 = 5;
pub const ERR_BOOK_FULL: u64 = 6;
pub const ERR_ORDER_NOT_FOUND: u64 = 7;
pub const ERR_ALREADY_INITIALIZED: u64 = 8;

// Word access without bounds-check panics (panic paths drag in the formatting machinery and double the binary).
// Every index below is < WORDS: slot < SLOTS, field < 4.
#[inline(always)]
fn r(b: &Book, i: usize) -> u32 {
    unsafe { *b.get_unchecked(i) }
}
#[inline(always)]
fn w(b: &mut Book, i: usize, v: u32) {
    unsafe { *b.get_unchecked_mut(i) = v }
}
#[inline(always)]
fn le32(d: &[u8], o: usize) -> u32 {
    unsafe { (*d.get_unchecked(o) as u32) | (*d.get_unchecked(o + 1) as u32) << 8 | (*d.get_unchecked(o + 2) as u32) << 16 | (*d.get_unchecked(o + 3) as u32) << 24 }
}

/// A tiny fixed-size text buffer so we can log without an allocator or `format!`.
pub struct Line {
    buf: core::mem::MaybeUninit<[u8; 96]>,
    len: usize,
}
impl Line {
    pub fn new() -> Self {
        Line { buf: core::mem::MaybeUninit::uninit(), len: 0 }
    }
    fn push(&mut self, c: u8) {
        if self.len < 96 {
            unsafe { *(self.buf.as_mut_ptr() as *mut u8).add(self.len) = c };
            self.len += 1;
        }
    }
    pub fn s(&mut self, t: &str) -> &mut Self {
        for &c in t.as_bytes() {
            self.push(c);
        }
        self
    }
    pub fn n(&mut self, mut v: u32) -> &mut Self {
        let mut tmp = [0u8; 10];
        let mut i = 10;
        loop {
            i -= 1;
            unsafe { *tmp.get_unchecked_mut(i) = b'0' + (v % 10) as u8 };
            v /= 10;
            if v == 0 {
                break;
            }
        }
        while i < 10 {
            self.push(unsafe { *tmp.get_unchecked(i) });
            i += 1;
        }
        self
    }
    pub fn bytes(&self) -> &[u8] {
        unsafe { core::slice::from_raw_parts(self.buf.as_ptr() as *const u8, self.len) }
    }
}

/// Write a line to the sink (the Solana log on-chain, a Vec in tests).
pub trait Sink {
    fn line(&mut self, l: &Line);
}

#[inline(never)]
fn clear(b: &mut Book, o: usize) {
    for k in 0..4 {
        w(b, o + k, 0);
    }
}

pub fn init(b: &mut Book) -> Result<(), u64> {
    if r(b, 0) == MAGIC {
        return Err(ERR_ALREADY_INITIALIZED);
    }
    w(b, 0, MAGIC);
    w(b, 1, 1); // next order id
    Ok(())
}

/// Slot (index) of the best resting order on side `opp` that an order of `side` at `price` crosses, or SLOTS if none.
/// Best = best price, then the lowest id.
fn best(b: &Book, opp: u32, side: u32, price: u32) -> usize {
    let mut best = SLOTS;
    for i in 0..SLOTS {
        let o = H + i * 4;
        if r(b, o + 1) != opp {
            continue;
        }
        let p = r(b, o + 2);
        if (side == BID && p > price) || (side == ASK && p < price) {
            continue;
        }
        if best == SLOTS {
            best = i;
            continue;
        }
        let bo = H + best * 4;
        let bp = r(b, bo + 2);
        let better = if side == BID { p < bp } else { p > bp };
        if better || (p == bp && r(b, o) < r(b, bo)) {
            best = i;
        }
    }
    best
}

/// Place a limit order (a market order is a limit order at price 0 for a sell or u32::MAX for a buy).
/// On an error the whole transaction fails and the runtime discards every write, so the book is unchanged.
pub fn place(b: &mut Book, side: u32, price: u32, qty: u32, out: &mut impl Sink) -> Result<u32, u64> {
    if r(b, 0) != MAGIC {
        return Err(ERR_NOT_INITIALIZED);
    }
    if side != BID && side != ASK {
        return Err(ERR_BAD_SIDE);
    }
    if qty == 0 || (side == BID && price == 0) {
        return Err(ERR_ZERO_PRICE_OR_QTY);
    }
    let id = r(b, 1);
    w(b, 1, id.wrapping_add(1));
    let mut l = Line::new();
    l.s("ORDER id=").n(id).s(if side == BID { " BID px=" } else { " ASK px=" }).n(price).s(" qty=").n(qty);
    out.line(&l);

    let opp = 3 - side;
    let mut left = qty;
    while left > 0 {
        let m = best(b, opp, side, price);
        if m == SLOTS {
            break;
        }
        let o = H + m * 4;
        let (mid, mp, mq) = (r(b, o), r(b, o + 2), r(b, o + 3));
        let fill = if left < mq { left } else { mq };
        let mut l = Line::new();
        l.s("FILL taker=").n(id).s(" maker=").n(mid).s(" px=").n(mp).s(" qty=").n(fill);
        out.line(&l);
        left -= fill;
        if fill == mq {
            clear(b, o);
        } else {
            w(b, o + 3, mq - fill);
        }
        w(b, 2, r(b, 2).wrapping_add(1));
        w(b, 3, mp);
    }
    if left > 0 {
        let mut f = SLOTS;
        for i in 0..SLOTS {
            if r(b, H + i * 4 + 1) == 0 {
                f = i;
                break;
            }
        }
        if f == SLOTS {
            return Err(ERR_BOOK_FULL);
        }
        let o = H + f * 4;
        w(b, o, id);
        w(b, o + 1, side);
        w(b, o + 2, price);
        w(b, o + 3, left);
        let mut l = Line::new();
        l.s("REST id=").n(id).s(" qty=").n(left);
        out.line(&l);
    }
    Ok(id)
}

pub fn cancel(b: &mut Book, id: u32, out: &mut impl Sink) -> Result<(), u64> {
    if r(b, 0) != MAGIC {
        return Err(ERR_NOT_INITIALIZED);
    }
    for i in 0..SLOTS {
        let o = H + i * 4;
        if r(b, o + 1) != 0 && r(b, o) == id {
            clear(b, o);
            let mut l = Line::new();
            l.s("CANCEL id=").n(id);
            out.line(&l);
            return Ok(());
        }
    }
    Err(ERR_ORDER_NOT_FOUND)
}

/// Instruction data: [0] init | [1, side, price u32 LE, qty u32 LE] place | [2, id u32 LE] cancel
pub fn process(b: &mut Book, data: &[u8], out: &mut impl Sink) -> Result<(), u64> {
    match data.first() {
        Some(0) if data.len() == 1 => init(b),
        Some(1) if data.len() == 10 => place(b, unsafe { *data.get_unchecked(1) } as u32, le32(data, 2), le32(data, 6), out).map(|_| ()),
        Some(2) if data.len() == 5 => cancel(b, le32(data, 1), out),
        _ => Err(ERR_BAD_INSTRUCTION),
    }
}

// ---------------------------------------------------------------------------------------------
// Solana entrypoint (only compiled for the on-chain target). Hand-written to keep the binary tiny:
// it accepts exactly one account (the book), checks it is writable, owned by this program and big enough, then calls `process`.
// ---------------------------------------------------------------------------------------------
#[cfg(target_os = "solana")]
mod onchain {
    use super::*;

    extern "C" {
        fn sol_log_(msg: *const u8, len: u64);
    }

    struct LogSink;
    impl Sink for LogSink {
        fn line(&mut self, l: &Line) {
            let b = l.bytes();
            unsafe { sol_log_(b.as_ptr(), b.len() as u64) }
        }
    }

    #[panic_handler]
    fn panic(_: &core::panic::PanicInfo) -> ! {
        loop {}
    }

    /// Input layout (SBF loader): u64 account count, then per account: dup marker u8 (0xFF = new),
    /// is_signer u8, is_writable u8, executable u8, 4 pad, key[32], owner[32], lamports u64,
    /// data_len u64, data, 10240 realloc pad, align to 8, rent_epoch u64; then u64 data_len,
    /// instruction data, program id[32].
    #[no_mangle]
    pub unsafe extern "C" fn entrypoint(input: *mut u8) -> u64 {
        // Exactly one account is accepted: the book. (So the instruction data follows right after it.)
        if *(input as *const u64) != 1 || *input.add(8) != 0xFF {
            return ERR_BAD_ACCOUNT;
        }
        let p = input.add(8);
        let is_writable = *p.add(2);
        let owner = p.add(8 + 32) as *const u64;
        let data_len = *(p.add(8 + 32 + 32 + 8) as *const u64) as usize;
        let data_ptr = p.add(8 + 32 + 32 + 8 + 8);
        let q = ((data_ptr.add(data_len + 10240) as usize + 7) & !7) as *mut u8;
        let q = q.add(8); // skip rent epoch
        let ix_len = *(q as *const u64) as usize;
        let ix = core::slice::from_raw_parts(q.add(8), ix_len);
        let program_id = q.add(8 + ix_len);
        let mut same = true;
        for k in 0..4 {
            if core::ptr::read_unaligned(owner.add(k)) != core::ptr::read_unaligned((program_id as *const u64).add(k)) {
                same = false;
            }
        }
        if is_writable == 0 || !same || data_len < BOOK_LEN || (data_ptr as usize) & 3 != 0 {
            return ERR_BAD_ACCOUNT;
        }
        let book = &mut *(data_ptr as *mut Book);
        match process(book, ix, &mut LogSink) {
            Ok(()) => 0,
            Err(e) => e,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct V(Vec<String>);
    impl Sink for V {
        fn line(&mut self, l: &Line) {
            self.0.push(String::from_utf8(l.bytes().to_vec()).unwrap());
        }
    }
    fn fresh() -> Book {
        let mut b = [0u32; WORDS];
        init(&mut b).unwrap();
        b
    }
    #[test]
    fn rests_then_fills_at_maker_price_with_time_priority() {
        let mut b = fresh();
        let mut v = V(vec![]);
        place(&mut b, ASK, 101, 5, &mut v).unwrap(); // id 1
        place(&mut b, ASK, 100, 3, &mut v).unwrap(); // id 2 (better price)
        place(&mut b, ASK, 100, 4, &mut v).unwrap(); // id 3 (same price, later)
        v.0.clear();
        place(&mut b, BID, 101, 8, &mut v).unwrap(); // id 4 takes id2 (3), id3 (4), then id1 (1)
        assert_eq!(
            v.0,
            vec![
                "ORDER id=4 BID px=101 qty=8",
                "FILL taker=4 maker=2 px=100 qty=3",
                "FILL taker=4 maker=3 px=100 qty=4",
                "FILL taker=4 maker=1 px=101 qty=1",
            ]
        );
        assert_eq!(b[2], 3); // fills
        assert_eq!(b[3], 101); // last price
    }
    #[test]
    fn leftover_rests_and_cancel_works() {
        let mut b = fresh();
        let mut v = V(vec![]);
        place(&mut b, BID, 99, 5, &mut v).unwrap();
        place(&mut b, ASK, 98, 2, &mut v).unwrap(); // fills 2 against the bid at 99
        assert!(v.0.contains(&"FILL taker=2 maker=1 px=99 qty=2".to_string()));
        cancel(&mut b, 1, &mut v).unwrap();
        assert_eq!(cancel(&mut b, 1, &mut v), Err(ERR_ORDER_NOT_FOUND));
    }
    #[test]
    fn rejects_bad_input_and_full_book() {
        let mut b = fresh();
        let mut v = V(vec![]);
        assert_eq!(place(&mut b, 3, 10, 1, &mut v), Err(ERR_BAD_SIDE));
        assert_eq!(place(&mut b, BID, 10, 0, &mut v), Err(ERR_ZERO_PRICE_OR_QTY));
        for k in 0..SLOTS as u32 {
            place(&mut b, BID, 10 + k, 1, &mut v).unwrap();
        }
        assert_eq!(place(&mut b, BID, 5, 1, &mut v), Err(ERR_BOOK_FULL));
        let mut z = [0u32; WORDS];
        assert_eq!(place(&mut z, BID, 5, 1, &mut v), Err(ERR_NOT_INITIALIZED));
        assert_eq!(init(&mut b), Err(ERR_ALREADY_INITIALIZED));
    }
    #[test]
    fn instruction_data_round_trip() {
        let mut b = [0u32; WORDS];
        let mut v = V(vec![]);
        process(&mut b, &[0], &mut v).unwrap();
        process(&mut b, &[1, 2, 5, 0, 0, 0, 2, 0, 0, 0], &mut v).unwrap(); // ask 2 @ 5
        assert_eq!(v.0, vec!["ORDER id=1 ASK px=5 qty=2", "REST id=1 qty=2"]);
        assert_eq!(process(&mut b, &[9], &mut v), Err(ERR_BAD_INSTRUCTION));
        process(&mut b, &[2, 1, 0, 0, 0], &mut v).unwrap();
    }
    #[test]
    fn layout_matches_the_typescript_mirror() {
        // test: place ask px=0x01020304 qty=0x0a0b0c0d and check the bytes (same as test/book.test.ts)
        let mut b = fresh();
        let mut v = V(vec![]);
        place(&mut b, ASK, 0x01020304, 0x0a0b0c0d, &mut v).unwrap();
        let bytes: &[u8] = unsafe { core::slice::from_raw_parts(b.as_ptr() as *const u8, BOOK_LEN) };
        assert_eq!(&bytes[0..4], b"MBK1");
        assert_eq!(&bytes[16..32], &[1, 0, 0, 0, 2, 0, 0, 0, 0x04, 0x03, 0x02, 0x01, 0x0d, 0x0c, 0x0b, 0x0a]);
    }
}
