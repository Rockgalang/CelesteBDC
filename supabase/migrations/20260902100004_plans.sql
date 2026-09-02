-- Subscription tiers. Seeded from build spec §5 — the canonical pricing
-- table. Never hardcode these figures in application code; always read
-- from this table.

create type public.fs_frequency as enum ('quarterly', 'monthly');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly numeric(14, 2) not null,
  price_annual_monthly numeric(14, 2) not null,
  -- Monthly bookkeeping transaction limit. NULL = unlimited (CORPORATE).
  -- Every limit check against this column must be null-safe.
  txn_limit integer,
  -- NULL = payroll module locked entirely (STARTUP), not merely unlimited.
  -- Distinguish "locked" from "unlimited" at the call site using plan code
  -- or a dedicated feature flag in `features`, never by inferring intent
  -- from NULL alone.
  employee_limit integer,
  sla_days smallint not null,
  fs_frequency public.fs_frequency not null,
  features jsonb not null default '{}'::jsonb,
  sort_order smallint not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

comment on column public.plans.txn_limit is
  'NULL means unlimited (CORPORATE only). Null-safe check: txn_count > txn_limit is false whenever txn_limit is NULL.';
comment on column public.plans.employee_limit is
  'NULL on STARTUP means the payroll module is locked, not unlimited — gate on features->>''payroll_locked'' = ''true'', not on this column alone.';

create trigger set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans
  (code, name, price_monthly, price_annual_monthly, txn_limit, employee_limit, sla_days, fs_frequency, features, sort_order)
values
  ('STARTUP', 'Start Up', 1995.00, 1495.00, 50, null, 3, 'quarterly',
    jsonb_build_object(
      'registration_scope', 'dti_only',
      'bir_registration', 'setup_only',
      'payroll_locked', true,
      'target', 'Start-ups, freelancers, MSMEs'
    ), 1),
  ('GROWTH', 'Growth', 4995.00, 4495.00, 150, 5, 3, 'quarterly',
    jsonb_build_object(
      'registration_scope', 'dti_or_sec_lgu',
      'bir_registration', 'full',
      'payroll_locked', false,
      'target', 'Entrepreneurs, small office'
    ), 2),
  ('PRO', 'Pro', 9995.00, 9495.00, 300, 15, 3, 'quarterly',
    jsonb_build_object(
      'registration_scope', 'dti_sec_lgu',
      'bir_registration', 'full_incl_atp_books',
      'payroll_locked', false,
      'target', 'Medium enterprises'
    ), 3),
  ('CORPORATE', 'Corporate', 19995.00, 18995.00, null, 100, 0, 'monthly',
    jsonb_build_object(
      'registration_scope', 'dti_sec_lgu',
      'bir_registration', 'full_incl_atp_books',
      'payroll_locked', false,
      'same_day_sla', true,
      'target', 'Corporations, large enterprises'
    ), 4);

comment on table public.plans is
  'sla_days = 0 for CORPORATE represents "same day" (build spec §5) rather than a literal zero-day SLA — read features->>''same_day_sla'' when displaying it.';
