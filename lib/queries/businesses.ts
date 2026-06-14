import { createClient } from "@/lib/supabase/server";

export interface BusinessSummary {
  id: string;
  name: string;
  location_label: string | null;
}

/** All businesses owned by the signed-in user (RLS-scoped). */
export async function getBusinesses(): Promise<BusinessSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("id,name,location_label")
    .order("name", { ascending: true });
  return (data ?? []) as BusinessSummary[];
}
