-- "Accounting Standards" admin settings menu (build spec §1.2): chart of
-- account templates become named, duplicatable, editable, renameable,
-- removable sets instead of the two fixed 'individual'/'corporate' groups
-- from 20260902100015. The two original groups are preserved as built-in
-- sets (protected from deletion); the owner can duplicate either into a
-- new custom set per business type and edit it freely.

create table public.chart_of_account_template_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  default_for_entity_types public.entity_type[] not null default '{}',
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.chart_of_account_template_sets
  for each row execute function public.set_updated_at();

create trigger audit_chart_of_account_template_sets
  after insert or update or delete on public.chart_of_account_template_sets
  for each row execute function public.audit_row_change();

alter table public.chart_of_account_template_sets enable row level security;

create policy chart_of_account_template_sets_select_internal on public.chart_of_account_template_sets
  for select using (public.is_owner_or_staff());
create policy chart_of_account_template_sets_insert_owner_only on public.chart_of_account_template_sets
  for insert with check (public.is_owner());
create policy chart_of_account_template_sets_update_owner_only on public.chart_of_account_template_sets
  for update using (public.is_owner()) with check (public.is_owner());
create policy chart_of_account_template_sets_delete_owner_only on public.chart_of_account_template_sets
  for delete using (public.is_owner());

create or replace function public.guard_builtin_template_set_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_builtin then
    raise exception 'Template set "%" is built-in and cannot be deleted.', old.name;
  end if;
  return old;
end;
$$;

create trigger guard_builtin_template_set_delete
  before delete on public.chart_of_account_template_sets
  for each row execute function public.guard_builtin_template_set_delete();

-- Seed the two existing groups as builtin sets, carrying over the entity
-- types get_template_group() used to route between them.
insert into public.chart_of_account_template_sets
  (id, name, description, default_for_entity_types, is_builtin)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Individual / Sole Proprietor',
    'Default chart of accounts for sole proprietors.',
    array['sole_proprietor']::public.entity_type[],
    true
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Corporate',
    'Default chart of accounts for OPCs, corporations, partnerships, and branch/rep offices.',
    array['opc', 'corporation', 'partnership', 'branch_office', 'rep_office']::public.entity_type[],
    true
  );

alter table public.chart_of_account_templates
  add column template_set_id uuid references public.chart_of_account_template_sets (id) on delete cascade;

update public.chart_of_account_templates
  set template_set_id = case template_group
    when 'individual' then '00000000-0000-0000-0000-000000000001'
    when 'corporate' then '00000000-0000-0000-0000-000000000002'
  end::uuid;

alter table public.chart_of_account_templates alter column template_set_id set not null;
alter table public.chart_of_account_templates
  drop constraint chart_of_account_templates_template_group_code_key;
alter table public.chart_of_account_templates
  add constraint chart_of_account_templates_template_set_id_code_key unique (template_set_id, code);
alter table public.chart_of_account_templates drop column template_group;

-- Templates were previously only select/insert/update by owner — no
-- delete policy at all, even though "removable" is part of the spec.
create policy chart_of_account_templates_delete_owner_only on public.chart_of_account_templates
  for delete using (public.is_owner());

drop function if exists public.get_template_group(public.entity_type);

create or replace function public.get_default_template_set_id(p_entity_type public.entity_type)
returns uuid
language sql
stable
as $$
  select id from public.chart_of_account_template_sets
  where p_entity_type = any(default_for_entity_types)
  order by is_builtin desc, created_at
  limit 1;
$$;

-- Instantiate a client's chart of accounts from a template set — either
-- the one explicitly passed, or the default set for the client's entity
-- type. Same "no-op on re-run" behavior as before (unique (client_id,
-- code) + ON CONFLICT DO NOTHING).
--
-- The original single-argument signature is dropped first: adding a
-- second (defaulted) parameter via plain CREATE OR REPLACE would create
-- an overload alongside it instead of replacing it, and a 1-argument
-- call would then be ambiguous between the two.
drop function if exists public.create_default_chart_of_accounts(uuid);

