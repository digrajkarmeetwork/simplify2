import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";

/**
 * Shell for all signed-in routes: mobile-first column with a sticky bottom nav.
 * Auth is enforced in middleware; this is a defense-in-depth check.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <main className="flex-1 px-4 pb-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
