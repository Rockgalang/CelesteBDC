-- Private receipt image storage, mirroring 20260902100009_storage.sql's
-- pattern exactly but for the `receipts` table/workflow rather than
-- `documents` — kept as a separate bucket since receipts don't carry the
-- 10-year retention guard documents do, and the two are reviewed through
-- entirely different queues.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy receipts_bucket_internal_all on storage.objects
  for all
  using (bucket_id = 'receipts' and public.is_owner_or_staff())
  with check (bucket_id = 'receipts' and public.is_owner_or_staff());

create policy receipts_bucket_select_own_client on storage.objects
  for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_profile_client_id()::text
  );

create policy receipts_bucket_insert_own_client on storage.objects
  for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = public.current_profile_client_id()::text
  );
