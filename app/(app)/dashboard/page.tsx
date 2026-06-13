import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <SignOutButton />
      </header>

      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No sales yet. Send a daily receipt photo to your WhatsApp number and it
        will appear here.
      </div>
    </div>
  );
}
