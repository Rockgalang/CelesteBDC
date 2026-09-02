-- Append-only audit log (build spec §2.3): every read and write of client
-- financial/employee data must be logged.
--
-- Writes are captured here with a generic trigger attached to every table
-- that holds client data — enforced at the database level so an
-- application-layer bug can't silently skip logging. Reads cannot be
-- captured by a trigger (there's no DML event to hang one on); those are
-- logged from the application's Supabase client wrapper
-- (src/lib/supabase/audited.ts) instead. This is a deliberate two-layer
-- design, not a gap: writes get a hard DB-level guarantee, reads get a
-- best-effort application-level one, which is the same tradeoff every
-- Postgres-backed audit system with row-level read logging makes.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id),
  action text not null, -- 'insert' | 'update' | 'delete' | 'read'
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is
  'Append-only. No update/delete grants are given to any application role — see RLS policy in 20260902100008_rls.sql.';

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_profile_id);
create index audit_log_created_at_idx on public.audit_log (created_at);

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := 'update';
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_entity_id := new.id;
  elsif tg_op = 'DELETE' then
    v_action := case
      when nullif(current_setting('celeste.retention_override_reason', true), '') is not null
        then 'delete_retention_override'
      else 'delete'
    end;
    v_before := to_jsonb(old);
    v_entity_id := old.id;
  end if;

  insert into public.audit_log (
    actor_profile_id, action, entity_type, entity_id, before, after
  ) values (
    auth.uid(),
    v_action,
    tg_table_name,
    v_entity_id,
    case when v_action = 'delete_retention_override'
      then v_before || jsonb_build_object('_override_reason',
        current_setting('celeste.retention_override_reason', true))
      else v_before
    end,
    v_after
  );

  return coalesce(new, old);
end;
$$;

-- Attach to every table containing client financial or employee data.
-- Add a matching trigger here whenever a new such table is introduced in
-- a later phase.
create trigger audit_clients
  after insert or update or delete on public.clients
  for each row execute function public.audit_row_change();

create trigger audit_client_contacts
  after insert or update or delete on public.client_contacts
  for each row execute function public.audit_row_change();

create trigger audit_documents
  after insert or update or delete on public.documents
  for each row execute function public.audit_row_change();

create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.audit_row_change();
