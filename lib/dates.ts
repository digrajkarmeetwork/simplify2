// Calendar-date helpers. Dates are handled as YYYY-MM-DD strings in UTC to keep
// math stable; sales entry_date is a plain calendar date. (Per-business timezone
// refinement is a later concern — noted in docs/PLAN.md.)

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Number of days in the given year/month (month is 1-based). */
export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Today's date at server time, as a UTC calendar Date. */
export function today(): Date {
  return parseYmd(ymd(new Date()));
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Short weekday for a YYYY-MM-DD date, e.g. "Sat". */
export function weekdayShort(ymdStr: string): string {
  return WEEKDAYS_SHORT[parseYmd(ymdStr).getUTCDay()];
}
