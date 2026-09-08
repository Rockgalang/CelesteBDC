-- CSV ledger import — a git-PR-style review-before-commit workflow for the
-- /reports ledger (build spec ask: "Make this upload a request to commit...
-- to check for and avoid discrepancies before committing to the official
-- book... only cel/admin can commit").
--
-- A client (or staff, on the client's behalf) uploads a CSV; it lands as a
-- batch of *pending* rows, never touching manual_ledger_entries directly.
-- Rows that look like they duplicate an existing entry are flagged during
-- parse (see the upload action) so a reviewer sees them before committing.
-- Only owner/staff can commit (or reject) a batch — committing copies its
-- non-skipped rows into manual_ledger_entries in one transaction and marks
-- the batch committed; nothing is ever silently auto-posted.

create type public.ledger_import_status as enum ('pending', 'committed', 'rejected');
create type public.ledger_import_row_status as enum ('pending', 'flagged', 'skipped');

create table public.ledger_import_batches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  filename text not null,
  status public.ledger_import_status not null default 'pending',
  row_count integer not null default 0,
  flagged_count integer not null default 0,
  committed_by uuid references auth.users (id),
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.ledger_import_batches
  for each row execute function public.set_updated_at();

create index ledger_import_batches_client_id_idx on public.ledger_import_batches (client_id);

create table public.ledger_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ledger_import_batches (id) on delete cascade,
  row_number integer not null,
  entry_type public.report_entry_type not null,
  entry_date date not null,
  description text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text,
  status public.ledger_import_row_status not null default 'pending',
  flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.ledger_import_rows
  for each row execute function public.set_updated_at();

create index ledger_import_rows_batch_id_idx on public.ledger_import_rows (batch_id);

create trigger audit_ledger_import_batches
  after insert or update or delete on public.ledger_import_batches
  for each row execute function public.audit_row_change();

alter table public.ledger_import_batches enable row level security;
alter table public.ledger_import_rows enable row level security;

create policy ledger_import_batches_internal_all on public.ledger_import_batches
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

-- A client can create and read their own batches, but never change status
-- themselves (commit/reject go through the RPCs below) — enforced by the
-- guard trigger, not just by convention.
create policy ledger_import_batches_own_client_select on public.ledger_import_batches
  for select
  using (client_id = public.current_profile_client_id());

create policy ledger_import_batches_own_client_insert on public.ledger_import_batches
  for insert
  with check (
    client_id = public.current_profile_client_id()
    and status = 'pending'
  );

create or replace function public.guard_ledger_import_batch_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner_or_staff() and new.status is distinct from old.status then
    raise exception 'Only owner or staff can change an import batch''s status.';
  end if;
  return new;
end;
$$;

create trigger guard_ledger_import_batch_status
  before update on public.ledger_import_batches
  for each row execute function public.guard_ledger_import_batch_status();

create policy ledger_import_rows_internal_all on public.ledger_import_rows
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy ledger_import_rows_own_client_select on public.ledger_import_rows
  for select
  using (
    batch_id in (
      select id from public.ledger_import_batches
      where client_id = public.current_profile_client_id()
    )
  );

create policy ledger_import_rows_own_client_insert on public.ledger_import_rows
  for insert
  with check (
    batch_id in (
      select id from public.ledger_import_batches
      where client_id = public.current_profile_client_id()
        and status = 'pending'
    )
  );

-- ---------------------------------------------------------------------
-- commit_ledger_import_batch: owner/staff only. Copies every non-skipped
-- row into manual_ledger_entries, marks the batch committed. Atomic — a
-- partial commit never happens.
-- ---------------------------------------------------------------------
create or replace function public.commit_ledger_import_batch(p_batch_id uuid)
returns public.ledger_import_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.ledger_import_batches;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can commit an import batch.';
  end if;

  select * into v_batch from public.ledger_import_batches where id = p_batch_id;
  if v_batch.id is null then
    raise exception 'Import batch % not found.', p_batch_id;
  end if;
  if v_batch.status <> 'pending' then
    raise exception 'Import batch % is already %.', p_batch_id, v_batch.status;
  end if;

  insert into public.manual_ledger_entries (
    client_id, entry_type, entry_date, description, amount, category, created_by
  )
  select
    v_batch.client_id, r.entry_type, r.entry_date, r.description, r.amount, r.category,
    auth.uid()
  from public.ledger_import_rows r
  where r.batch_id = p_batch_id and r.status <> 'skipped';

  update public.ledger_import_batches
    set status = 'committed', committed_by = auth.uid(), committed_at = now()
    where id = p_batch_id
    returning * into v_batch;

  return v_batch;
end;
$$;

revoke all on function public.commit_ledger_import_batch(uuid) from public;
grant execute on function public.commit_ledger_import_batch(uuid) to authenticated;

create or replace function public.reject_ledger_import_batch(p_batch_id uuid)
returns public.ledger_import_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch public.ledger_import_batches;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can reject an import batch.';
  end if;

  update public.ledger_import_batches
    set status = 'rejected'
    where id = p_batch_id and status = 'pending'
    returning * into v_batch;

  if v_batch.id is null then
    raise exception 'Import batch % not found or not pending.', p_batch_id;
  end if;

  return v_batch;
end;
$$;

revoke all on function public.reject_ledger_import_batch(uuid) from public;
grant execute on function public.reject_ledger_import_batch(uuid) to authenticated;

-- Lets a reviewer (owner/staff) toggle whether a pending row will be
-- included when the batch is committed, without touching every other
-- field — the common "exclude this one duplicate-looking row" action.
create or replace function public.set_ledger_import_row_status(
  p_row_id uuid, p_status public.ledger_import_row_status
)
returns public.ledger_import_rows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.ledger_import_rows;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can review import rows.';
  end if;

  update public.ledger_import_rows
    set status = p_status
    where id = p_row_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Import row % not found.', p_row_id;
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_ledger_import_row_status(uuid, public.ledger_import_row_status) from public;
grant execute on function public.set_ledger_import_row_status(uuid, public.ledger_import_row_status) to authenticated;
