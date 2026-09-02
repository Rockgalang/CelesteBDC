-- Chart of accounts (build spec §6.5, §7.5): "seeded from an entity-type
-- template, editable per client."
--
-- Philippine sole proprietors and everything else differ mainly in the
-- equity section (Owner's Capital/Drawings vs Common Stock/Retained
-- Earnings/APIC) — everything else (assets, liabilities, revenue,
-- expense) is the same generic small-business template regardless of
-- entity_type. Template rows are grouped by `template_group`
-- ('individual' | 'corporate') rather than duplicated per entity_type;
-- get_template_group() below maps entity_type -> group.

create type public.account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
create type public.normal_balance as enum ('debit', 'credit');

create or replace function public.get_template_group(p_entity_type public.entity_type)
returns text
language sql
immutable
as $$
  select case when p_entity_type = 'sole_proprietor' then 'individual' else 'corporate' end;
$$;

create table public.chart_of_account_templates (
  id uuid primary key default gen_random_uuid(),
  template_group text not null check (template_group in ('individual', 'corporate')),
  code text not null,
  name text not null,
  type public.account_type not null,
  normal_balance public.normal_balance not null,
  parent_code text,
  sequence smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (template_group, code)
);

create trigger set_updated_at
  before update on public.chart_of_account_templates
  for each row execute function public.set_updated_at();

alter table public.chart_of_account_templates enable row level security;
create policy chart_of_account_templates_select_internal on public.chart_of_account_templates
  for select using (public.is_owner_or_staff());
create policy chart_of_account_templates_write_owner_only on public.chart_of_account_templates
  for insert with check (public.is_owner());
create policy chart_of_account_templates_update_owner_only on public.chart_of_account_templates
  for update using (public.is_owner()) with check (public.is_owner());

create table public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  code text not null,
  name text not null,
  type public.account_type not null,
  normal_balance public.normal_balance not null,
  parent_id uuid references public.chart_of_accounts (id),
  -- System accounts come from the template and back journal postings
  -- generated elsewhere (receipts, payroll); block deleting them, only
  -- allow deactivating (active = false).
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (client_id, code)
);

create trigger set_updated_at
  before update on public.chart_of_accounts
  for each row execute function public.set_updated_at();

create index chart_of_accounts_client_id_idx on public.chart_of_accounts (client_id);

create or replace function public.guard_system_account_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'Account % (%) is a system account and cannot be deleted — deactivate it instead.',
      old.code, old.name;
  end if;
  return old;
end;
$$;

create trigger guard_system_account_delete
  before delete on public.chart_of_accounts
  for each row execute function public.guard_system_account_delete();

-- Instantiate a client's chart of accounts from the template matching its
-- entity_type. Called once at onboarding (or on demand for existing
-- clients with no accounts yet) — running it twice is a no-op thanks to
-- the (client_id, code) unique constraint plus ON CONFLICT DO NOTHING.
create or replace function public.create_default_chart_of_accounts(p_client_id uuid)
returns setof public.chart_of_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group text;
  v_entity_type public.entity_type;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can create a chart of accounts.';
  end if;

  select entity_type into v_entity_type from public.clients where id = p_client_id;
  if v_entity_type is null then
    raise exception 'Client % not found.', p_client_id;
  end if;
  v_group := public.get_template_group(v_entity_type);

  insert into public.chart_of_accounts (client_id, code, name, type, normal_balance, is_system)
  select p_client_id, t.code, t.name, t.type, t.normal_balance, true
  from public.chart_of_account_templates t
  where t.template_group = v_group
  order by t.sequence
  on conflict (client_id, code) do nothing;

  update public.chart_of_accounts coa
    set parent_id = parent.id
    from public.chart_of_account_templates t
    join public.chart_of_accounts parent
      on parent.client_id = p_client_id and parent.code = t.parent_code
    where coa.client_id = p_client_id
      and coa.code = t.code
      and t.template_group = v_group
      and t.parent_code is not null;

  return query select * from public.chart_of_accounts where client_id = p_client_id order by code;
end;
$$;

revoke all on function public.create_default_chart_of_accounts(uuid) from public;
grant execute on function public.create_default_chart_of_accounts(uuid) to authenticated;

create trigger audit_chart_of_accounts
  after insert or update or delete on public.chart_of_accounts
  for each row execute function public.audit_row_change();

alter table public.chart_of_accounts enable row level security;

