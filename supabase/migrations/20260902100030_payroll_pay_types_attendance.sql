-- Payroll pay types + attendance (build spec §1.2/§5): employees gain a
-- pay-type dimension independent of employment_type (monthly/bi-monthly/
-- commission/salary+commission), and each payroll run can record
-- per-employee attendance (lates/absences/overtime/differentials/leaves)
-- that feeds into the payslip's overtime pay and deductions. The rates
-- used to translate attendance into pesos live in a singleton
-- payroll_standards row, editable from Accounting Standards.

create type public.pay_type as enum (
  'monthly', 'bi_monthly', 'commission', 'salary_plus_commission'
);

alter table public.employees
  add column pay_type public.pay_type not null default 'monthly',
  add column commission_rate numeric(5, 2);

-- Singleton settings row (id is always 1) — same idea as a one-row
-- settings table, enforced by the check constraint rather than a
-- separate "is this the config row" flag.
create table public.payroll_standards (
  id smallint primary key default 1 check (id = 1),
  overtime_multiplier numeric(4, 2) not null default 1.25,
  night_differential_rate numeric(4, 2) not null default 0.10,
  late_deduction_per_minute numeric(10, 4) not null default 0,
  absence_deduction_per_day_multiplier numeric(4, 2) not null default 1.00,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.payroll_standards (id) values (1);

create trigger set_updated_at
  before update on public.payroll_standards
  for each row execute function public.set_updated_at();

alter table public.payroll_standards enable row level security;

create policy payroll_standards_select_internal on public.payroll_standards
  for select using (public.is_owner_or_staff());
create policy payroll_standards_update_owner_only on public.payroll_standards
  for update using (public.is_owner()) with check (public.is_owner());

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  client_id uuid not null references public.clients (id) on delete cascade,
  late_minutes numeric(10, 2) not null default 0 check (late_minutes >= 0),
  absence_days numeric(6, 2) not null default 0 check (absence_days >= 0),
  overtime_hours numeric(10, 2) not null default 0 check (overtime_hours >= 0),
  night_differential_hours numeric(10, 2) not null default 0 check (night_differential_hours >= 0),
  leave_days numeric(6, 2) not null default 0 check (leave_days >= 0),
  leave_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);

create trigger set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

create index attendance_records_payroll_run_id_idx on public.attendance_records (payroll_run_id);
create index attendance_records_client_id_idx on public.attendance_records (client_id);

create trigger audit_attendance_records
  after insert or update or delete on public.attendance_records
  for each row execute function public.audit_row_change();

alter table public.attendance_records enable row level security;

create policy attendance_records_internal_all on public.attendance_records
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());

-- Same rationale as guard_processed_payslips_immutable: once a run is
-- processed and posted to the books, its attendance record is history.
create or replace function public.guard_processed_attendance_immutable()
returns trigger
language plpgsql
as $$
declare
  v_status public.payroll_run_status;
begin
  select status into v_status from public.payroll_runs where id = old.payroll_run_id;
  if v_status = 'processed' then
    raise exception 'Attendance for payroll run % is processed and cannot be edited.', old.payroll_run_id;
  end if;
  return old;
end;
$$;

create trigger guard_processed_attendance_immutable
  before update or delete on public.attendance_records
  for each row execute function public.guard_processed_attendance_immutable();
