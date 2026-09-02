-- Extensions and shared helper functions used by every later migration.

create extension if not exists "pgcrypto" with schema extensions;

-- updated_at maintenance, attached per-table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Role/client_id lookup functions (current_profile_role, is_owner, etc.)
-- live in 20260902100003_profiles.sql instead of here: they're LANGUAGE
-- sql functions that reference public.profiles, and Postgres resolves
-- those references at CREATE FUNCTION time — the table has to exist
-- first.
