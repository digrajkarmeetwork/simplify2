"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Channel } from "@/lib/connectors/types";

const CHANNELS: Channel[] = [
  "in_store",
  "call_center",
  "uber_eats",
  "skip_dishes",
];

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Manually set (or correct) one channel's amount for a day. Upserts on the same
 * unique key the webhook uses, so manual edits and AI ingestion converge.
 * RLS ensures the caller owns the business.
 */
export async function upsertManualEntry(
  businessId: string,
  entryDate: string,
  channel: Channel,
  amount: number,
): Promise<ActionResult> {
  if (!CHANNELS.includes(channel)) return { ok: false, error: "bad_channel" };
  if (!Number.isFinite(amount) || amount < 0)
    return { ok: false, error: "bad_amount" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate))
    return { ok: false, error: "bad_date" };

  const supabase = await createClient();
  const { error } = await supabase.from("sales_entries").upsert(
    {
      business_id: businessId,
      entry_date: entryDate,
      channel,
      amount,
      source: "manual",
      status: "confirmed",
      confidence: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id,entry_date,channel" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
