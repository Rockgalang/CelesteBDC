-- Client Transactions overhaul (build spec §4, renaming "Receipts
-- Review"): a receipt can now carry more than one photo, and its amount
-- can be broken down into multiple line items (each posting to its own
-- account) instead of always being a single debit/credit pair — a
-- receipt is still always either Expense or Sale as a whole
-- (receipts.entry_type is unchanged and ungrouped by line item), never
-- mixed.

create table public.receipt_images (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  storage_path text not null unique,
  mime text not null,
  bytes bigint not null,
  sha256 text not null,
  sequence smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index receipt_images_receipt_id_idx on public.receipt_images (receipt_id);

alter table public.receipt_images enable row level security;

create policy receipt_images_internal_all on public.receipt_images
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());

create policy receipt_images_select_own_client on public.receipt_images
  for select using (
    receipt_id in (
      select id from public.receipts where client_id = public.current_profile_client_id()
    )
  );

-- A client can add extra photos to their own receipt while it's still
-- awaiting review — same lifecycle boundary as the receipt itself.
create policy receipt_images_insert_own_client on public.receipt_images
  for insert
  with check (
    receipt_id in (
      select id from public.receipts
      where client_id = public.current_profile_client_id()
        and status in ('uploaded', 'processing', 'needs_review', 'ocr_failed')
    )
  );

create table public.receipt_line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category text,
  account_id uuid references public.chart_of_accounts (id),
  sequence smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index receipt_line_items_receipt_id_idx on public.receipt_line_items (receipt_id);

alter table public.receipt_line_items enable row level security;

create policy receipt_line_items_internal_all on public.receipt_line_items
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());

create policy receipt_line_items_select_own_client on public.receipt_line_items
  for select using (
    receipt_id in (
      select id from public.receipts where client_id = public.current_profile_client_id()
    )
  );

-- A client can propose a breakdown (from CSV paste/upload or manual entry)
-- while their receipt is still awaiting review — staff has the final say
-- during approval, same as every other extracted field.
create policy receipt_line_items_insert_own_client on public.receipt_line_items
  for insert
  with check (
    receipt_id in (
      select id from public.receipts
      where client_id = public.current_profile_client_id()
        and status in ('uploaded', 'processing', 'needs_review', 'ocr_failed')
    )
  );

create policy receipt_line_items_delete_own_client on public.receipt_line_items
  for delete
  using (
    receipt_id in (
      select id from public.receipts
      where client_id = public.current_profile_client_id()
        and status in ('uploaded', 'processing', 'needs_review', 'ocr_failed')
    )
  );

-- ---------------------------------------------------------------------
-- approve_receipt: extended with an optional line-item breakdown. The
-- original single-debit/single-credit signature is dropped first (same
-- reason as create_default_chart_of_accounts in 20260902100028 — adding
-- a parameter via plain CREATE OR REPLACE would overload rather than
-- replace it).
--
-- With no line items, behavior is identical to before. With line items,
-- posts one debit line per item (against its own account) plus one
-- credit line for the total — and the line amounts must sum to exactly
-- the receipt's amount, or approval is rejected outright (the build
-- spec's "alert on discrepancy").
-- ---------------------------------------------------------------------
drop function if exists public.approve_receipt(uuid, uuid, uuid);

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
  v_line record;
  v_line_total numeric(14, 2);
  v_line_count integer;
  v_debit_account_id uuid := p_debit_account_id;
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

  select count(*), coalesce(sum(amount), 0) into v_line_count, v_line_total
  from public.receipt_line_items where receipt_id = p_receipt_id;

  if v_line_count > 0 then
    if v_line_total <> v_receipt.amount then
      raise exception 'Line items total % but the receipt amount is % — fix the breakdown before approving.',
        v_line_total, v_receipt.amount;
    end if;
    -- Multiple accounts are debited when line items are used, so a
    -- single debit_account_id on the receipt row would be misleading —
    -- journal_lines is the source of truth for the breakdown.
    v_debit_account_id := null;
  elsif p_debit_account_id = p_credit_account_id then
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

  if v_line_count > 0 then
    for v_line in
      select * from public.receipt_line_items where receipt_id = p_receipt_id order by sequence
    loop
      if v_line.account_id is null then
        raise exception 'Line item "%" has no account chosen.', v_line.description;
      end if;
      insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
      values (v_entry.id, v_line.account_id, v_line.amount, 0, v_line.description);
    end loop;
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values (v_entry.id, p_credit_account_id, 0, v_receipt.amount, v_receipt.vendor_name);
  else
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values
      (v_entry.id, p_debit_account_id, v_receipt.amount, 0, v_receipt.vendor_name),
      (v_entry.id, p_credit_account_id, 0, v_receipt.amount, v_receipt.vendor_name);
  end if;

  update public.journal_entries set status = 'posted' where id = v_entry.id;

  update public.receipts
    set status = 'approved',
        debit_account_id = v_debit_account_id,
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
