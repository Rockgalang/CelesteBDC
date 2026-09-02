-- Overage and fee rules (build spec §5.1): "seed as editable config, not
-- code." Versioned with effectivity dates, same pattern the tax engine's
-- filing_rules table will use in Phase 3 — editing a rule here must never
-- retroactively change an already-issued invoice line, only future ones.

create table public.billing_config (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  amount numeric(14, 2) not null,
  unit text not null,
  effective_from date not null default current_date,
  effective_to date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint billing_config_effective_range
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.billing_config is
  'Editable-without-a-deploy billing rules (overage rates, handling fees). Invoicing (Phase 1) must look up the row effective on the invoice''s period, never a hardcoded constant.';

create trigger set_updated_at
  before update on public.billing_config
  for each row execute function public.set_updated_at();

-- At most one currently-effective row per key.
create unique index billing_config_one_active_per_key
  on public.billing_config (key)
  where effective_to is null;

insert into public.billing_config (key, amount, unit, notes) values
  ('bookkeeping_txn_overage', 10.00, 'per_transaction',
    'Charged per bookkeeping transaction over the plan''s txn_limit.'),
  ('payroll_employee_overage', 300.00, 'per_employee_per_month',
    'Charged per employee over the plan''s employee_limit, per payroll month.'),
  ('govt_fee_handling', 200.00, 'per_transaction',
    'Added on top of cost when passing through a government fee (build spec §5.1: cost + ₱200/transaction).');
