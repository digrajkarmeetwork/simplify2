"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";

export function SalesTrendChart({
  data,
}: {
  data: { date: string; total: number }[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: d.date.slice(5), // MM-DD
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Last 30 days
        </CardTitle>
      </CardHeader>
      <CardContent className="h-48 px-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis hide />
            <Tooltip
              formatter={(v) => money(Number(v ?? 0))}
              labelFormatter={(l) => `Day ${l}`}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#trendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
