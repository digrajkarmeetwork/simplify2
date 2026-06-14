import * as XLSX from "xlsx";
import type { MonthMatrix } from "@/lib/sales-shared";
import { monthLabel } from "@/lib/export/monthLabel";

/** Build an .xlsx workbook of a month's sales, mirroring the manual sheet. */
export function buildWorkbook(matrix: MonthMatrix, businessName: string): Buffer {
  const title = `${businessName} — ${monthLabel(matrix.year, matrix.month)}`;
  const header = ["Day", "In-store", "Call-center", "Uber Eats", "Skip", "Total"];

  const cell = (closed: boolean, v: number | null) =>
    closed ? "closed" : v === null ? "" : v;

  const body = matrix.rows.map((r) => [
    r.day,
    cell(r.isClosed, r.in_store),
    cell(r.isClosed, r.call_center),
    r.uber_eats ?? "",
    r.skip_dishes ?? "",
    r.total || "",
  ]);

  const totals = [
    "Total",
    matrix.totals.in_store,
    matrix.totals.call_center,
    matrix.totals.uber_eats,
    matrix.totals.skip_dishes,
    matrix.totals.total,
  ];

  const aoa = [[title], [], header, ...body, [], totals];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, monthLabel(matrix.year, matrix.month));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
