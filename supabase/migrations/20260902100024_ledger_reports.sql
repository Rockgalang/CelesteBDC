-- Client-facing "sales/expense report" ledger — a lightweight, client-
-- owned CSV-style register distinct from Cel's official books
-- (journal_entries, which stay staff/approval-gated per Phase 2). This is
-- the client's own informal running log: every uploaded receipt tags
-- itself sale or expense and shows up here automatically, and the client
-- can also type in quick entries directly (no photo required) the way
-- they'd use a spreadsheet register. Cel's staff can read all of it too,
-- as a reference while doing the real bookkeeping — it never itself posts
-- to the accounting engine.

create type public.report_entry_type as enum ('sale', 'expense');

alter table public.receipts
  add column entry_type public.report_entry_type not null default 'expense';

create table public.manual_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  entry_type public.report_entry_type not null,
  entry_date date not null default current_date,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

comment on table public.manual_ledger_entries is
  'Client-typed sales/expense rows with no receipt photo — the "spreadsheet register" half of the /reports ledger. Fully client-owned (RLS lets client_admin/client_user CRUD their own client''s rows), unlike every other financial table in this schema.';

create trigger set_updated_at
  before update on public.manual_ledger_entries
  for each row execute function public.set_updated_at();

create index manual_ledger_entries_client_id_idx on public.manual_ledger_entries (client_id);

create trigger audit_manual_ledger_entries
  after insert or update or delete on public.manual_ledger_entries
  for each row execute function public.audit_row_change();

alter table public.manual_ledger_entries enable row level security;

create policy manual_ledger_entries_internal_all on public.manual_ledger_entries
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

-- Deliberately `for all`, not split select/insert/update: this table is
-- the client's own record, so client_admin AND client_user may fully
-- manage their own client's rows (no role restriction, unlike billing).
create policy manual_ledger_entries_own_client_all on public.manual_ledger_entries
  for all
  using (client_id = public.current_profile_client_id())
  with check (client_id = public.current_profile_client_id());
