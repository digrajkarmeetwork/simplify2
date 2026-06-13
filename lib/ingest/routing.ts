import { createAdminClient } from "@/lib/supabase/admin";

/** Resolve a WhatsApp sender phone to its owning user, or null if not whitelisted. */
export async function resolveSenderUser(phone: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("whatsapp_senders")
    .select("user_id")
    .eq("phone", phone)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

export type BusinessMatch =
  | { kind: "matched"; businessId: string; businessName: string }
  | { kind: "none" } // the user has no businesses yet
  | { kind: "ambiguous"; options: { id: string; name: string }[] };

interface BusinessRow {
  id: string;
  name: string;
  location_label: string | null;
  match_keywords: string[] | null;
}

/**
 * Pick the business a receipt belongs to. A single business auto-matches;
 * with several, score `business_identifier` against each business's keywords.
 * Genuine ambiguity is returned for the Phase 3 "which store?" flow.
 */
export async function matchBusiness(
  userId: string,
  identifier: string,
): Promise<BusinessMatch> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("businesses")
    .select("id,name,location_label,match_keywords")
    .eq("owner_id", userId);

  const businesses = (data ?? []) as BusinessRow[];
  if (businesses.length === 0) return { kind: "none" };
  if (businesses.length === 1) {
    return {
      kind: "matched",
      businessId: businesses[0].id,
      businessName: businesses[0].name,
    };
  }

  const id = identifier.toLowerCase();
  const scored = businesses
    .map((b) => {
      const keys = [b.name, b.location_label, ...(b.match_keywords ?? [])]
        .filter((s): s is string => !!s)
        .map((s) => s.toLowerCase());
      const score = keys.reduce((n, k) => (id.includes(k) ? n + 1 : n), 0);
      return { b, score };
    })
    .sort((x, y) => y.score - x.score);

  const clearWinner =
    scored[0].score > 0 &&
    (scored.length < 2 || scored[0].score > scored[1].score);

  if (clearWinner) {
    return {
      kind: "matched",
      businessId: scored[0].b.id,
      businessName: scored[0].b.name,
    };
  }
  return {
    kind: "ambiguous",
    options: businesses.map((b) => ({ id: b.id, name: b.name })),
  };
}
