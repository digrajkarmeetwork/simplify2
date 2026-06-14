import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthMatrix } from "@/lib/queries/sales";
import { buildWorkbook } from "@/lib/export/buildWorkbook";
import { buildPdf } from "@/lib/export/buildPdf";
import { exportFilename } from "@/lib/export/monthLabel";

export const runtime = "nodejs";

/**
 * Download a month's sales as Excel or PDF.
 * GET /api/export?b=<businessId>&m=YYYY-MM&format=xlsx|pdf
 * RLS + an explicit ownership check ensure a user can only export their own data.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const businessId = searchParams.get("b");
  const period = searchParams.get("m");
  const format = searchParams.get("format") === "pdf" ? "pdf" : "xlsx";

  if (!businessId || !period || !/^\d{4}-\d{2}$/.test(period)) {
    return new Response("bad request", { status: 400 });
  }
  const [year, month] = period.split("-").map(Number);

  const supabase = await createClient();
  const { data: biz } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  if (!biz) return new Response("not found", { status: 404 });

  const matrix = await getMonthMatrix(businessId, year, month);
  const name = exportFilename(biz.name as string, year, month);

  if (format === "pdf") {
    const buf = await buildPdf(matrix, biz.name as string);
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${name}.pdf"`,
      },
    });
  }

  const buf = buildWorkbook(matrix, biz.name as string);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
