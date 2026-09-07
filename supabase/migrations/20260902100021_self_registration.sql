-- Self-service business registration (build spec §2.4, §6.1, §7.10 taken
-- further): a brand-new client_user can register their own business from
-- the portal instead of waiting for staff to create the client record.
--
-- Flow: choose a plan -> self_register_business() creates the clients /
-- subscriptions / issued invoice / invoice_lines rows and promotes the
-- caller to client_admin of that new client, in one transaction -> the
-- caller is redirected into the EXISTING invoice/payment pipeline
-- (payments/PaymentPanel, confirm_payment()) to submit GCash proof of
-- payment -> while payment is pending, the same client_admin fills in the
-- rest of the business's details and an intake questionnaire.
--
-- clients.status stays 'onboarding' throughout; only staff (activateClientAction,
-- already built) flips it to 'active' — self-registration never bypasses
-- that human checkpoint, matching every other onboarding path in this app.

-- ---------------------------------------------------------------------
-- Flexible intake questionnaire answers. A jsonb blob rather than a rigid
-- table: the question set is expected to evolve, and there's exactly one
-- respondent (the client_admin) per client.
-- ---------------------------------------------------------------------
alter table public.clients
  add column intake_responses jsonb not null default '{}'::jsonb;

comment on column public.clients.intake_responses is
  'Free-form answers to the self-registration intake questionnaire (e.g. sales-reporting cadence, transaction volume). Shape is owned by the application, not the schema.';

