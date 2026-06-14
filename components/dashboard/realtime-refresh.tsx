"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribes to sales_entries changes for one business and refreshes the
 * server-rendered dashboard so new/edited entries appear without a reload.
 */
export function RealtimeRefresh({ businessId }: { businessId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`sales_entries:${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales_entries",
          filter: `business_id=eq.${businessId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, router]);

  return null;
}
