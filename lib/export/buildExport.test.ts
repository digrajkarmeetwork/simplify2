import { describe, it, expect } from "vitest";
import { buildWorkbook } from "./buildWorkbook";
import { buildPdf } from "./buildPdf";
import type { MonthMatrix } from "@/lib/sales-shared";

const matrix: MonthMatrix = {
  year: 2026,
  month: 6,
  rows: [
    { date: "2026-06-13", day: 13, in_store: 297.07, call_center: 1537.62, uber_eats: null, skip_dishes: null, total: 1834.69, isClosed: false, needsReview: false },
    { date: "2026-06-14", day: 14, in_store: null, call_center: null, uber_eats: null, skip_dishes: null, total: 0, isClosed: true, needsReview: false },
  ],
  totals: { in_store: 297.07, call_center: 1537.62, uber_eats: 0, skip_dishes: 0, total: 1834.69 },
};

describe("exports", () => {
  it("builds a valid .xlsx (zip magic bytes)", () => {
    const buf = buildWorkbook(matrix, "Pizzaville Woodbine");
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("builds a valid PDF (%PDF magic bytes)", async () => {
    const buf = await buildPdf(matrix, "Pizzaville Woodbine");
    expect(buf.length).toBeGreaterThan(100);
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  });
});