-- ---------------------------------------------------------------------
-- Manual payment channels (build spec §2.4: no gateway, manual GCash
-- confirmation only). Real account details are entered by the owner, never
-- fabricated by the application — a client sees "not yet configured" until
-- an owner fills this in. qr_image_data_url holds an owner-uploaded photo
-- of the REAL GCash QR (small, so stored inline rather than through the
-- client-scoped document-storage pipeline, which a not-yet-registered
-- client_user has no folder in yet).
-- ---------------------------------------------------------------------
create table public.payment_channels (
  id uuid primary key default gen_random_uuid(),
  method public.payment_method not null,
  label text not null,
  account_name text,
  account_number text,
  qr_image_data_url text,
  instructions text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.payment_channels
  for each row execute function public.set_updated_at();

alter table public.payment_channels enable row level security;

-- Any authenticated user may read active channels — including a
-- client_user mid self-registration who has no client_id yet.
create policy payment_channels_select_authenticated on public.payment_channels
  for select
  to authenticated
  using (active);

create policy payment_channels_select_internal on public.payment_channels
  for select
  using (public.is_owner_or_staff());

create policy payment_channels_write_owner_only on public.payment_channels
  for insert
  with check (public.is_owner());

create policy payment_channels_update_owner_only on public.payment_channels
  for update
  using (public.is_owner())
  with check (public.is_owner());

create policy payment_channels_delete_owner_only on public.payment_channels
  for delete
  using (public.is_owner());

-- ---------------------------------------------------------------------
-- Let a client_admin edit their OWN client row (business details step),
-- but never the staff-controlled lifecycle fields.
-- ---------------------------------------------------------------------
create policy clients_update_own_client_admin on public.clients
  for update
  using (
    id = public.current_profile_client_id()
    and public.current_profile_role() = 'client_admin'
  )
  with check (
    id = public.current_profile_client_id()
    and public.current_profile_role() = 'client_admin'
  );

create or replace function public.guard_client_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner_or_staff() then
    if new.status is distinct from old.status
      or new.onboarded_at is distinct from old.onboarded_at
      or new.cancelled_at is distinct from old.cancelled_at
    then
      raise exception 'Only owner or staff can change a client''s status.';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_client_privileged_fields
  before update on public.clients
  for each row execute function public.guard_client_privileged_fields();

-- ---------------------------------------------------------------------
-- Let self_register_business() promote the caller's own profile to
-- client_admin. Same escape-hatch pattern as bootstrap_first_owner():
-- a transaction-local flag lets one specific SECURITY DEFINER function
-- through the privileged-fields guard; the guard still blocks every other
-- caller, and the function itself only ever updates auth.uid()'s own row.
-- ---------------------------------------------------------------------
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner()
    and coalesce(current_setting('celeste.bootstrap_owner', true), '') <> 'true'
    and coalesce(current_setting('celeste.self_register', true), '') <> 'true'
  then
    if new.role is distinct from old.role
      or new.client_id is distinct from old.client_id
      or new.active is distinct from old.active
    then
      raise exception 'Only owner can change role, client_id, or active on a profile.';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- self_register_business: the entry point for the whole flow. Only a
-- signed-in client_user with no client_id yet may call it, and only once
-- (client_id is null is re-checked here, not just inferred from role).
-- ---------------------------------------------------------------------
create or replace function public.self_register_business(
  p_business_name text,
  p_entity_type public.entity_type,
  p_tax_type public.tax_type,
  p_plan_code text,
  p_cycle public.subscription_cycle
)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_client public.clients;
  v_plan public.plans;
  v_subscription public.subscriptions;
  v_invoice public.invoices;
  v_period_end date;
  v_price_locked_until date;
  v_locked_price numeric(14, 2);
  v_unit_price numeric(14, 2);
  v_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to register a business.';
  end if;

  if btrim(coalesce(p_business_name, '')) = '' then
    raise exception 'Business name is required.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'No profile found for the current user.';
  end if;
  if v_profile.role <> 'client_user' or v_profile.client_id is not null then
    raise exception 'This account is already linked to a business.';
  end if;

  select * into v_plan from public.plans where code = p_plan_code and active;
  if v_plan.id is null then
    raise exception 'Plan % not found.', p_plan_code;
  end if;

  select email into v_user_email from auth.users where id = auth.uid();

  insert into public.clients (
    business_name, entity_type, tax_type, vat_registered, status, created_by
  )
  values (
    btrim(p_business_name), p_entity_type, p_tax_type, p_tax_type = 'vat', 'onboarding', auth.uid()
  )
  returning * into v_client;

  insert into public.client_contacts (
    client_id, name, email, phone, is_primary, created_by
  )
  values (
    v_client.id, coalesce(v_profile.full_name, v_client.business_name),
    v_user_email, v_profile.phone, true, auth.uid()
  );

  perform set_config('celeste.self_register', 'true', true);
  update public.profiles
    set role = 'client_admin', client_id = v_client.id
    where id = auth.uid();

  if p_cycle = 'annual' then
    v_period_end := current_date + interval '1 year' - interval '1 day';
    v_price_locked_until := current_date + interval '1 year';
    v_locked_price := v_plan.price_annual_monthly;
    v_unit_price := v_plan.price_annual_monthly;
  else
    v_period_end := current_date + interval '1 month' - interval '1 day';
    v_unit_price := v_plan.price_monthly;
  end if;

  insert into public.subscriptions (
    client_id, plan_id, cycle, current_period_end,
    price_locked_until, locked_price, created_by
  )
  values (
    v_client.id, v_plan.id, p_cycle, v_period_end,
    v_price_locked_until, v_locked_price, auth.uid()
  )
  returning * into v_subscription;

  insert into public.invoices (
    client_id, subscription_id, due_date, period_start, period_end, status, created_by
  )
  values (
    v_client.id, v_subscription.id, current_date + 7,
    v_subscription.current_period_start, v_period_end, 'issued', auth.uid()
  )
  returning * into v_invoice;

  insert into public.invoice_lines (
    invoice_id, kind, description, qty, unit_price, created_by
  )
  values (
    v_invoice.id, 'subscription',
    v_plan.name || ' plan (' || p_cycle || ', first period)',
    1, v_unit_price, auth.uid()
  );

  select * into v_client from public.clients where id = v_client.id;
  return v_client;
end;
$$;

revoke all on function public.self_register_business(
  text, public.entity_type, public.tax_type, text, public.subscription_cycle
) from public;
grant execute on function public.self_register_business(
  text, public.entity_type, public.tax_type, text, public.subscription_cycle
) to authenticated;
