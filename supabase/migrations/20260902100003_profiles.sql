-- Identity/RBAC. profiles.id = auth.users.id by design (build spec §4/§6.1).

create type public.user_role as enum (
  'owner',
  'staff',
  'client_admin',
  'client_user',
  'employee'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'client_user',
  client_id uuid references public.clients (id) on delete set null,
  full_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint profiles_internal_roles_no_client
    check (
      (role in ('owner', 'staff') and client_id is null)
      or (role in ('client_admin', 'client_user', 'employee'))
    )
);

comment on table public.profiles is
  'One row per auth.users row, created automatically by handle_new_user(). role + client_id drive every RLS policy in the schema.';

create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_client_id_idx on public.profiles (client_id);
create index profiles_role_idx on public.profiles (role);

-- Role/client_id lookups for the current session, used throughout RLS
-- policies (20260902100008_rls.sql onward). SECURITY DEFINER + a fixed
-- search_path so the function can read profiles regardless of the
-- caller's own RLS grants, without becoming an injection vector. These
-- are LANGUAGE sql functions, so Postgres resolves their table
-- references at CREATE FUNCTION time — they have to live after
-- public.profiles exists, not in the earlier extensions/helpers
-- migration.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'owner';
$$;

create or replace function public.is_owner_or_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('owner', 'staff');
$$;

-- Auto-provision a profile row when a new auth user is created. Role
-- defaults to client_user; owner/staff accounts are promoted explicitly
-- (see 20260902100010_owner_bootstrap.sql) — nobody becomes internal staff
-- by signing up through the public form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
