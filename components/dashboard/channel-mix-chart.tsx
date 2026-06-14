"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import { CHANNELS, CHANNEL_LABEL, type ChannelTotals } from "@/lib/sales-shared";

const COLORS: Record<string, string> = {
  in_store: "#2563eb",
  call_center: "#16a34a",
  uber_eats: "#000000",
  skip_dishes: "#ea580c",
};

export function ChannelMixChart({ totals }: { totals: ChannelTotals }) {
  const data = CHANNELS.map((ch) => ({
    key: ch,
    name: CHANNEL_LABEL[ch],
    value: totals[ch],
  })).filter((d) => d.value > 0);

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Channel mix (this month)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
            No sales yet this month
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money(Number(v ?? 0))} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
