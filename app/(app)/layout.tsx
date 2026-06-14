import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, BottomNav } from "@/components/app-nav";

/**
 * Shell for all signed-in routes. Mobile: single column + sticky bottom nav.
 * Desktop (md+): left sidebar + a wider, centered content area.
 * Auth is enforced in the proxy; this is a defense-in-depth check.
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
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
