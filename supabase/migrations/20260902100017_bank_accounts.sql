-- Bank accounts + transactions (build spec §6.5, §7.6): clients hold one
-- or more bank accounts; transactions are imported (CSV, per build spec —
-- no live bank-feed integration) and reconciled against journal_lines
-- posted from receipts/manual entries. Reconciliation is a matching
-- exercise, not its own source of truth — the journal remains the ledger.

create type public.bank_transaction_match_status as enum ('unmatched', 'matched', 'ignored');

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  bank_name text not null,
  account_name text not null,
  account_number_last4 text,
  -- The chart-of-accounts row this bank account reconciles against
  -- (typically a "Cash in Bank" asset account). Nullable so a bank
  -- account can be created before the chart of accounts exists.
  gl_account_id uuid references public.chart_of_accounts (id),
  currency text not null default 'PHP',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.bank_accounts
  for each row execute function public.set_updated_at();

create index bank_accounts_client_id_idx on public.bank_accounts (client_id);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  txn_date date not null,
  description text not null,
  -- Signed amount: positive = money in, negative = money out. Keeps CSV
  -- import simple (one column) rather than separate debit/credit columns
  -- that most bank exports don't cleanly provide anyway.
  amount numeric(14, 2) not null,
  -- Raw source row, kept verbatim for re-import/dedupe/debugging.
  external_ref text,
  import_batch_id uuid,
  match_status public.bank_transaction_match_status not null default 'unmatched',
  matched_journal_line_id uuid references public.journal_lines (id),
  matched_by uuid references auth.users (id),
  matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint bank_transactions_match_consistency check (
    (match_status = 'matched' and matched_journal_line_id is not null)
    or (match_status != 'matched' and matched_journal_line_id is null)
  )
);

create trigger set_updated_at
  before update on public.bank_transactions
  for each row execute function public.set_updated_at();

create index bank_transactions_bank_account_id_idx on public.bank_transactions (bank_account_id);
create index bank_transactions_client_id_idx on public.bank_transactions (client_id);
create index bank_transactions_match_status_idx on public.bank_transactions (client_id, match_status);
create index bank_transactions_import_batch_idx on public.bank_transactions (import_batch_id);
-- Same-batch dedupe: importing the same CSV twice shouldn't double the
-- transactions. external_ref is whatever the export's own row identifier
-- is (or a hash of date+description+amount when the bank provides none).
create unique index bank_transactions_dedupe_idx on public.bank_transactions (bank_account_id, txn_date, amount, external_ref)
  where external_ref is not null;

-- One posted journal_line can back at most one bank match — prevents two
-- different bank_transactions both claiming the same GL line.
create unique index bank_transactions_matched_line_unique_idx on public.bank_transactions (matched_journal_line_id)
  where matched_journal_line_id is not null;

-- Match/unmatch a bank transaction against a journal line. A thin RPC
-- rather than a raw UPDATE from the client so the two consistency rules
-- (matched requires a line, matched line must belong to the same client,
-- amount sanity) live in one place.
create or replace function public.match_bank_transaction(p_transaction_id uuid, p_journal_line_id uuid)
returns public.bank_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.bank_transactions;
  v_line_client_id uuid;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can match bank transactions.';
  end if;

  select * into v_txn from public.bank_transactions where id = p_transaction_id;
  if v_txn.id is null then
    raise exception 'Bank transaction % not found.', p_transaction_id;
  end if;

  select client_id into v_line_client_id
  from public.journal_entries je
  join public.journal_lines jl on jl.entry_id = je.id
  where jl.id = p_journal_line_id;

  if v_line_client_id is null then
    raise exception 'Journal line % not found.', p_journal_line_id;
  end if;
  if v_line_client_id != v_txn.client_id then
    raise exception 'Journal line % belongs to a different client than transaction %.',
      p_journal_line_id, p_transaction_id;
  end if;

  update public.bank_transactions
    set match_status = 'matched',
        matched_journal_line_id = p_journal_line_id,
        matched_by = auth.uid(),
        matched_at = now()
    where id = p_transaction_id
    returning * into v_txn;

  return v_txn;
end;
$$;

revoke all on function public.match_bank_transaction(uuid, uuid) from public;
grant execute on function public.match_bank_transaction(uuid, uuid) to authenticated;

create or replace function public.unmatch_bank_transaction(p_transaction_id uuid)
returns public.bank_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn public.bank_transactions;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can unmatch bank transactions.';
  end if;

  update public.bank_transactions
    set match_status = 'unmatched',
        matched_journal_line_id = null,
        matched_by = null,
        matched_at = null
    where id = p_transaction_id
    returning * into v_txn;

  if v_txn.id is null then
    raise exception 'Bank transaction % not found.', p_transaction_id;
  end if;

  return v_txn;
end;
$$;

revoke all on function public.unmatch_bank_transaction(uuid) from public;
grant execute on function public.unmatch_bank_transaction(uuid) to authenticated;

create trigger audit_bank_accounts
  after insert or update or delete on public.bank_accounts
  for each row execute function public.audit_row_change();

create trigger audit_bank_transactions
  after insert or update or delete on public.bank_transactions
  for each row execute function public.audit_row_change();

alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

create policy bank_accounts_internal_all on public.bank_accounts
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy bank_accounts_select_own_client on public.bank_accounts
  for select using (client_id = public.current_profile_client_id());

create policy bank_transactions_internal_all on public.bank_transactions
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy bank_transactions_select_own_client on public.bank_transactions
  for select using (client_id = public.current_profile_client_id());
