-- Payroll (build spec §6.6, §7.9, Phase 4): employee roster, monthly
-- payroll runs, and payslips with Philippine government-contribution
-- withholding. Internal-only (owner/staff) — there is no employee login
-- concept in this build, so payslips are managed and viewed by Cel's
-- team on the employee's behalf, per build spec's description of payroll
-- as a service Cel's team runs, not a self-service employee portal.
--
-- Locked entirely on the STARTUP plan (plans.features->>'payroll_locked')
-- and capped by plans.employee_limit on every other plan — enforcement of
-- that limit is a UI/application concern, not a hard DB constraint, same
-- as every other plan limit in this schema.

create type public.employment_type as enum ('regular', 'probationary', 'contractual', 'part_time');
create type public.employee_status as enum ('active', 'on_leave', 'separated');
create type public.payroll_run_status as enum ('draft', 'processed');

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  full_name text not null,
  position text,
  employment_type public.employment_type not null default 'regular',
  monthly_rate numeric(14, 2) not null check (monthly_rate >= 0),
  sss_no text,
  philhealth_no text,
  pagibig_no text,
  tin text,
  hire_date date,
  separation_date date,
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

create index employees_client_id_idx on public.employees (client_id);
create index employees_status_idx on public.employees (client_id, status);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  pay_date date,
  status public.payroll_run_status not null default 'draft',
  processed_by uuid references auth.users (id),
  processed_at timestamptz,
  journal_entry_id uuid references public.journal_entries (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (client_id, period)
);

create trigger set_updated_at
  before update on public.payroll_runs
  for each row execute function public.set_updated_at();

