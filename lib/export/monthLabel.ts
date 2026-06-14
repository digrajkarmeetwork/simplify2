export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "June 2026" */
export function monthLabel(year: number, month1: number): string {
  return `${MONTH_NAMES[month1 - 1]} ${year}`;
}

/** Filesafe slug, e.g. "Pizzaville-Woodbine-2026-06". */
export function exportFilename(businessName: string, year: number, month1: number): string {
  const safe = businessName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${safe}-${year}-${String(month1).padStart(2, "0")}`;
}