create policy chart_of_accounts_internal_all on public.chart_of_accounts
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy chart_of_accounts_select_own_client on public.chart_of_accounts
  for select using (client_id = public.current_profile_client_id());

-- ---------------------------------------------------------------------
-- Seed templates. ⚠️ VERIFY against a CPA-reviewed Philippine SME chart
-- of accounts before relying on this operationally — this is a
-- reasonable generic starting point, not a substitute for professional
-- review (build spec §2.2: Celeste is not a CPA firm).
-- ---------------------------------------------------------------------
insert into public.chart_of_account_templates (template_group, code, name, type, normal_balance, parent_code, sequence) values
  -- Assets (shared)
  ('individual', '1000', 'Cash on Hand', 'asset', 'debit', null, 10),
  ('individual', '1010', 'Cash in Bank', 'asset', 'debit', null, 11),
  ('individual', '1200', 'Accounts Receivable', 'asset', 'debit', null, 12),
  ('individual', '1400', 'Input VAT', 'asset', 'debit', null, 13),
  ('individual', '1500', 'Prepaid Expenses', 'asset', 'debit', null, 14),
  ('individual', '1700', 'Furniture, Fixtures and Equipment', 'asset', 'debit', null, 15),
  ('individual', '1710', 'Accumulated Depreciation', 'asset', 'credit', null, 16),
  -- Liabilities (shared)
  ('individual', '2000', 'Accounts Payable', 'liability', 'credit', null, 20),
  ('individual', '2100', 'Output VAT', 'liability', 'credit', null, 21),
  ('individual', '2200', 'Withholding Tax Payable', 'liability', 'credit', null, 22),
  ('individual', '2300', 'SSS/PhilHealth/Pag-IBIG Payable', 'liability', 'credit', null, 23),
  ('individual', '2400', 'Percentage Tax Payable', 'liability', 'credit', null, 24),
  ('individual', '2500', 'Income Tax Payable', 'liability', 'credit', null, 25),
  ('individual', '2900', 'Loans Payable', 'liability', 'credit', null, 26),
  -- Equity (individual)
  ('individual', '3000', 'Owner''s Capital', 'equity', 'credit', null, 30),
  ('individual', '3100', 'Owner''s Drawings', 'equity', 'debit', null, 31),
  -- Revenue (shared)
  ('individual', '4000', 'Sales Revenue', 'revenue', 'credit', null, 40),
  ('individual', '4100', 'Service Revenue', 'revenue', 'credit', null, 41),
  ('individual', '4900', 'Other Income', 'revenue', 'credit', null, 42),
  -- Expenses (shared)
  ('individual', '5000', 'Cost of Sales', 'expense', 'debit', null, 50),
  ('individual', '5100', 'Salaries and Wages', 'expense', 'debit', null, 51),
  ('individual', '5110', 'SSS/PhilHealth/Pag-IBIG Contributions', 'expense', 'debit', null, 52),
  ('individual', '5200', 'Rent Expense', 'expense', 'debit', null, 53),
  ('individual', '5300', 'Utilities Expense', 'expense', 'debit', null, 54),
  ('individual', '5400', 'Office Supplies Expense', 'expense', 'debit', null, 55),
  ('individual', '5500', 'Professional Fees', 'expense', 'debit', null, 56),
  ('individual', '5600', 'Transportation and Travel', 'expense', 'debit', null, 57),
  ('individual', '5700', 'Depreciation Expense', 'expense', 'debit', null, 58),
  ('individual', '5800', 'Taxes and Licenses', 'expense', 'debit', null, 59),
  ('individual', '5900', 'Miscellaneous Expense', 'expense', 'debit', null, 60);

-- Corporate group: identical to individual except the equity section.
insert into public.chart_of_account_templates (template_group, code, name, type, normal_balance, parent_code, sequence)
select 'corporate', code, name, type, normal_balance, parent_code, sequence
from public.chart_of_account_templates
where template_group = 'individual' and type != 'equity';

insert into public.chart_of_account_templates (template_group, code, name, type, normal_balance, parent_code, sequence) values
  ('corporate', '3000', 'Common Stock', 'equity', 'credit', null, 30),
  ('corporate', '3100', 'Additional Paid-in Capital', 'equity', 'credit', null, 31),
  ('corporate', '3900', 'Retained Earnings', 'equity', 'credit', null, 32);
