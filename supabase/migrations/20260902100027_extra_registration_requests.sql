-- "Client's Files" build spec ask: a client can request an extra,
-- out-of-subscription registration (PhilGEPS, PhilHealth, etc. — anything
-- outside the standard public.job_type pipeline their plan already covers)
-- and Cel negotiates a price before any work starts. This is deliberately
-- NOT the same path as request_client_registration_job() (20260902100023):
-- that one instantiates a real registration_jobs pipeline immediately for
-- in-plan job types. An extra registration must never become billable work
-- until Cel has quoted a fee and the client has accepted it.

create type public.extra_registration_status as enum (
  'pending', 'quoted', 'accepted', 'declined'
);

create table public.extra_registration_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  label text not null,
  note text,
  status public.extra_registration_status not null default 'pending',
  quoted_fee numeric(12, 2),
  quoted_note text,
  quoted_by uuid references auth.users (id),
  quoted_at timestamptz,
  decided_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.extra_registration_requests
  for each row execute function public.set_updated_at();

create index extra_registration_requests_client_id_idx
  on public.extra_registration_requests (client_id);

create trigger audit_extra_registration_requests
  after insert or update or delete on public.extra_registration_requests
  for each row execute function public.audit_row_change();

alter table public.extra_registration_requests enable row level security;

create policy extra_registration_requests_internal_all on public.extra_registration_requests
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy extra_registration_requests_own_client_select on public.extra_registration_requests
  for select
  using (client_id = public.current_profile_client_id());

-- A client can only ever raise a brand-new request — quoting, accepting,
-- and declining all go through the RPCs below, never a direct update, so
-- there's no own-client update policy at all here.
create policy extra_registration_requests_own_client_insert on public.extra_registration_requests
  for insert
  with check (
    client_id = public.current_profile_client_id()
    and status = 'pending'
    and quoted_fee is null
  );

-- ---------------------------------------------------------------------
-- quote_extra_registration_request: owner/staff only. Names the price
-- before any work starts.
-- ---------------------------------------------------------------------
create or replace function public.quote_extra_registration_request(
  p_id uuid, p_fee numeric, p_note text
)
returns public.extra_registration_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.extra_registration_requests;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can quote a registration request.';
  end if;
  if p_fee is null or p_fee <= 0 then
    raise exception 'Quoted fee must be a positive amount.';
  end if;

  update public.extra_registration_requests
    set status = 'quoted', quoted_fee = p_fee, quoted_note = p_note,
        quoted_by = auth.uid(), quoted_at = now()
    where id = p_id and status = 'pending'
    returning * into v_request;

  if v_request.id is null then
    raise exception 'Request % not found or not pending.', p_id;
  end if;

  return v_request;
end;
$$;

revoke all on function public.quote_extra_registration_request(uuid, numeric, text) from public;
grant execute on function public.quote_extra_registration_request(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- decline_extra_registration_request: owner/staff only. Turns down a
-- request outright (e.g. it isn't something Celeste can help with) without
-- ever naming a fee.
-- ---------------------------------------------------------------------
create or replace function public.decline_extra_registration_request(
  p_id uuid, p_note text
)
returns public.extra_registration_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.extra_registration_requests;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can decline a registration request.';
  end if;

  update public.extra_registration_requests
    set status = 'declined', quoted_note = p_note, quoted_by = auth.uid(),
        decided_at = now()
    where id = p_id and status in ('pending', 'quoted')
    returning * into v_request;

  if v_request.id is null then
    raise exception 'Request % not found or already decided.', p_id;
  end if;

  return v_request;
end;
$$;

revoke all on function public.decline_extra_registration_request(uuid, text) from public;
grant execute on function public.decline_extra_registration_request(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- respond_extra_registration_request: the client's own accept/decline on
-- a quote Cel already sent. Owner/staff can also call this on the
-- client's behalf (e.g. logging a verbal confirmation).
-- ---------------------------------------------------------------------
create or replace function public.respond_extra_registration_request(
  p_id uuid, p_accept boolean
)
returns public.extra_registration_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.extra_registration_requests;
begin
  select * into v_request from public.extra_registration_requests where id = p_id;
  if v_request.id is null then
    raise exception 'Request % not found.', p_id;
  end if;
  if not public.is_owner_or_staff() and v_request.client_id <> public.current_profile_client_id() then
    raise exception 'You can only respond to your own business''s requests.';
  end if;
  if v_request.status <> 'quoted' then
    raise exception 'Request % is not awaiting a response.', p_id;
  end if;

  update public.extra_registration_requests
    set status = case when p_accept then 'accepted' else 'declined' end::public.extra_registration_status,
        decided_at = now()
    where id = p_id
    returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.respond_extra_registration_request(uuid, boolean) from public;
grant execute on function public.respond_extra_registration_request(uuid, boolean) to authenticated;
