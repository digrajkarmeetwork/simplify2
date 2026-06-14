import { createClient } from "@/lib/supabase/server";
import type { Channel } from "@/lib/connectors/types";
import {
  ymd,
  today,
  addDays,
  startOfMonth,
  addMonths,
  daysInMonth,
} from "@/lib/dates";
import { type ChannelTotals, type MonthMatrix, type MonthDayRow } from "@/lib/sales-shared";

// Re-export client-safe constants/types so existing server importers keep working.
export {
  CHANNELS,
  CHANNEL_LABEL,
  type ChannelTotals,
  type MonthDayRow,
  type MonthMatrix,
} from "@/lib/sales-shared";

interface EntryRow {
  entry_date: string;
  channel: Channel;
  amount: number;
  status: "confirmed" | "needs_review";
}

function emptyTotals(): ChannelTotals {
  return { in_store: 0, call_center: 0, uber_eats: 0, skip_dishes: 0, total: 0 };
}

function sumWithin(
  rows: EntryRow[],
  fromISO: string,
  toISO: string,
): ChannelTotals {
  const t = emptyTotals();
  for (const r of rows) {
    if (r.entry_date < fromISO || r.entry_date > toISO) continue;
    t[r.channel] += r.amount;
    t.total += r.amount;
  }
  return t;
}

async function fetchEntries(
  businessId: string,
  fromISO: string,
  toISO: string,
): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_entries")
    .select("entry_date,channel,amount,status")
    .eq("business_id", businessId)
    .gte("entry_date", fromISO)
    .lte("entry_date", toISO);
  return (data ?? []) as EntryRow[];
}

export interface DashboardData {
  todayTotals: ChannelTotals;
  todayPrev: number;
  weekTotals: ChannelTotals;
  weekPrev: number;
  monthTotals: ChannelTotals;
  monthPrev: number;
  trend: { date: string; total: number }[];
  channelMix: ChannelTotals; // month-to-date
}

/** KPIs, trend, and channel mix for the dashboard cards + charts. */
export async function getDashboardData(
  businessId: string,
): Promise<DashboardData> {
  const now = today();
  const monthStart = startOfMonth(now);
  const prevMonthStart = addMonths(now, -1);

  // One fetch covers month-to-date, prior-month equivalent, last 30 days, week.
  const rows = await fetchEntries(businessId, ymd(prevMonthStart), ymd(now));

  const todayISO = ymd(now);
  const yesterdayISO = ymd(addDays(now, -1));

  const weekFrom = ymd(addDays(now, -6));
  const weekPrevFrom = ymd(addDays(now, -13));
  const weekPrevTo = ymd(addDays(now, -7));

  const dayOfMonth = now.getUTCDate();
  const prevMonthEquivTo = ymd(addDays(prevMonthStart, dayOfMonth - 1));

  // 30-day trend.
  const trend: { date: string; total: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dISO = ymd(addDays(now, -i));
    trend.push({ date: dISO, total: sumWithin(rows, dISO, dISO).total });
  }

  return {
    todayTotals: sumWithin(rows, todayISO, todayISO),
    todayPrev: sumWithin(rows, yesterdayISO, yesterdayISO).total,
    weekTotals: sumWithin(rows, weekFrom, todayISO),
    weekPrev: sumWithin(rows, weekPrevFrom, weekPrevTo).total,
    monthTotals: sumWithin(rows, ymd(monthStart), todayISO),
    monthPrev: sumWithin(rows, ymd(prevMonthStart), prevMonthEquivTo).total,
    trend,
    channelMix: sumWithin(rows, ymd(monthStart), todayISO),
  };
}

/** Per-day grid for a month, mirroring the manual spreadsheet layout. */
export async function getMonthMatrix(
  businessId: string,
  year: number,
  month: number,
): Promise<MonthMatrix> {
  const supabase = await createClient();
  const fromISO = ymd(new Date(Date.UTC(year, month - 1, 1)));
  const toISO = ymd(new Date(Date.UTC(year, month - 1, daysInMonth(year, month))));

  const [entriesRes, closedRes] = await Promise.all([
    supabase
      .from("sales_entries")
      .select("entry_date,channel,amount,status")
      .eq("business_id", businessId)
      .gte("entry_date", fromISO)
      .lte("entry_date", toISO),
    supabase
      .from("day_status")
      .select("day_date,is_closed")
      .eq("business_id", businessId)
      .gte("day_date", fromISO)
      .lte("day_date", toISO),
  ]);

  const entries = (entriesRes.data ?? []) as EntryRow[];
  const closed = new Set(
    ((closedRes.data ?? []) as { day_date: string; is_closed: boolean }[])
      .filter((c) => c.is_closed)
      .map((c) => c.day_date),
  );

  const byDate = new Map<string, EntryRow[]>();
  for (const e of entries) {
    const list = byDate.get(e.entry_date) ?? [];
    list.push(e);
    byDate.set(e.entry_date, list);
  }

  const totals = emptyTotals();
  const rows: MonthDayRow[] = [];
  const n = daysInMonth(year, month);
  for (let day = 1; day <= n; day++) {
    const dISO = ymd(new Date(Date.UTC(year, month - 1, day)));
    const dayEntries = byDate.get(dISO) ?? [];
    const cell = (ch: Channel): number | null => {
      const found = dayEntries.filter((e) => e.channel === ch);
      if (found.length === 0) return null;
      return found.reduce((s, e) => s + e.amount, 0);
    };
    const inStore = cell("in_store");
    const callCenter = cell("call_center");
    const uber = cell("uber_eats");
    const skip = cell("skip_dishes");
    const rowTotal =
      (inStore ?? 0) + (callCenter ?? 0) + (uber ?? 0) + (skip ?? 0);

    totals.in_store += inStore ?? 0;
    totals.call_center += callCenter ?? 0;
    totals.uber_eats += uber ?? 0;
    totals.skip_dishes += skip ?? 0;
    totals.total += rowTotal;

    rows.push({
      date: dISO,
      day,
      in_store: inStore,
      call_center: callCenter,
      uber_eats: uber,
      skip_dishes: skip,
      total: rowTotal,
      isClosed: closed.has(dISO),
      needsReview: dayEntries.some((e) => e.status === "needs_review"),
    });
  }

  return { year, month, rows, totals };
}