create index payroll_runs_client_id_idx on public.payroll_runs (client_id);

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  client_id uuid not null references public.clients (id) on delete cascade,
  basic_pay numeric(14, 2) not null default 0,
  overtime_pay numeric(14, 2) not null default 0,
  allowances numeric(14, 2) not null default 0,
  gross_pay numeric(14, 2) generated always as (
    round(basic_pay + overtime_pay + allowances, 2)
  ) stored,
  -- Government contributions: computed as a starting estimate by
  -- src/lib/payroll/computations.ts (approximate formulas, not the
  -- official SSS/PhilHealth/HDMF bracket tables — see that file's header
  -- comment), then editable here before a run is processed.
  sss_employee numeric(14, 2) not null default 0,
  sss_employer numeric(14, 2) not null default 0,
  philhealth_employee numeric(14, 2) not null default 0,
  philhealth_employer numeric(14, 2) not null default 0,
  pagibig_employee numeric(14, 2) not null default 0,
  pagibig_employer numeric(14, 2) not null default 0,
  withholding_tax numeric(14, 2) not null default 0,
  other_deductions numeric(14, 2) not null default 0,
  net_pay numeric(14, 2) generated always as (
    round(
      basic_pay + overtime_pay + allowances
      - sss_employee - philhealth_employee - pagibig_employee
      - withholding_tax - other_deductions,
      2
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (payroll_run_id, employee_id)
);

create trigger set_updated_at
  before update on public.payslips
  for each row execute function public.set_updated_at();

create index payslips_payroll_run_id_idx on public.payslips (payroll_run_id);
create index payslips_client_id_idx on public.payslips (client_id);

-- ---------------------------------------------------------------------
-- Seed a draft payroll run with one payslip per active employee, using
-- their monthly_rate as basic_pay and zeroed contributions — the caller
-- fills in computed contributions per employee afterward (application
-- layer calls src/lib/payroll/computations.ts and updates each payslip).
-- ---------------------------------------------------------------------
create or replace function public.create_payroll_run(p_client_id uuid, p_period text, p_pay_date date)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.payroll_runs;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can create a payroll run.';
  end if;

  insert into public.payroll_runs (client_id, period, pay_date, status)
  values (p_client_id, p_period, p_pay_date, 'draft')
  returning * into v_run;

  insert into public.payslips (payroll_run_id, employee_id, client_id, basic_pay)
  select v_run.id, e.id, p_client_id, e.monthly_rate
  from public.employees e
  where e.client_id = p_client_id and e.status = 'active';

  return v_run;
end;
$$;

revoke all on function public.create_payroll_run(uuid, text, date) from public;
grant execute on function public.create_payroll_run(uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- Process a draft run: locks it (no more payslip edits — see RLS below)
-- and posts one balanced journal entry summarizing the whole run.
--
-- The entry always balances by construction regardless of the input
-- values, because net_pay is derived from the same figures the credit
-- side sums:
--   debit  wages_account       = sum(gross_pay - other_deductions)
--   debit  employer_contrib    = sum(employer shares)
--   credit wht_payable         = sum(withholding_tax)
--   credit contributions_payable = sum(employee shares + employer shares)
--   credit cash_account        = sum(net_pay)
-- Zero-amount lines are skipped (e.g. no withholding tax owed) to keep
-- the ledger clean; the deferred balancing trigger still enforces the
-- total.
-- ---------------------------------------------------------------------
create or replace function public.process_payroll_run(
  p_payroll_run_id uuid,
  p_wages_account_id uuid,
  p_employer_contrib_account_id uuid,
  p_wht_payable_account_id uuid,
  p_contributions_payable_account_id uuid,
  p_cash_account_id uuid
)
returns public.payroll_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.payroll_runs;
  v_entry public.journal_entries;
  v_wages numeric(14,2);
  v_employer_contrib numeric(14,2);
  v_wht numeric(14,2);
  v_contributions_payable numeric(14,2);
  v_cash numeric(14,2);
  v_payslip_count integer;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can process a payroll run.';
  end if;

  select * into v_run from public.payroll_runs where id = p_payroll_run_id;
  if v_run.id is null then
    raise exception 'Payroll run % not found.', p_payroll_run_id;
  end if;
  if v_run.status != 'draft' then
    raise exception 'Payroll run % has status % and cannot be processed again.', p_payroll_run_id, v_run.status;
  end if;

  select count(*) into v_payslip_count from public.payslips where payroll_run_id = p_payroll_run_id;
  if v_payslip_count = 0 then
    raise exception 'Payroll run % has no payslips.', p_payroll_run_id;
  end if;

  select
    coalesce(sum(gross_pay - other_deductions), 0),
    coalesce(sum(sss_employer + philhealth_employer + pagibig_employer), 0),
    coalesce(sum(withholding_tax), 0),
    coalesce(sum(sss_employee + philhealth_employee + pagibig_employee + sss_employer + philhealth_employer + pagibig_employer), 0),
    coalesce(sum(net_pay), 0)
  into v_wages, v_employer_contrib, v_wht, v_contributions_payable, v_cash
  from public.payslips
  where payroll_run_id = p_payroll_run_id;

  insert into public.journal_entries (client_id, entry_date, period, memo, source, source_id, status)
  values (
    v_run.client_id,
    coalesce(v_run.pay_date, (v_run.period || '-01')::date),
    v_run.period,
    'Payroll run ' || v_run.period,
    'payroll',
    v_run.id,
    'draft'
  )
  returning * into v_entry;

  if v_wages > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values (v_entry.id, p_wages_account_id, v_wages, 0, 'Wages');
  end if;
  if v_employer_contrib > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values (v_entry.id, p_employer_contrib_account_id, v_employer_contrib, 0, 'Employer contributions');
  end if;
  if v_wht > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values (v_entry.id, p_wht_payable_account_id, 0, v_wht, 'Withholding tax payable');
  end if;
  if v_contributions_payable > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values (v_entry.id, p_contributions_payable_account_id, 0, v_contributions_payable, 'SSS/PhilHealth/Pag-IBIG payable');
  end if;
  if v_cash > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
    values (v_entry.id, p_cash_account_id, 0, v_cash, 'Net pay');
  end if;

  update public.journal_entries set status = 'posted' where id = v_entry.id;

  update public.payroll_runs
    set status = 'processed',
        processed_by = auth.uid(),
        processed_at = now(),
        journal_entry_id = v_entry.id
    where id = p_payroll_run_id
    returning * into v_run;

  return v_run;
end;
$$;

revoke all on function public.process_payroll_run(uuid, uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function public.process_payroll_run(uuid, uuid, uuid, uuid, uuid, uuid) to authenticated;

-- A processed run's payslips are immutable, same rationale as posted
-- journal entries — correct via a new run (e.g. an adjustment run) or a
-- manual journal entry, not by editing history.
create or replace function public.guard_processed_payslips_immutable()
returns trigger
language plpgsql
as $$
declare
  v_status public.payroll_run_status;
begin
  select status into v_status from public.payroll_runs where id = old.payroll_run_id;
  if v_status = 'processed' then
    raise exception 'Payslip % belongs to a processed payroll run and cannot be edited.', old.id;
  end if;
  return new;
end;
$$;

create trigger guard_processed_payslips_immutable
  before update or delete on public.payslips
  for each row execute function public.guard_processed_payslips_immutable();

create or replace function public.guard_processed_run_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'processed' and (
    new.period is distinct from old.period
    or new.pay_date is distinct from old.pay_date
    or new.client_id is distinct from old.client_id
  ) then
    raise exception 'Payroll run % is processed and cannot be edited.', old.id;
  end if;
  return new;
end;
$$;

create trigger guard_processed_run_immutable
  before update on public.payroll_runs
  for each row execute function public.guard_processed_run_immutable();

create trigger audit_employees
  after insert or update or delete on public.employees
  for each row execute function public.audit_row_change();
create trigger audit_payroll_runs
  after insert or update or delete on public.payroll_runs
  for each row execute function public.audit_row_change();
create trigger audit_payslips
  after insert or update or delete on public.payslips
  for each row execute function public.audit_row_change();

alter table public.employees enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;

create policy employees_internal_all on public.employees
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy payroll_runs_internal_all on public.payroll_runs
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy payslips_internal_all on public.payslips
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
