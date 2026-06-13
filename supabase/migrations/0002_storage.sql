-- Private bucket for receipt images. Uploads + reads happen via the service-role
-- key (webhook ingest / server-generated signed URLs), so no public access and
-- no per-user storage policies are needed.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;
