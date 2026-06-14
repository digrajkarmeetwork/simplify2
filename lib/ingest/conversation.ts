import { createAdminClient } from "@/lib/supabase/admin";

const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface PendingState {
  action: "pick_business" | "edit";
  options: Record<string, unknown>;
}

/** Replace any existing pending state for a sender with a new one. */
export async function setPending(
  sender: string,
  action: PendingState["action"],
  options: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("conversation_state").delete().eq("sender", sender);
  await supabase.from("conversation_state").insert({
    sender,
    pending_action: action,
    options,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
}

/** Current non-expired pending state for a sender, or null. */
export async function getPending(sender: string): Promise<PendingState | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("conversation_state")
    .select("pending_action, options, expires_at")
    .eq("sender", sender)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
    await clearPending(sender);
    return null;
  }
  return {
    action: data.pending_action as PendingState["action"],
    options: (data.options as Record<string, unknown>) ?? {},
  };
}

export async function clearPending(sender: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("conversation_state").delete().eq("sender", sender);
}
