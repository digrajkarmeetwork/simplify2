"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHANNEL_LABEL } from "@/lib/sales-shared";
import { upsertManualEntry, confirmEntry } from "@/lib/actions/entries";
import type { ReviewEntry } from "@/lib/queries/review";

function ReviewRow({ entry }: { entry: ReviewEntry }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(entry.amount));
  const [pending, start] = useTransition();
  const changed = amount !== String(entry.amount);

  function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return;
    start(async () => {
      const res = changed
        ? await upsertManualEntry(entry.business_id, entry.entry_date, entry.channel, value)
        : await confirmEntry(entry.business_id, entry.entry_date, entry.channel);
      if (res.ok) router.refresh();
    });
  }

  const confidencePct =
    entry.confidence !== null ? `${Math.round(entry.confidence * 100)}%` : "—";

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" />
          {entry.business_name}
        </div>
        <div className="text-xs text-muted-foreground">
          {entry.entry_date} · {CHANNEL_LABEL[entry.channel]} · confidence{" "}
          {confidencePct}
          {entry.image_url ? " · 📷 receipt" : ""}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          inputMode="decimal"
          value={amount}
          disabled={pending}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-28 text-right tabular-nums"
        />
        <Button size="sm" onClick={save} disabled={pending}>
          {changed ? "Save" : "Confirm"}
        </Button>
      </div>
    </Card>
  );
}

export function ReviewList({ entries }: { entries: ReviewEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nothing to review. AI-parsed entries with low confidence show up here.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <ReviewRow key={`${e.business_id}-${e.entry_date}-${e.channel}`} entry={e} />
      ))}
    </div>
  );
}
