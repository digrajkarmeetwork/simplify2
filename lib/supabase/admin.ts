import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. **Server-only.** Bypasses RLS — use exclusively
 * for trusted server work like the WhatsApp webhook ingestion path, never in code
 * that runs in the browser or handles untrusted callers without its own auth check.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
