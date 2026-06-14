-- Enable Postgres change feeds for the dashboard's live updates.
alter publication supabase_realtime add table public.sales_entries;
