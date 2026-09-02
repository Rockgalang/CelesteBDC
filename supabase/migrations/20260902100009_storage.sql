-- Private document storage (build spec §2.3): no public URLs, ever —
-- objects are only ever reached through a server-minted signed URL with a
-- 15-minute expiry (see src/lib/documents/signed-url.ts).
--
-- Object path convention: {client_id}/{document_id}-{filename}. Storage
-- RLS below matches on the first path segment, so every upload must be
-- placed under its client's own folder.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_bucket_internal_all on storage.objects
  for all
  using (bucket_id = 'documents' and public.is_owner_or_staff())
  with check (bucket_id = 'documents' and public.is_owner_or_staff());

create policy documents_bucket_select_own_client on storage.objects
  for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_profile_client_id()::text
  );

create policy documents_bucket_insert_own_client on storage.objects
  for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.current_profile_client_id()::text
  );
