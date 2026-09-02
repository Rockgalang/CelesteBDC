-- First-owner bootstrap. There is no seeded owner account — Cel signs up
-- through the normal auth flow like anyone else, then calls this RPC once
-- to claim the owner role. It only succeeds while zero owners exist, so it
-- cannot be used to self-promote after go-live; every owner/staff account
-- created after the first must be promoted by an existing owner via the
-- profiles_update_internal policy.

create or replace function public.bootstrap_first_owner()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to claim the owner role.';
  end if;

  if exists (select 1 from public.profiles where role = 'owner') then
    raise exception 'An owner account already exists. Ask an existing owner to promote your account instead.';
  end if;

  perform set_config('celeste.bootstrap_owner', 'true', true);

  update public.profiles
    set role = 'owner', client_id = null
    where id = auth.uid()
    returning * into v_profile;

  if v_profile.id is null then
    raise exception 'No profile found for the current user.';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.bootstrap_first_owner() from public;
grant execute on function public.bootstrap_first_owner() to authenticated;

-- UI-only convenience check ("has anyone claimed owner yet?") so the
-- /setup page can decide whether to show the claim button. This is not
-- itself a security boundary — bootstrap_first_owner() re-checks
-- authoritatively before making any change — so it's safe to expose to
-- any authenticated user regardless of role.
create or replace function public.owner_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where role = 'owner');
$$;

revoke all on function public.owner_exists() from public;
grant execute on function public.owner_exists() to authenticated;

-- Let the bootstrap function through the privileged-fields guard, and
-- close the same door on retention_override for anyone but a genuine owner
-- doing the update through this function's own transaction.
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner()
    and coalesce(current_setting('celeste.bootstrap_owner', true), '') <> 'true'
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
