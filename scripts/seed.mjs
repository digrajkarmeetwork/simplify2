// Seed a test user + business + sample sales so the dashboard isn't empty.
// Run: node --env-file=.env.local scripts/seed.mjs [email] [whatsappPhone]
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2] || process.env.SEED_EMAIL || "digrajkarmeet@gmail.com";
const phone = process.argv[3] || process.env.SEED_PHONE || ""; // optional E.164, no '+'

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function findOrCreateUser() {
  const { data: list, error } = await supa.auth.admin.listUsers();
  if (error) throw error;
  const existing = list.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error: cErr } = await supa.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (cErr) throw cErr;
  return data.user.id;
}

async function main() {
  const userId = await findOrCreateUser();
  console.log(`user: ${email} (${userId})`);

  // Business (idempotent on owner + name).
  const name = "Pizzaville (Test)";
  let businessId;
  const { data: existingBiz } = await supa
    .from("businesses")
    .select("id")
    .eq("owner_id", userId)
    .eq("name", name)
    .maybeSingle();

  if (existingBiz) {
    businessId = existingBiz.id;
  } else {
    const { data, error } = await supa
      .from("businesses")
      .insert({
        owner_id: userId,
        name,
        location_label: "Main St",
        match_keywords: ["main", "pizzaville"],
      })
      .select("id")
      .single();
    if (error) throw error;
    businessId = data.id;
  }
  console.log(`business: ${name} (${businessId})`);

  // Map a WhatsApp sender to this user (optional).
  if (phone) {
    await supa
      .from("whatsapp_senders")
      .upsert({ phone, user_id: userId }, { onConflict: "phone" });
    console.log(`whatsapp sender mapped: ${phone}`);
  }

  // Sample sales for the last 12 days (in_store + call_center).
  const rows = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const date = ymd(d);
    const base = 800 + Math.round(Math.sin(i) * 120) + i * 5;
    rows.push(
      {
        business_id: businessId,
        entry_date: date,
        channel: "in_store",
        amount: base,
        source: "manual",
        status: "confirmed",
        confidence: 1,
      },
      {
        business_id: businessId,
        entry_date: date,
        channel: "call_center",
        amount: Math.round(base * 0.4),
        source: "manual",
        status: "confirmed",
        confidence: 1,
      },
    );
  }
  const { error: upErr } = await supa
    .from("sales_entries")
    .upsert(rows, { onConflict: "business_id,entry_date,channel" });
  if (upErr) throw upErr;
  console.log(`seeded ${rows.length} sales entries across 12 days`);

  console.log("\nDone. Sign in with a magic link as", email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
