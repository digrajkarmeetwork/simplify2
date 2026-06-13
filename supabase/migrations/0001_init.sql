-- Simplify2 — initial schema, constraints, and RLS
-- Generated for Phase 0 (issues #3, #4). Apply with `supabase db push` or the SQL editor.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type channel       as enum ('in_store', 'call_center', 'uber_eats', 'skip_dishes');
create type entry_source  as enum ('whatsapp_ai', 'manual', 'api');
create type entry_status  as enum ('confirmed', 'needs_review');
create type export_format as enum ('xlsx', 'pdf', 'both');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A business == a single location. Each has its own separate dashboard.
create table businesses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  location_label text,
  timezone       text not null default 'America/Toronto',
  match_keywords text[] not null default '{}',   -- store address/number used to auto-route a receipt
  created_at     timestamptz not null default now()
);
create index businesses_owner_idx on businesses (owner_id);

-- Whitelist mapping an owner's WhatsApp number -> their account. Unknown senders are ignored.
create table whatsapp_senders (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- One sales figure for one (business, day, channel). Re-sending a receipt corrects, not duplicates.
create table sales_entries (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references businesses (id) on delete cascade,
  entry_date     date not null,
  channel        channel not null,
  amount         numeric(12, 2) not null,
  source         entry_source not null default 'whatsapp_ai',
  confidence     numeric(4, 3),                 -- 0..1, from the AI parse
  status         entry_status not null default 'needs_review',
  image_url      text,                          -- private Storage path to the source receipt
  raw_extraction jsonb,                         -- full parser output for audit/debug
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (business_id, entry_date, channel)
);
create index sales_entries_business_date_idx on sales_entries (business_id, entry_date);
create index sales_entries_status_idx on sales_entries (status);

-- Raw inbound-message audit log -> idempotency + retry.
create table whatsapp_messages (
  id         uuid primary key default gen_random_uuid(),
  wam_id     text not null unique,              -- Meta message id (dedupe key)
  sender     text,
  media_id   text,
  status     text,
  error      text,
  created_at timestamptz not null default now()
);

-- Short-lived "which store?" disambiguation state, keyed by sender phone.
create table conversation_state (
  id             uuid primary key default gen_random_uuid(),
  sender         text not null,
  pending_action text,
  options        jsonb,
  expires_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index conversation_state_sender_idx on conversation_state (sender);

-- Per-business email/export preferences.
create table business_settings (
  business_id        uuid primary key references businesses (id) on delete cascade,
  auto_email_enabled boolean not null default false,
  email_recipients   text[] not null default '{}',
  export_format      export_format not null default 'xlsx',
  updated_at         timestamptz not null default now()
);

-- Lets the owner mark a specific day "closed / no sales" so it counts as filled for completeness.
create table day_status (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  day_date    date not null,
  is_closed   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (business_id, day_date)
);

-- One row per completed month emailed -> guarantees exactly-once auto-send.
create table monthly_email_log (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  period      text not null,                    -- 'YYYY-MM'
  status      text,
  recipients  text[],
  file_refs   jsonb,
  sent_at     timestamptz not null default now(),
  unique (business_id, period)
);

-- ---------------------------------------------------------------------------
-- Ownership helper (SECURITY DEFINER so child-table policies don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.owns_business(b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.businesses
    where id = b and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table businesses        enable row level security;
alter table whatsapp_senders  enable row level security;
alter table sales_entries     enable row level security;
alter table whatsapp_messages enable row level security;
alter table conversation_state enable row level security;
alter table business_settings enable row level security;
alter table day_status        enable row level security;
alter table monthly_email_log enable row level security;

-- businesses: owner-only, full access.
create policy businesses_owner_all on businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- whatsapp_senders: a user manages only their own mapped numbers.
create policy senders_owner_all on whatsapp_senders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Child tables: access gated by business ownership.
create policy sales_entries_owner_all on sales_entries
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy business_settings_owner_all on business_settings
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy day_status_owner_all on day_status
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

create policy monthly_email_log_owner_all on monthly_email_log
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- Webhook-internal tables: readable by the owner of the mapped sender; all writes
-- happen via the service-role key, which bypasses RLS. No client-side write policy.
create policy whatsapp_messages_owner_read on whatsapp_messages
  for select using (
    exists (
      select 1 from whatsapp_senders s
      where s.phone = whatsapp_messages.sender and s.user_id = auth.uid()
    )
  );

create policy conversation_state_owner_read on conversation_state
  for select using (
    exists (
      select 1 from whatsapp_senders s
      where s.phone = conversation_state.sender and s.user_id = auth.uid()
    )
  );
