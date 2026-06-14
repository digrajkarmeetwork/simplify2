import { createClient } from "@/lib/supabase/server";
import type { Channel } from "@/lib/connectors/types";

export interface ReviewEntry {
  business_id: string;
  business_name: string;
  entry_date: string;
  channel: Channel;
  amount: number;
  confidence: number | null;
  image_url: string | null;
}

interface Row {
  business_id: string;
  entry_date: string;
  channel: Channel;
  amount: number;
  confidence: number | null;
  image_url: string | null;
  businesses: { name: string } | { name: string }[] | null;
}

/** All low-confidence entries across the user's businesses, newest first. */
export async function getNeedsReview(): Promise<ReviewEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_entries")
    .select(
      "business_id, entry_date, channel, amount, confidence, image_url, businesses(name)",
    )
    .eq("status", "needs_review")
    .order("entry_date", { ascending: false });

  return ((data ?? []) as Row[]).map((r) => {
    const biz = Array.isArray(r.businesses) ? r.businesses[0] : r.businesses;
    return {
      business_id: r.business_id,
      business_name: biz?.name ?? "Unknown",
      entry_date: r.entry_date,
      channel: r.channel,
      amount: r.amount,
      confidence: r.confidence,
      image_url: r.image_url,
    };
  });
}
