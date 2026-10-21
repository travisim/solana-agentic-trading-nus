// Presenter schedule: 3 minute demo + 2 minute questions per slot, back to back, no changeover buffer
// (the guide's table gives 18:20-18:55, which is exactly seven 5-minute slots).
export interface Slot {
  slot: number;
  start: string;
  demoEnds: string;
  end: string;
  projectId: string | null;
}
export interface Schedule {
  date: string;
  tz: "SGT";
  demoMin: number;
  qaMin: number;
  firstStart: string;
  slots: Slot[];
  overflow: number;
  window: string;
  peerGallery: string;
}

const toMin = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`bad time "${hhmm}", use HH:MM`);
  return Number(m[1]) * 60 + Number(m[2]);
};
export const fmt = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function buildSchedule(opts: { order?: string[]; maxSlots?: number; firstStart?: string; demoMin?: number; qaMin?: number } = {}): Schedule {
  const demoMin = opts.demoMin ?? 3;
  const qaMin = opts.qaMin ?? 2;
  const first = opts.firstStart ?? "18:20";
  const maxSlots = opts.maxSlots ?? 7;
  const order = opts.order ?? [];
  if (!(demoMin > 0 && qaMin >= 0 && maxSlots >= 1)) throw new Error("demoMin must be > 0, qaMin >= 0, maxSlots >= 1");
  const t0 = toMin(first);
  const slots: Slot[] = [];
  for (let i = 0; i < maxSlots; i++) {
    const s = t0 + i * (demoMin + qaMin);
    slots.push({ slot: i + 1, start: fmt(s), demoEnds: fmt(s + demoMin), end: fmt(s + demoMin + qaMin), projectId: order[i] ?? null });
  }
  return {
    date: "2027-02-18",
    tz: "SGT",
    demoMin,
    qaMin,
    firstStart: first,
    slots,
    overflow: Math.max(0, order.length - maxSlots),
    window: `${first}-${slots[slots.length - 1]!.end}`,
    peerGallery: `${slots[slots.length - 1]!.end}-${fmt(toMin(slots[slots.length - 1]!.end) + 15)}`,
  };
}
