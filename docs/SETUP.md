# Local setup

## 1. Supabase project
1. Create a project at https://supabase.com/dashboard.
2. **Settings → API**: copy the **Project URL**, the **anon public** key, and the **service_role secret** key.

## 2. Apply the schema
In the Supabase **SQL Editor**, run the migrations in order (paste each file's contents and Run):
1. `supabase/migrations/0001_init.sql` — tables, enums, constraints, RLS
2. `supabase/migrations/0002_storage.sql` — private `receipts` Storage bucket
3. `supabase/migrations/0003_realtime.sql` — Realtime on `sales_entries`

## 3. Auth redirect URLs
**Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/**` (add your Vercel URL later)

Email (magic link) auth is enabled by default — no extra setup.

## 4. Environment
Copy `.env.local.example` to `.env.local` and fill in at least the Supabase values:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```
(WhatsApp / Anthropic / Resend keys are needed for ingestion + email, not for the dashboard smoke test.)

## 5. Seed a test business
```
npm run seed                 # uses digrajkarmeet@gmail.com by default
# or: node --env-file=.env.local scripts/seed.mjs you@example.com [whatsappPhone]
```
Creates the user, a "Pizzaville (Test)" business, and 12 days of sample sales.

## 6. Run
```
npm run dev
```
Open http://localhost:3000 → sign in with a magic link → dashboard.
