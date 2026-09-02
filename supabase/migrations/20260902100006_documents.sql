-- Document vault (build spec §2.3, §6.4). Files themselves live in a
-- private Supabase Storage bucket (see 20260902100009_storage.sql); this
-- table is the metadata/retention/audit layer in front of it. Never expose
-- storage_path directly to clients — always mint a short-lived signed URL
-- server-side.

create type public.document_source as enum ('portal', 'internal', 'generated');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  category text not null,
  filename text not null,
  storage_path text not null unique,
  mime text not null,
  bytes bigint not null,
  sha256 text not null,
  uploaded_by uuid references auth.users (id),
  source public.document_source not null default 'portal',
  issued_date date,
  expires_at date,
  -- BIR requires records retained 10 years from filing; default to 10
  -- years from upload for documents with no independent filing date.
  -- Phase 3 (tax filings) will override this to filing_date + 10y.
  retention_until date not null default (current_date + interval '10 years'),
  superseded_by uuid references public.documents (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create index documents_client_id_idx on public.documents (client_id);
create index documents_expires_at_idx on public.documents (expires_at)
  where expires_at is not null;
create index documents_category_idx on public.documents (category);

-- Retention enforcement: block deletion before retention_until unless the
-- caller is `owner` AND has supplied a reason via
-- set_config('celeste.retention_override_reason', ..., true) for the
-- duration of the transaction. The reason is picked up by the audit
-- trigger (20260902100007_audit_log.sql) so the override is always logged.
create or replace function public.enforce_document_retention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  override_reason text;
begin
  if old.retention_until > current_date then
    if not public.is_owner() then
      raise exception 'Document % is retained until % and cannot be deleted (BIR 10-year retention). Only owner can override.',
        old.id, old.retention_until;
    end if;

    override_reason := nullif(current_setting('celeste.retention_override_reason', true), '');
    if override_reason is null then
      raise exception 'Document % is retained until %. An owner override requires a logged reason: set_config(''celeste.retention_override_reason'', <reason>, true) before deleting.',
        old.id, old.retention_until;
    end if;
  end if;

  return old;
end;
$$;

create trigger enforce_document_retention
  before delete on public.documents
  for each row execute function public.enforce_document_retention();
