const CAD0 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const CAD2 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Whole-dollar currency, e.g. $1,240. */
export function money(n: number): string {
  return CAD0.format(n);
}

/** Cent-precise currency, e.g. $1,240.50. */
export function money2(n: number): string {
  return CAD2.format(n);
}

/** Percent change cur vs prev. null when there's no baseline to compare to. */
export function deltaPct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}
