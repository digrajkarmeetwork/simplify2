// Client-safe sales constants + types. No server imports here, so both client
// components and server queries can depend on it. The server-only query
// functions live in lib/queries/sales.ts.

import type { Channel } from "@/lib/connectors/types";

export const CHANNELS: Channel[] = [
  "in_store",
  "call_center",
  "uber_eats",
  "skip_dishes",
];

export const CHANNEL_LABEL: Record<Channel, string> = {
  in_store: "In-store",
  call_center: "Call-center",
  uber_eats: "Uber Eats",
  skip_dishes: "Skip",
};

export interface ChannelTotals {
  in_store: number;
  call_center: number;
  uber_eats: number;
  skip_dishes: number;
  total: number;
}

export interface MonthDayRow {
  date: string; // YYYY-MM-DD
  day: number;
  in_store: number | null;
  call_center: number | null;
  uber_eats: number | null;
  skip_dishes: number | null;
  total: number;
  isClosed: boolean;
  needsReview: boolean;
}

export interface MonthMatrix {
  year: number;
  month: number; // 1-based
  rows: MonthDayRow[];
  totals: ChannelTotals;
}