create or replace function public.create_default_chart_of_accounts(
  p_client_id uuid, p_template_set_id uuid default null
)
returns setof public.chart_of_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id uuid;
  v_entity_type public.entity_type;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can create a chart of accounts.';
  end if;

  select entity_type into v_entity_type from public.clients where id = p_client_id;
  if v_entity_type is null then
    raise exception 'Client % not found.', p_client_id;
  end if;

  v_set_id := coalesce(p_template_set_id, public.get_default_template_set_id(v_entity_type));
  if v_set_id is null then
    raise exception 'No chart of account template set is set as default for entity type %.', v_entity_type;
  end if;

  insert into public.chart_of_accounts (client_id, code, name, type, normal_balance, is_system)
  select p_client_id, t.code, t.name, t.type, t.normal_balance, true
  from public.chart_of_account_templates t
  where t.template_set_id = v_set_id
  order by t.sequence
  on conflict (client_id, code) do nothing;

  update public.chart_of_accounts coa
    set parent_id = parent.id
    from public.chart_of_account_templates t
    join public.chart_of_accounts parent
      on parent.client_id = p_client_id and parent.code = t.parent_code
    where coa.client_id = p_client_id
      and coa.code = t.code
      and t.template_set_id = v_set_id
      and t.parent_code is not null;

  return query select * from public.chart_of_accounts where client_id = p_client_id order by code;
end;
$$;

revoke all on function public.create_default_chart_of_accounts(uuid, uuid) from public;
grant execute on function public.create_default_chart_of_accounts(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- duplicate_chart_of_account_template_set: owner only. Copies a set's
-- rows into a brand-new, non-builtin set the owner can then edit freely.
-- ---------------------------------------------------------------------
create or replace function public.duplicate_chart_of_account_template_set(
  p_set_id uuid, p_name text
)
returns public.chart_of_account_template_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new public.chart_of_account_template_sets;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can duplicate a template set.';
  end if;

  insert into public.chart_of_account_template_sets (name, description, is_builtin, created_by)
  select p_name, description, false, auth.uid()
  from public.chart_of_account_template_sets
  where id = p_set_id
  returning * into v_new;

  if v_new.id is null then
    raise exception 'Template set % not found.', p_set_id;
  end if;

  insert into public.chart_of_account_templates
    (template_set_id, code, name, type, normal_balance, parent_code, sequence, created_by)
  select v_new.id, code, name, type, normal_balance, parent_code, sequence, auth.uid()
  from public.chart_of_account_templates
  where template_set_id = p_set_id;

  return v_new;
end;
$$;

revoke all on function public.duplicate_chart_of_account_template_set(uuid, text) from public;
grant execute on function public.duplicate_chart_of_account_template_set(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- set_chart_of_account_template_set_defaults: owner only. Assigns which
-- entity types default to this set, stealing any entity type away from
-- whichever other set currently claims it — an entity type can only ever
-- default to one set at a time.
-- ---------------------------------------------------------------------
create or replace function public.set_chart_of_account_template_set_defaults(
  p_set_id uuid, p_entity_types public.entity_type[]
)
returns public.chart_of_account_template_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set public.chart_of_account_template_sets;
  v_type public.entity_type;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can change template set defaults.';
  end if;

  foreach v_type in array coalesce(p_entity_types, '{}') loop
    update public.chart_of_account_template_sets
      set default_for_entity_types = array_remove(default_for_entity_types, v_type)
      where id <> p_set_id and v_type = any(default_for_entity_types);
  end loop;

  update public.chart_of_account_template_sets
    set default_for_entity_types = coalesce(p_entity_types, '{}')
    where id = p_set_id
    returning * into v_set;

  if v_set.id is null then
    raise exception 'Template set % not found.', p_set_id;
  end if;

  return v_set;
end;
$$;

revoke all on function public.set_chart_of_account_template_set_defaults(uuid, public.entity_type[]) from public;
grant execute on function public.set_chart_of_account_template_set_defaults(uuid, public.entity_type[]) to authenticated;
