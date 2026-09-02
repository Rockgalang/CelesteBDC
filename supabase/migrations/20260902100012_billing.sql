-- Subscriptions, invoices, invoice lines, payments (build spec §6.2, §7.8).
--
-- Invoice numbers are sequential and gapless per year (CEL-2026-0001).
-- They're assigned only at issuance (not at draft creation) via a
-- BEFORE INSERT/UPDATE trigger backed by a counter table updated with a
-- single atomic UPDATE — a cancelled draft never burns a number, and
-- concurrent issuance can't collide.

create type public.subscription_cycle as enum ('monthly', 'annual');
create type public.subscription_status as enum ('active', 'grace', 'suspended', 'cancelled');
create type public.invoice_status as enum ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void');
create type public.invoice_line_kind as enum (
  'subscription', 'txn_overage', 'employee_overage', 'govt_fee', 'handling_fee', 'one_time', 'adjustment'
);
create type public.payment_method as enum ('gcash', 'bank_transfer', 'cash', 'other');
create type public.payment_status as enum ('submitted', 'confirmed', 'rejected');

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  cycle public.subscription_cycle not null,
  started_at date not null default current_date,
  current_period_start date not null default current_date,
  current_period_end date not null,
  -- Annual subscribers get a 12-month price lock (build spec §5.2): a
  -- plan price change must not retroactively alter a locked
  -- subscription's invoices, so invoice generation always reads
  -- locked_price when price_locked_until >= the invoice's issue_date,
  -- falling back to the plan's current price otherwise.
  price_locked_until date,
  locked_price numeric(14, 2),
  status public.subscription_status not null default 'active',
  cancel_notice_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint subscriptions_lock_fields_together
    check (
      (price_locked_until is null and locked_price is null)
      or (price_locked_until is not null and locked_price is not null)
    )
);

create trigger set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create index subscriptions_client_id_idx on public.subscriptions (client_id);
create index subscriptions_status_idx on public.subscriptions (status);

-- Only one active/grace/suspended subscription per client at a time —
-- cancel the old one before starting a new one (e.g. a plan change).
create unique index subscriptions_one_live_per_client
  on public.subscriptions (client_id)
  where status in ('active', 'grace', 'suspended');

create table public.invoice_number_counters (
  year int primary key,
  next_number int not null default 1
);

