import Link from "next/link";
import { getBusinesses } from "@/lib/queries/businesses";
import { getDashboardData, getMonthMatrix } from "@/lib/queries/sales";
import { today } from "@/lib/dates";
import { SignOutButton } from "@/components/sign-out-button";
import { BusinessSwitcher } from "@/components/business-switcher";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SalesTrendChart } from "@/components/dashboard/sales-trend-chart";
import { ChannelMixChart } from "@/components/dashboard/channel-mix-chart";
import { MonthlyTable } from "@/components/dashboard/monthly-table";
import { RealtimeRefresh } from "@/components/dashboard/realtime-refresh";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseMonth(m: string | undefined): { year: number; month: number } {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) return { year: y, month: mo };
  }
  const t = today();
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string; m?: string }>;
}) {
  const { b, m } = await searchParams;
  const businesses = await getBusinesses();

  if (businesses.length === 0) {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <SignOutButton />
        </header>
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No business yet. Add one in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>{" "}
          to start tracking sales.
        </div>
      </div>
    );
  }

  const current =
    businesses.find((x) => x.id === b)?.id ?? businesses[0].id;
  const { year, month } = parseMonth(m);

  const [data, matrix] = await Promise.all([
    getDashboardData(current),
    getMonthMatrix(current, year, month),
  ]);

  const q = (mm: string) => `/dashboard?b=${current}&m=${mm}`;

  return (
    <div className="space-y-5">
      <RealtimeRefresh businessId={current} />

      <header className="flex items-center justify-between gap-2">
        <BusinessSwitcher businesses={businesses} currentId={current} />
        <SignOutButton />
      </header>

      <KpiCards
        today={data.todayTotals}
        todayPrev={data.todayPrev}
        week={data.weekTotals}
        weekPrev={data.weekPrev}
        month={data.monthTotals}
        monthPrev={data.monthPrev}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SalesTrendChart data={data.trend} />
        <ChannelMixChart totals={data.channelMix} />
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            {MONTHS[month - 1]} {year}
          </h2>
          <div className="flex gap-1 text-sm">
            <Link
              href={q(shiftMonth(year, month, -1))}
              className="rounded border px-2 py-1 hover:bg-muted"
              aria-label="Previous month"
            >
              ‹
            </Link>
            <Link
              href={q(shiftMonth(year, month, 1))}
              className="rounded border px-2 py-1 hover:bg-muted"
              aria-label="Next month"
            >
              ›
            </Link>
          </div>
        </div>
        <MonthlyTable businessId={current} matrix={matrix} />
      </section>
    </div>
  );
}
