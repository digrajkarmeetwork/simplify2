import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export type PendingAction = "store_mode" | "edit";

export interface PendingState {
  action: PendingAction;
  options: Record<string, unknown>;
}

/** Set (replacing) a sender's pending state for one action. */
export async function setPending(
  sender: string,
  action: PendingAction,
  options: Record<string, unknown>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("conversation_state")
    .delete()
    .eq("sender", sender)
    .eq("pending_action", action);
  await supabase.from("conversation_state").insert({
    sender,
    pending_action: action,
    options,
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });
}

/** Current non-expired pending state for a sender + action, or null. */
export async function getPending(
  sender: string,
  action: PendingAction,
): Promise<PendingState | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("conversation_state")
    .select("pending_action, options, expires_at")
    .eq("sender", sender)
    .eq("pending_action", action)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
    await clearPending(sender, action);
    return null;
  }
  return {
    action: data.pending_action as PendingAction,
    options: (data.options as Record<string, unknown>) ?? {},
  };
}

export async function clearPending(
  sender: string,
  action: PendingAction,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("conversation_state")
    .delete()
    .eq("sender", sender)
    .eq("pending_action", action);
}