create or replace function public.generate_invoice_number(p_year int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  insert into public.invoice_number_counters (year, next_number)
    values (p_year, 1)
    on conflict (year) do nothing;

  update public.invoice_number_counters
    set next_number = next_number + 1
    where year = p_year
    returning next_number - 1 into v_next;

  return 'CEL-' || p_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  number text unique,
  issue_date date not null default current_date,
  due_date date not null,
  period_start date,
  period_end date,
  subtotal numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  status public.invoice_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create index invoices_client_id_idx on public.invoices (client_id);
create index invoices_status_idx on public.invoices (status);

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'issued' and new.number is null then
    new.number := public.generate_invoice_number(extract(year from new.issue_date)::int);
  end if;
  return new;
end;
$$;

create trigger assign_invoice_number
  before insert or update on public.invoices
  for each row execute function public.assign_invoice_number();

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind public.invoice_line_kind not null,
  description text not null,
  qty numeric(10, 2) not null default 1,
  unit_price numeric(14, 2) not null,
  amount numeric(14, 2) generated always as (round(qty * unit_price, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.invoice_lines
  for each row execute function public.set_updated_at();

create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);

-- Keep invoices.subtotal/total in sync with their lines. No separate tax
-- line exists yet (Celeste's own service fees aren't currently modeled
-- with VAT in the spec), so total = subtotal for now — a distinct total
-- column is kept so a future discount/tax line doesn't require a schema
-- change.
create or replace function public.recompute_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_subtotal numeric(14, 2);
begin
  select coalesce(sum(amount), 0) into v_subtotal
  from public.invoice_lines
  where invoice_id = v_invoice_id;

  update public.invoices
    set subtotal = v_subtotal, total = v_subtotal
    where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

create trigger recompute_invoice_totals
  after insert or update or delete on public.invoice_lines
  for each row execute function public.recompute_invoice_totals();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(14, 2) not null,
  method public.payment_method not null,
  reference text,
  paid_at timestamptz,
  proof_document_id uuid references public.documents (id) on delete set null,
  status public.payment_status not null default 'submitted',
  confirmed_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create index payments_invoice_id_idx on public.payments (invoice_id);

-- Owner/staff confirm or reject a client's submitted proof-of-payment
-- (build spec §2.4, §7.8: payments are manual — no gateway in v1).
-- Confirming rolls the invoice to partially_paid/paid based on the sum of
-- confirmed payments against its total.
create or replace function public.confirm_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_invoice public.invoices;
  v_confirmed_total numeric(14, 2);
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can confirm a payment.';
  end if;

  update public.payments
    set status = 'confirmed', confirmed_by = auth.uid(), paid_at = coalesce(paid_at, now())
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment % not found.', p_payment_id;
  end if;

  select * into v_invoice from public.invoices where id = v_payment.invoice_id;

  select coalesce(sum(amount), 0) into v_confirmed_total
  from public.payments
  where invoice_id = v_invoice.id and status = 'confirmed';

  update public.invoices
    set status = case
      when v_confirmed_total >= v_invoice.total then 'paid'
      when v_confirmed_total > 0 then 'partially_paid'
      else status
    end
    where id = v_invoice.id;

  return v_payment;
end;
$$;

revoke all on function public.confirm_payment(uuid) from public;
grant execute on function public.confirm_payment(uuid) to authenticated;

create or replace function public.reject_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can reject a payment.';
  end if;

  update public.payments
    set status = 'rejected', confirmed_by = auth.uid()
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment % not found.', p_payment_id;
  end if;

  return v_payment;
end;
$$;

revoke all on function public.reject_payment(uuid) from public;
grant execute on function public.reject_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Audit + RLS.
-- ---------------------------------------------------------------------
create trigger audit_subscriptions
  after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row_change();

create trigger audit_invoices
  after insert or update or delete on public.invoices
  for each row execute function public.audit_row_change();

create trigger audit_payments
  after insert or update or delete on public.payments
  for each row execute function public.audit_row_change();

alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.payments enable row level security;

create policy subscriptions_internal_all on public.subscriptions
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy subscriptions_select_own_client on public.subscriptions
  for select using (client_id = public.current_profile_client_id());

-- client_user is excluded from invoices/payments per build spec §4 ("client_user
-- ... Cannot view payroll or invoices") — only client_admin sees billing.
create policy invoices_internal_all on public.invoices
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy invoices_select_own_client_admin on public.invoices
  for select using (
    client_id = public.current_profile_client_id()
    and public.current_profile_role() = 'client_admin'
  );

create policy invoice_lines_internal_all on public.invoice_lines
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy invoice_lines_select_own_client_admin on public.invoice_lines
  for select using (
    invoice_id in (
      select id from public.invoices
      where client_id = public.current_profile_client_id()
    )
    and public.current_profile_role() = 'client_admin'
  );

create policy payments_internal_all on public.payments
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy payments_select_own_client_admin on public.payments
  for select using (
    invoice_id in (
      select id from public.invoices
      where client_id = public.current_profile_client_id()
    )
    and public.current_profile_role() = 'client_admin'
  );
-- client_admin submits proof of payment themselves (uploads a payment row
-- referencing their own proof_document_id); it starts life as 'submitted'
-- and only confirm_payment()/reject_payment() (owner/staff only) may move
-- it from there.
create policy payments_insert_own_client_admin on public.payments
  for insert
  with check (
    status = 'submitted'
    and invoice_id in (
      select id from public.invoices
      where client_id = public.current_profile_client_id()
    )
    and public.current_profile_role() = 'client_admin'
  );
