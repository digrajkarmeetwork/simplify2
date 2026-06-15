"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Handles implicit-flow auth tokens delivered in the URL hash
 * (#access_token=…&refresh_token=…), e.g. from admin-generated magic links.
 * The PKCE `?code=` flow is handled server-side in /auth/callback; this covers
 * the hash case, which the server can't see.
 */
export function HashSessionHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;

    const p = new URLSearchParams(hash.slice(1));
    const access_token = p.get("access_token");
    const refresh_token = p.get("refresh_token");
    if (!access_token || !refresh_token) return;

    const supabase = createClient();
    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      // Strip the tokens out of the address bar regardless of outcome.
      window.history.replaceState(null, "", window.location.pathname);
      if (!error) {
        const next = params.get("next") ?? "/dashboard";
        router.replace(next);
        router.refresh();
      }
    });
  }, [router, params]);

  return null;
}
