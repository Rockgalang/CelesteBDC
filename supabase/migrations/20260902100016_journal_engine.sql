-- Journal engine (build spec §6.5, §7.5, §9 quality bars):
--   - Every posted journal_entry has sum(debit) = sum(credit), enforced
--     with a deferred constraint trigger.
--   - Posted entries are immutable. Corrections are reversing entries.
--   - A closed period rejects new postings. Only owner can reopen, and
--     reopening is logged.

create type public.journal_source as enum ('receipt', 'bank', 'payroll', 'manual', 'opening', 'adjustment');
create type public.journal_entry_status as enum ('draft', 'posted', 'reversed');
create type public.accounting_period_status as enum ('open', 'closed', 'locked');

create table public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'), -- 'YYYY-MM'
  status public.accounting_period_status not null default 'open',
  closed_at timestamptz,
  closed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (client_id, period)
);

create trigger set_updated_at
  before update on public.accounting_periods
  for each row execute function public.set_updated_at();

create index accounting_periods_client_id_idx on public.accounting_periods (client_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  entry_date date not null default current_date,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  memo text,
  source public.journal_source not null default 'manual',
  source_id uuid,
  status public.journal_entry_status not null default 'draft',
  posted_by uuid references auth.users (id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

create index journal_entries_client_id_idx on public.journal_entries (client_id);
create index journal_entries_period_idx on public.journal_entries (client_id, period);
create index journal_entries_source_idx on public.journal_entries (source, source_id);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts (id),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  credit numeric(14, 2) not null default 0 check (credit >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint journal_lines_one_sided check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create trigger set_updated_at
  before update on public.journal_lines
  for each row execute function public.set_updated_at();

create index journal_lines_entry_id_idx on public.journal_lines (entry_id);
create index journal_lines_account_id_idx on public.journal_lines (account_id);

-- ---------------------------------------------------------------------
-- Balancing constraint. A deferred constraint trigger (checked at
-- COMMIT, or on SET CONSTRAINTS ... IMMEDIATE) rather than a plain CHECK,
-- since "sum(debit) = sum(credit) across sibling rows" can't be expressed
-- as a single-row CHECK. Draft entries are allowed to be unbalanced
-- mid-edit; only posted ones must balance.
-- ---------------------------------------------------------------------
create or replace function public.check_journal_entry_balanced()
returns trigger
language plpgsql
as $$
declare
  v_entry_id uuid;
  v_status public.journal_entry_status;
  v_debit numeric(14, 2);
  v_credit numeric(14, 2);
begin
  v_entry_id := coalesce(new.entry_id, old.entry_id);

  select status into v_status from public.journal_entries where id = v_entry_id;
  if v_status is distinct from 'posted' then
    return null;
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
    into v_debit, v_credit
    from public.journal_lines
    where entry_id = v_entry_id;

  if v_debit != v_credit then
    raise exception 'Journal entry % is not balanced: debits % != credits %.',
      v_entry_id, v_debit, v_credit;
  end if;

  return null;
end;
$$;

create constraint trigger check_journal_entry_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.check_journal_entry_balanced();

-- Also check when an entry itself transitions to 'posted' (e.g. lines
-- were all added while status was still 'draft').
create or replace function public.check_journal_entry_balanced_on_post()
returns trigger
language plpgsql
as $$
declare
  v_debit numeric(14, 2);
  v_credit numeric(14, 2);
begin
  if new.status = 'posted' and old.status is distinct from 'posted' then
    select coalesce(sum(debit), 0), coalesce(sum(credit), 0)
      into v_debit, v_credit
      from public.journal_lines
      where entry_id = new.id;

    if v_debit != v_credit or v_debit = 0 then
      raise exception 'Journal entry % cannot be posted: debits % != credits % (or entry has no lines).',
        new.id, v_debit, v_credit;
    end if;

    new.posted_at := now();
    new.posted_by := auth.uid();
  end if;

  return new;
end;
$$;

create trigger check_journal_entry_balanced_on_post
  before update on public.journal_entries
  for each row execute function public.check_journal_entry_balanced_on_post();

-- ---------------------------------------------------------------------
-- Immutability: posted entries/lines cannot be edited or deleted.
-- Corrections are reversing entries (a new entry with debits/credits
-- swapped), never an edit to history.
-- ---------------------------------------------------------------------
create or replace function public.guard_posted_entry_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'posted' then
    if tg_op = 'DELETE' then
      raise exception 'Journal entry % is posted and cannot be deleted. Reverse it instead.', old.id;
    end if;
    -- Allow only the one transition posted -> reversed; block every other field change.
    if not (old.status = 'posted' and new.status = 'reversed') then
      raise exception 'Journal entry % is posted and cannot be edited. Reverse it instead.', old.id;
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_posted_entry_immutable
  before update or delete on public.journal_entries
  for each row execute function public.guard_posted_entry_immutable();

create or replace function public.guard_posted_lines_immutable()
returns trigger
language plpgsql
as $$
declare
  v_status public.journal_entry_status;
begin
  select status into v_status from public.journal_entries where id = coalesce(old.entry_id, new.entry_id);
  if v_status = 'posted' then
    raise exception 'Journal entry % is posted; its lines cannot be changed. Reverse the entry instead.',
      coalesce(old.entry_id, new.entry_id);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_posted_lines_immutable
  before update or delete on public.journal_lines
  for each row execute function public.guard_posted_lines_immutable();

-- Reverses a posted entry: marks it 'reversed' and creates a new posted
-- entry with every line's debit/credit swapped, dated today (in the
-- current open period, not the original period, so it doesn't silently
-- reopen a closed one).
create or replace function public.reverse_journal_entry(p_entry_id uuid, p_memo text default null)
returns public.journal_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.journal_entries;
  v_reversal public.journal_entries;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can reverse a journal entry.';
  end if;

  select * into v_original from public.journal_entries where id = p_entry_id;
  if v_original.id is null then
    raise exception 'Journal entry % not found.', p_entry_id;
  end if;
  if v_original.status != 'posted' then
    raise exception 'Journal entry % is not posted; only posted entries can be reversed.', p_entry_id;
  end if;

  insert into public.journal_entries (client_id, entry_date, period, memo, source, source_id, status)
  values (
    v_original.client_id,
    current_date,
    to_char(current_date, 'YYYY-MM'),
    coalesce(p_memo, 'Reversal of entry ' || v_original.id),
    'adjustment',
    v_original.id,
    'draft'
  )
  returning * into v_reversal;

  insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
  select v_reversal.id, account_id, credit, debit, memo
  from public.journal_lines
  where entry_id = v_original.id;

  update public.journal_entries set status = 'posted' where id = v_reversal.id
    returning * into v_reversal;

  update public.journal_entries set status = 'reversed' where id = v_original.id;

  return v_reversal;
end;
$$;

revoke all on function public.reverse_journal_entry(uuid, text) from public;
grant execute on function public.reverse_journal_entry(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Closed-period enforcement: a closed/locked period rejects new
-- postings. Checked at insert time (a journal_entry is created directly
-- into whatever period its entry_date falls in).
-- ---------------------------------------------------------------------
create or replace function public.guard_closed_period_posting()
returns trigger
language plpgsql
as $$
declare
  v_period_status public.accounting_period_status;
begin
  select status into v_period_status
  from public.accounting_periods
  where client_id = new.client_id and period = new.period;

  if v_period_status in ('closed', 'locked') then
    raise exception 'Period % is closed for client %. Reopen it first (owner only).',
      new.period, new.client_id;
  end if;

  return new;
end;
$$;

create trigger guard_closed_period_posting
  before insert on public.journal_entries
  for each row execute function public.guard_closed_period_posting();

-- Close a period. Owner/staff can close (the checklist itself lives in
-- the app, not the database); only owner can reopen, and reopening is
-- always logged via the audit trigger already on accounting_periods.
create or replace function public.close_accounting_period(p_client_id uuid, p_period text)
returns public.accounting_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.accounting_periods;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can close a period.';
  end if;

  insert into public.accounting_periods (client_id, period, status, closed_at, closed_by)
  values (p_client_id, p_period, 'closed', now(), auth.uid())
  on conflict (client_id, period)
    do update set status = 'closed', closed_at = now(), closed_by = auth.uid()
  returning * into v_period;

  return v_period;
end;
$$;

revoke all on function public.close_accounting_period(uuid, text) from public;
grant execute on function public.close_accounting_period(uuid, text) to authenticated;

create or replace function public.reopen_accounting_period(p_client_id uuid, p_period text, p_reason text)
returns public.accounting_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.accounting_periods;
begin
  if not public.is_owner() then
    raise exception 'Only owner can reopen a closed period.';
  end if;
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'A reason is required to reopen a period.';
  end if;

  perform set_config('celeste.reopen_period_reason', p_reason, true);

  update public.accounting_periods
    set status = 'open', closed_at = null, closed_by = null
    where client_id = p_client_id and period = p_period
    returning * into v_period;

  if v_period.id is null then
    raise exception 'No accounting period % found for client %.', p_period, p_client_id;
  end if;

  return v_period;
end;
$$;

revoke all on function public.reopen_accounting_period(uuid, text, text) from public;
grant execute on function public.reopen_accounting_period(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Audit + RLS.
-- ---------------------------------------------------------------------
create trigger audit_journal_entries
  after insert or update or delete on public.journal_entries
  for each row execute function public.audit_row_change();

create trigger audit_journal_lines
  after insert or update or delete on public.journal_lines
  for each row execute function public.audit_row_change();

create trigger audit_accounting_periods
  after insert or update or delete on public.accounting_periods
  for each row execute function public.audit_row_change();

alter table public.accounting_periods enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy accounting_periods_internal_all on public.accounting_periods
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy accounting_periods_select_own_client on public.accounting_periods
  for select using (client_id = public.current_profile_client_id());

create policy journal_entries_internal_all on public.journal_entries
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy journal_entries_select_own_client on public.journal_entries
  for select using (client_id = public.current_profile_client_id());

create policy journal_lines_internal_all on public.journal_lines
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy journal_lines_select_own_client on public.journal_lines
  for select using (
    entry_id in (select id from public.journal_entries where client_id = public.current_profile_client_id())
  );
