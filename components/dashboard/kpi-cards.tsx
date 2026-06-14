import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money, deltaPct } from "@/lib/format";
import { CHANNELS, CHANNEL_LABEL, type ChannelTotals } from "@/lib/sales-shared";

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = deltaPct(cur, prev);
  if (d === null)
    return <span className="text-xs text-muted-foreground">new</span>;
  const up = d >= 0;
  return (
    <span
      className={up ? "text-xs text-emerald-600" : "text-xs text-red-600"}
    >
      {up ? "▲" : "▼"} {Math.abs(d).toFixed(0)}%
    </span>
  );
}

function KpiCard({
  label,
  sub,
  totals,
  prevTotal,
}: {
  label: string;
  sub: string;
  totals: ChannelTotals;
  prevTotal: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-baseline justify-between text-sm font-medium text-muted-foreground">
          <span>{label}</span>
          <Delta cur={totals.total} prev={prevTotal} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-semibold tracking-tight">
          {money(totals.total)}
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {CHANNELS.map((ch) => (
            <div key={ch} className="flex justify-between">
              <dt className="text-muted-foreground">{CHANNEL_LABEL[ch]}</dt>
              <dd>{money(totals[ch])}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function KpiCards({
  today,
  todayPrev,
  week,
  weekPrev,
  month,
  monthPrev,
}: {
  today: ChannelTotals;
  todayPrev: number;
  week: ChannelTotals;
  weekPrev: number;
  month: ChannelTotals;
  monthPrev: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard label="Today" sub="vs yesterday" totals={today} prevTotal={todayPrev} />
      <KpiCard label="This week" sub="vs prior 7 days" totals={week} prevTotal={weekPrev} />
      <KpiCard label="This month" sub="vs same days last month" totals={month} prevTotal={monthPrev} />
    </div>
  );
}
