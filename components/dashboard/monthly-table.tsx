"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { money2 } from "@/lib/format";
import { upsertManualEntry } from "@/lib/actions/entries";
import { CHANNELS, CHANNEL_LABEL, type MonthMatrix } from "@/lib/sales-shared";
import type { Channel } from "@/lib/connectors/types";
import { cn } from "@/lib/utils";

function EditableCell({
  businessId,
  date,
  channel,
  value,
}: {
  businessId: string;
  date: string;
  channel: Channel;
  value: number | null;
}) {
  const router = useRouter();
  const original = value === null ? "" : String(value);
  const [val, setVal] = useState(original);
  const [pending, start] = useTransition();

  function commit() {
    if (val === original) return;
    if (val === "") return setVal(original); // clearing isn't a delete (v1)
    const amount = Number(val);
    if (!Number.isFinite(amount) || amount < 0) return setVal(original);

    start(async () => {
      const res = await upsertManualEntry(businessId, date, channel, amount);
      if (!res.ok) setVal(original);
      router.refresh();
    });
  }

  return (
    <input
      inputMode="decimal"
      value={val}
      disabled={pending}
      onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setVal(original);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="—"
      className={cn(
        "w-16 rounded bg-transparent px-1 py-0.5 text-right text-sm tabular-nums outline-none focus:bg-muted focus:ring-1 focus:ring-ring",
        pending && "opacity-50",
      )}
    />
  );
}

export function MonthlyTable({
  businessId,
  matrix,
}: {
  businessId: string;
  matrix: MonthMatrix;
}) {
  return (
    <Card className="overflow-x-auto py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Day</TableHead>
            {CHANNELS.map((ch) => (
              <TableHead key={ch} className="text-right">
                {CHANNEL_LABEL[ch]}
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matrix.rows.map((row) => (
            <TableRow
              key={row.date}
              className={cn(row.isClosed && "text-muted-foreground")}
            >
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-1">
                  {row.day}
                  {row.needsReview && (
                    <span
                      className="size-1.5 rounded-full bg-amber-500"
                      title="Needs review"
                    />
                  )}
                </span>
              </TableCell>
              {CHANNELS.map((ch) => (
                <TableCell key={ch} className="p-0 text-right">
                  {row.isClosed ? (
                    <span className="px-1 text-xs">closed</span>
                  ) : (
                    <EditableCell
                      businessId={businessId}
                      date={row.date}
                      channel={ch}
                      value={row[ch]}
                    />
                  )}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">
                {row.total > 0 ? money2(row.total) : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-medium">Total</TableCell>
            {CHANNELS.map((ch) => (
              <TableCell key={ch} className="text-right tabular-nums">
                {money2(matrix.totals[ch])}
              </TableCell>
            ))}
            <TableCell className="text-right font-semibold tabular-nums">
              {money2(matrix.totals.total)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}
