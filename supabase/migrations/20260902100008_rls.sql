-- Row-level security. Every table with client, financial, or employee data
-- gets a policy — enforced here at the database, not only in application
-- code (build spec §4). Cross-tenant reads must fail even against a forged
-- application-layer request; see supabase/tests/rls_cross_tenant.test.sql.

alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.billing_config enable row level security;
alter table public.documents enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------
-- clients: internal registry. owner/staff manage it; a client's own users
-- may read (never write) their own row only.
-- ---------------------------------------------------------------------
create policy clients_select_internal on public.clients
  for select
  using (public.is_owner_or_staff());

create policy clients_select_own on public.clients
  for select
  using (id = public.current_profile_client_id());

create policy clients_write_internal on public.clients
  for insert
  with check (public.is_owner_or_staff());

create policy clients_update_internal on public.clients
  for update
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy clients_delete_owner_only on public.clients
  for delete
  using (public.is_owner());

-- ---------------------------------------------------------------------
-- client_contacts
-- ---------------------------------------------------------------------
create policy client_contacts_internal_all on public.client_contacts
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy client_contacts_select_own on public.client_contacts
  for select
  using (client_id = public.current_profile_client_id());

-- ---------------------------------------------------------------------
-- profiles: everyone can read their own row; owner/staff can read all.
-- Privileged fields (role, client_id, active) are locked down further by
-- the guard_profile_privileged_fields trigger below — RLS alone can't do
-- column-level checks.
-- ---------------------------------------------------------------------
create policy profiles_select_self on public.profiles
  for select
  using (id = auth.uid());

create policy profiles_select_internal on public.profiles
  for select
  using (public.is_owner_or_staff());

create policy profiles_update_self on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_internal on public.profiles
  for update
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy profiles_delete_owner_only on public.profiles
  for delete
  using (public.is_owner());

-- Only an owner may change role, client_id, or active on ANY profile,
-- including their own — prevents a compromised or careless staff/client
-- session from self-promoting.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
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

create trigger guard_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_fields();

-- ---------------------------------------------------------------------
-- plans: readable by any authenticated user (pricing, upsell prompts);
-- only owner may edit (build spec §4: "Only role that can ... edit plans").
-- ---------------------------------------------------------------------
create policy plans_select_authenticated on public.plans
  for select
  to authenticated
  using (true);

create policy plans_write_owner_only on public.plans
  for insert
  with check (public.is_owner());

create policy plans_update_owner_only on public.plans
  for update
  using (public.is_owner())
  with check (public.is_owner());

create policy plans_delete_owner_only on public.plans
  for delete
  using (public.is_owner());

-- ---------------------------------------------------------------------
-- billing_config: internal only. Client-facing copy (e.g. "additional
-- entries bill at ₱10 each") is rendered server-side from this table, not
-- read directly by client/portal roles.
-- ---------------------------------------------------------------------
create policy billing_config_internal_select on public.billing_config
  for select
  using (public.is_owner_or_staff());

create policy billing_config_write_owner_only on public.billing_config
  for insert
  with check (public.is_owner());

create policy billing_config_update_owner_only on public.billing_config
  for update
  using (public.is_owner())
  with check (public.is_owner());

-- ---------------------------------------------------------------------
-- documents: owner/staff see everything; client roles see only their own
-- client's documents and may upload but not delete (deletion is further
-- gated by enforce_document_retention()).
-- ---------------------------------------------------------------------
create policy documents_internal_all on public.documents
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy documents_select_own_client on public.documents
  for select
  using (client_id = public.current_profile_client_id());

create policy documents_insert_own_client on public.documents
  for insert
  with check (client_id = public.current_profile_client_id());

-- ---------------------------------------------------------------------
-- audit_log: append-only, internal-only. No update/delete policy exists
-- for any role — rows are immutable once written. Inserts happen only via
-- the SECURITY DEFINER audit_row_change() trigger function, never
-- directly, so no insert policy is granted to application roles either.
-- ---------------------------------------------------------------------
create policy audit_log_select_internal on public.audit_log
  for select
  using (public.is_owner_or_staff());
