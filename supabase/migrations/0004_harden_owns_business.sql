-- Move the owns_business() RLS helper out of the API-exposed `public` schema
-- into `private`, so it can't be invoked directly via PostgREST RPC.
-- (Resolves Supabase security advisor 0028/0029 for this function.)
create schema if not exists private;

create or replace function private.owns_business(b uuid)
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

revoke all on function private.owns_business(uuid) from public;
grant execute on function private.owns_business(uuid) to authenticated;

-- Repoint the child-table policies at the private helper.
drop policy sales_entries_owner_all on sales_entries;
create policy sales_entries_owner_all on sales_entries
  for all using (private.owns_business(business_id))
  with check (private.owns_business(business_id));

drop policy business_settings_owner_all on business_settings;
create policy business_settings_owner_all on business_settings
  for all using (private.owns_business(business_id))
  with check (private.owns_business(business_id));

drop policy day_status_owner_all on day_status;
create policy day_status_owner_all on day_status
  for all using (private.owns_business(business_id))
  with check (private.owns_business(business_id));

drop policy monthly_email_log_owner_all on monthly_email_log;
create policy monthly_email_log_owner_all on monthly_email_log
  for all using (private.owns_business(business_id))
  with check (private.owns_business(business_id));

drop function public.owns_business(uuid);
