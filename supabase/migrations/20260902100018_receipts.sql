-- Receipts / OCR queue (build spec §6.5, §7.7-§7.8): clients photograph
-- and upload receipts through the portal; a vision model extracts
-- vendor/date/amount into ocr_raw/ocr_confidence; Cel's staff review the
-- extraction in a queue and approving posts a balanced journal entry
-- (source = 'receipt'). Image bytes live in the same private Storage
-- bucket as documents (see 20260902100009_storage.sql) — this table is
-- metadata + workflow state, never the file itself.
--
-- Duplicate detection is advisory, not a hard block: an exact image
-- hash match or a (vendor, date, amount) tuple match against another
-- non-rejected receipt for the same client sets possible_duplicate_of so
-- the reviewer sees a flag, but two genuinely separate purchases from the
-- same vendor on the same day for the same amount are not impossible —
-- a human makes the final call.

create type public.receipt_status as enum (
  'uploaded', 'processing', 'ocr_failed', 'needs_review', 'approved', 'rejected', 'duplicate'
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  uploaded_by uuid references auth.users (id),
  storage_path text not null unique,
  mime text not null,
  bytes bigint not null,
  sha256 text not null,
  status public.receipt_status not null default 'uploaded',
  -- Raw vision-model extraction and per-field confidence, kept verbatim
  -- for audit/debugging even after a human overwrites the fields below.
  ocr_raw jsonb,
  ocr_confidence jsonb,
  ocr_error text,
  -- Current working values: seeded from ocr_raw once extraction
  -- completes, then editable by the reviewer before approval.
  vendor_name text,
  receipt_date date,
  amount numeric(14, 2),
  currency text not null default 'PHP',
  category text,
  notes text,
  possible_duplicate_of uuid references public.receipts (id),
  debit_account_id uuid references public.chart_of_accounts (id),
  credit_account_id uuid references public.chart_of_accounts (id),
  journal_entry_id uuid references public.journal_entries (id),
  -- Calendar month the receipt counted against the client's plan
  -- txn_limit, stamped at approval — deliberately the approval month,
  -- not the (possibly backdated) receipt_date's month, since plan
  -- metering tracks processing load, while the journal entry itself
  -- posts into receipt_date's accounting period.
  counted_period text check (counted_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.receipts
  for each row execute function public.set_updated_at();

create index receipts_client_id_idx on public.receipts (client_id);
create index receipts_status_idx on public.receipts (client_id, status);
create index receipts_counted_period_idx on public.receipts (client_id, counted_period)
  where counted_period is not null;
create index receipts_sha256_idx on public.receipts (client_id, sha256);
create index receipts_dedupe_tuple_idx on public.receipts (client_id, vendor_name, receipt_date, amount)
  where vendor_name is not null and receipt_date is not null and amount is not null;

-- ---------------------------------------------------------------------
-- Duplicate flagging: on insert/update, if the row now has enough
-- information to compare (sha256 always; vendor/date/amount once OCR or
-- the reviewer has filled them in) and matches another of this client's
-- receipts that isn't itself rejected/duplicate, flag it. Advisory only
-- — never blocks the write.
-- ---------------------------------------------------------------------
create or replace function public.flag_duplicate_receipt()
returns trigger
language plpgsql
as $$
declare
  v_match_id uuid;
begin
  select r.id into v_match_id
  from public.receipts r
  where r.client_id = new.client_id
    and r.id != new.id
    and r.status not in ('rejected', 'duplicate')
    and (
      r.sha256 = new.sha256
      or (
        new.vendor_name is not null and new.receipt_date is not null and new.amount is not null
        and r.vendor_name = new.vendor_name
        and r.receipt_date = new.receipt_date
        and r.amount = new.amount
      )
    )
  order by r.created_at
  limit 1;

  new.possible_duplicate_of := v_match_id;
  return new;
end;
$$;

create trigger flag_duplicate_receipt
  before insert or update on public.receipts
  for each row execute function public.flag_duplicate_receipt();

-- ---------------------------------------------------------------------
-- Approve: posts a balanced 2-line journal entry (source = 'receipt')
-- into receipt_date's accounting period, stamps counted_period, and
-- marks the receipt approved. Rejects if the period is closed (via the
-- journal engine's own guard_closed_period_posting trigger) or the
-- receipt is missing required fields.
-- ---------------------------------------------------------------------
create or replace function public.approve_receipt(
  p_receipt_id uuid,
  p_debit_account_id uuid,
  p_credit_account_id uuid
)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.receipts;
  v_entry public.journal_entries;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can approve a receipt.';
  end if;

  select * into v_receipt from public.receipts where id = p_receipt_id;
  if v_receipt.id is null then
    raise exception 'Receipt % not found.', p_receipt_id;
  end if;
  if v_receipt.status not in ('needs_review', 'uploaded') then
    raise exception 'Receipt % has status % and cannot be approved.', p_receipt_id, v_receipt.status;
  end if;
  if v_receipt.receipt_date is null or v_receipt.amount is null or v_receipt.amount <= 0 then
    raise exception 'Receipt % is missing a date or a positive amount.', p_receipt_id;
  end if;
  if p_debit_account_id = p_credit_account_id then
    raise exception 'Debit and credit accounts must differ.';
  end if;

  insert into public.journal_entries (client_id, entry_date, period, memo, source, source_id, status)
  values (
    v_receipt.client_id,
    v_receipt.receipt_date,
    to_char(v_receipt.receipt_date, 'YYYY-MM'),
    coalesce('Receipt: ' || v_receipt.vendor_name, 'Receipt ' || v_receipt.id),
    'receipt',
    v_receipt.id,
    'draft'
  )
  returning * into v_entry;

  insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
  values
    (v_entry.id, p_debit_account_id, v_receipt.amount, 0, v_receipt.vendor_name),
    (v_entry.id, p_credit_account_id, 0, v_receipt.amount, v_receipt.vendor_name);

  update public.journal_entries set status = 'posted' where id = v_entry.id;

  update public.receipts
    set status = 'approved',
        debit_account_id = p_debit_account_id,
        credit_account_id = p_credit_account_id,
        journal_entry_id = v_entry.id,
        counted_period = to_char(now(), 'YYYY-MM'),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_receipt_id
    returning * into v_receipt;

  return v_receipt;
end;
$$;

revoke all on function public.approve_receipt(uuid, uuid, uuid) from public;
grant execute on function public.approve_receipt(uuid, uuid, uuid) to authenticated;

create or replace function public.reject_receipt(p_receipt_id uuid, p_reason text)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.receipts;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can reject a receipt.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to reject a receipt.';
  end if;

  update public.receipts
    set status = 'rejected',
        rejection_reason = p_reason,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_receipt_id
    returning * into v_receipt;

  if v_receipt.id is null then
    raise exception 'Receipt % not found.', p_receipt_id;
  end if;

  return v_receipt;
end;
$$;

revoke all on function public.reject_receipt(uuid, text) from public;
grant execute on function public.reject_receipt(uuid, text) to authenticated;

create or replace function public.mark_receipt_duplicate(p_receipt_id uuid, p_duplicate_of_id uuid)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.receipts;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can mark a receipt as duplicate.';
  end if;

  update public.receipts
    set status = 'duplicate',
        possible_duplicate_of = p_duplicate_of_id,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = p_receipt_id
    returning * into v_receipt;

  if v_receipt.id is null then
    raise exception 'Receipt % not found.', p_receipt_id;
  end if;

  return v_receipt;
end;
$$;

revoke all on function public.mark_receipt_duplicate(uuid, uuid) from public;
grant execute on function public.mark_receipt_duplicate(uuid, uuid) to authenticated;

-- Monthly transaction count against the client's plan.txn_limit — every
-- approved receipt counted in the given period. NULL txn_limit
-- (CORPORATE) is unlimited; callers must treat that null-safely, exactly
-- as documented on plans.txn_limit.
create or replace function public.count_receipts_for_period(p_client_id uuid, p_period text)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.receipts
  where client_id = p_client_id
    and counted_period = p_period
    and status = 'approved';
$$;

create trigger audit_receipts
  after insert or update or delete on public.receipts
  for each row execute function public.audit_row_change();

alter table public.receipts enable row level security;

create policy receipts_internal_all on public.receipts
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy receipts_select_own_client on public.receipts
  for select
  using (client_id = public.current_profile_client_id());

create policy receipts_insert_own_client on public.receipts
  for insert
  with check (client_id = public.current_profile_client_id());
