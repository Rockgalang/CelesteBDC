-- Registration pipeline (build spec §6.3, §7.3).
--
-- Deliberate deviation from the spec's literal `renewal_*` job_type enum
-- values: renewals reuse the same job_type as the original registration
-- plus an `is_renewal` flag, rather than doubling the enum. The renewal
-- engine (§6.4, not yet built — it auto-creates a job 60 days before a
-- document's expires_at) can set this flag when it creates a job; nothing
-- else in this migration depends on the distinction.
--
-- Checklist/stage templates are seeded with generic, representative steps
-- per job_type. Section 10 of the operations manual (the actual source
-- the spec names) was not available to generate this from — Cel should
-- review and correct these templates before relying on them operationally.
-- Existing jobs are unaffected by future template edits; only new jobs
-- instantiate from the current template rows.

create type public.job_type as enum (
  'dti',
  'sec',
  'lgu_barangay',
  'lgu_mayors_permit',
  'lgu_zoning',
  'lgu_sanitary',
  'lgu_fire',
  'bir_registration',
  'bir_atp',
  'bir_books',
  'sec_gis'
);

create type public.job_status as enum (
  'not_started',
  'in_progress',
  'blocked',
  'completed',
  'cancelled'
);

create type public.stage_status as enum (
  'pending',
  'in_progress',
  'completed',
  'skipped'
);

-- ---------------------------------------------------------------------
-- Templates. Owner-editable (RLS below); instantiated by
-- public.create_registration_job() when a job is created.
-- ---------------------------------------------------------------------
create table public.job_stage_templates (
  id uuid primary key default gen_random_uuid(),
  job_type public.job_type not null,
  name text not null,
  sequence smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (job_type, sequence)
);

create trigger set_updated_at
  before update on public.job_stage_templates
  for each row execute function public.set_updated_at();

create table public.job_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  job_type public.job_type not null,
  label text not null,
  required boolean not null default true,
  sequence smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (job_type, sequence)
);

create trigger set_updated_at
  before update on public.job_checklist_templates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Live jobs.
-- ---------------------------------------------------------------------
create table public.registration_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  job_type public.job_type not null,
  is_renewal boolean not null default false,
  status public.job_status not null default 'not_started',
  -- Denormalized copy of the active job_stages.name, kept in sync by
  -- advance_registration_job_stage(). Lets the ops cockpit and Kanban
  -- board render the current stage without a join in the common case.
  current_stage text,
  target_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.registration_jobs
  for each row execute function public.set_updated_at();

create index registration_jobs_client_id_idx on public.registration_jobs (client_id);
create index registration_jobs_status_idx on public.registration_jobs (status);

create table public.job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.registration_jobs (id) on delete cascade,
  name text not null,
  sequence smallint not null,
  status public.stage_status not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  unique (job_id, sequence)
);

create trigger set_updated_at
  before update on public.job_stages
  for each row execute function public.set_updated_at();

create index job_stages_job_id_idx on public.job_stages (job_id);

create table public.job_checklist_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.registration_jobs (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  satisfied_by_document_id uuid references public.documents (id) on delete set null,
  satisfied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.job_checklist_items
  for each row execute function public.set_updated_at();

create index job_checklist_items_job_id_idx on public.job_checklist_items (job_id);

create table public.government_fees (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.registration_jobs (id) on delete cascade,
  agency text not null,
  description text not null,
  amount_at_cost numeric(14, 2) not null,
  handling_fee numeric(14, 2) not null,
  receipt_document_id uuid references public.documents (id) on delete set null,
  -- Set once this fee is picked up by an invoice line (Phase 1 billing
  -- migration, 20260902100012). NULL means "not yet billed" — the next
  -- invoice-generation run picks up every government_fees row for the
  -- client with billed_invoice_id is null.
  billed_invoice_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.government_fees
  for each row execute function public.set_updated_at();

create index government_fees_job_id_idx on public.government_fees (job_id);
create index government_fees_unbilled_idx on public.government_fees (billed_invoice_id)
  where billed_invoice_id is null;

-- ---------------------------------------------------------------------
-- Instantiate a job's stages + checklist from the current templates for
-- its job_type, atomically. Called via RPC from the "create job" action
-- rather than done as two separate app-side inserts, so a template change
-- mid-request can't leave a job with stages but no checklist or vice versa.
-- ---------------------------------------------------------------------
create or replace function public.create_registration_job(
  p_client_id uuid,
  p_job_type public.job_type,
  p_is_renewal boolean default false,
  p_target_date date default null,
  p_notes text default null
)
returns public.registration_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.registration_jobs;
  v_first_stage text;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can create registration jobs.';
  end if;

  insert into public.registration_jobs (client_id, job_type, is_renewal, target_date, notes)
  values (p_client_id, p_job_type, p_is_renewal, p_target_date, p_notes)
  returning * into v_job;

  insert into public.job_stages (job_id, name, sequence, status)
  select
    v_job.id,
    t.name,
    t.sequence,
    case when t.sequence = 1 then 'in_progress'::public.stage_status else 'pending'::public.stage_status end
  from public.job_stage_templates t
  where t.job_type = p_job_type
  order by t.sequence;

  select name into v_first_stage
  from public.job_stages
  where job_id = v_job.id and sequence = 1;

  insert into public.job_checklist_items (job_id, label, required)
  select v_job.id, t.label, t.required
  from public.job_checklist_templates t
  where t.job_type = p_job_type
  order by t.sequence;

  update public.registration_jobs
    set current_stage = v_first_stage, status = 'in_progress'
    where id = v_job.id
    returning * into v_job;

  return v_job;
end;
$$;

revoke all on function public.create_registration_job(uuid, public.job_type, boolean, date, text) from public;
grant execute on function public.create_registration_job(uuid, public.job_type, boolean, date, text) to authenticated;

-- Advance a job to its next pending stage (or complete the job if the
-- stage just finished was the last one). Keeps job_stages.status,
-- registration_jobs.current_stage, and registration_jobs.status /
-- completed_at consistent in one transaction.
create or replace function public.advance_registration_job_stage(p_job_id uuid)
returns public.registration_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.job_stages;
  v_next public.job_stages;
  v_job public.registration_jobs;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can advance a registration job.';
  end if;

  select * into v_current
  from public.job_stages
  where job_id = p_job_id and status = 'in_progress'
  order by sequence
  limit 1;

  if v_current.id is null then
    raise exception 'Job % has no stage currently in progress.', p_job_id;
  end if;

  update public.job_stages
    set status = 'completed', completed_at = now()
    where id = v_current.id;

  select * into v_next
  from public.job_stages
  where job_id = p_job_id and sequence = v_current.sequence + 1;

  if v_next.id is null then
    update public.registration_jobs
      set status = 'completed', completed_at = now(), current_stage = v_current.name
      where id = p_job_id
      returning * into v_job;
  else
    update public.job_stages
      set status = 'in_progress'
      where id = v_next.id;

    update public.registration_jobs
      set current_stage = v_next.name
      where id = p_job_id
      returning * into v_job;
  end if;

  return v_job;
end;
$$;

revoke all on function public.advance_registration_job_stage(uuid) from public;
grant execute on function public.advance_registration_job_stage(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Audit + RLS.
-- ---------------------------------------------------------------------
create trigger audit_registration_jobs
  after insert or update or delete on public.registration_jobs
  for each row execute function public.audit_row_change();

create trigger audit_government_fees
  after insert or update or delete on public.government_fees
  for each row execute function public.audit_row_change();

alter table public.job_stage_templates enable row level security;
alter table public.job_checklist_templates enable row level security;
alter table public.registration_jobs enable row level security;
alter table public.job_stages enable row level security;
alter table public.job_checklist_items enable row level security;
alter table public.government_fees enable row level security;

create policy job_stage_templates_select_internal on public.job_stage_templates
  for select using (public.is_owner_or_staff());
create policy job_stage_templates_write_owner_only on public.job_stage_templates
  for insert with check (public.is_owner());
create policy job_stage_templates_update_owner_only on public.job_stage_templates
  for update using (public.is_owner()) with check (public.is_owner());
create policy job_stage_templates_delete_owner_only on public.job_stage_templates
  for delete using (public.is_owner());

create policy job_checklist_templates_select_internal on public.job_checklist_templates
  for select using (public.is_owner_or_staff());
create policy job_checklist_templates_write_owner_only on public.job_checklist_templates
  for insert with check (public.is_owner());
create policy job_checklist_templates_update_owner_only on public.job_checklist_templates
  for update using (public.is_owner()) with check (public.is_owner());
create policy job_checklist_templates_delete_owner_only on public.job_checklist_templates
  for delete using (public.is_owner());

create policy registration_jobs_internal_all on public.registration_jobs
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy registration_jobs_select_own_client on public.registration_jobs
  for select using (client_id = public.current_profile_client_id());

create policy job_stages_internal_all on public.job_stages
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy job_stages_select_own_client on public.job_stages
  for select using (
    job_id in (select id from public.registration_jobs where client_id = public.current_profile_client_id())
  );

create policy job_checklist_items_internal_all on public.job_checklist_items
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy job_checklist_items_select_own_client on public.job_checklist_items
  for select using (
    job_id in (select id from public.registration_jobs where client_id = public.current_profile_client_id())
  );

create policy government_fees_internal_all on public.government_fees
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());
create policy government_fees_select_own_client on public.government_fees
  for select using (
    job_id in (select id from public.registration_jobs where client_id = public.current_profile_client_id())
  );

-- ---------------------------------------------------------------------
-- Seed templates. ⚠️ VERIFY against operations manual §10 before relying
-- on these operationally — see the migration header comment.
-- ---------------------------------------------------------------------
insert into public.job_stage_templates (job_type, name, sequence) values
  ('dti', 'Business Name Verification', 1),
  ('dti', 'Application Submission', 2),
  ('dti', 'Payment', 3),
  ('dti', 'Certificate Issuance', 4),
  ('sec', 'Name Reservation', 1),
  ('sec', 'Document Preparation', 2),
  ('sec', 'SEC Filing', 3),
  ('sec', 'Certificate Issuance', 4),
  ('lgu_barangay', 'Requirements Gathering', 1),
  ('lgu_barangay', 'Application Submission', 2),
  ('lgu_barangay', 'Payment', 3),
  ('lgu_barangay', 'Clearance Issuance', 4),
  ('lgu_mayors_permit', 'Requirements Gathering', 1),
  ('lgu_mayors_permit', 'Assessment', 2),
  ('lgu_mayors_permit', 'Payment', 3),
  ('lgu_mayors_permit', 'Permit Issuance', 4),
  ('lgu_zoning', 'Application Submission', 1),
  ('lgu_zoning', 'Site Inspection', 2),
  ('lgu_zoning', 'Clearance Issuance', 3),
  ('lgu_sanitary', 'Application Submission', 1),
  ('lgu_sanitary', 'Inspection', 2),
  ('lgu_sanitary', 'Permit Issuance', 3),
  ('lgu_fire', 'Application Submission', 1),
  ('lgu_fire', 'Inspection', 2),
  ('lgu_fire', 'FSIC Issuance', 3),
  ('bir_registration', 'Requirements Gathering', 1),
  ('bir_registration', 'BIR Form 1901/1903 Filing', 2),
  ('bir_registration', 'Registration Fee Payment', 3),
  ('bir_registration', 'COR (Form 2303) Issuance', 4),
  ('bir_atp', 'Application Submission', 1),
  ('bir_atp', 'Accredited Printer Coordination', 2),
  ('bir_atp', 'ATP Issuance', 3),
  ('bir_books', 'Books Purchase', 1),
  ('bir_books', 'Registration/Stamping', 2),
  ('bir_books', 'Ready For Use', 3),
  ('sec_gis', 'Data Gathering', 1),
  ('sec_gis', 'GIS Preparation', 2),
  ('sec_gis', 'SEC Filing', 3);

insert into public.job_checklist_templates (job_type, label, required, sequence) values
  ('dti', 'Valid government ID', true, 1),
  ('dti', 'Proposed business name(s)', true, 2),
  ('sec', 'Articles of Incorporation/Partnership (draft)', true, 1),
  ('sec', 'By-laws (draft)', true, 2),
  ('sec', 'Valid government IDs of incorporators', true, 3),
  ('sec', 'Proof of registered address', true, 4),
  ('lgu_barangay', 'DTI/SEC certificate', true, 1),
  ('lgu_barangay', 'Proof of address (lease/title)', true, 2),
  ('lgu_barangay', 'Valid government ID', true, 3),
  ('lgu_mayors_permit', 'Barangay clearance', true, 1),
  ('lgu_mayors_permit', 'DTI/SEC certificate', true, 2),
  ('lgu_mayors_permit', 'Proof of address (lease/title)', true, 3),
  ('lgu_mayors_permit', 'Fire safety inspection certificate', false, 4),
  ('lgu_mayors_permit', 'Sanitary permit', false, 5),
  ('lgu_zoning', 'Site sketch/location map', true, 1),
  ('lgu_zoning', 'Proof of address (lease/title)', true, 2),
  ('lgu_sanitary', 'Health certificates of staff', false, 1),
  ('lgu_sanitary', 'Proof of address (lease/title)', true, 2),
  ('lgu_fire', 'Building/occupancy permit', false, 1),
  ('lgu_fire', 'Fire extinguisher proof of purchase', true, 2),
  ('bir_registration', 'DTI/SEC certificate', true, 1),
  ('bir_registration', 'Valid government ID', true, 2),
  ('bir_registration', 'Proof of address (lease/title)', true, 3),
  ('bir_registration', 'Mayor''s permit or application receipt', false, 4),
  ('bir_atp', 'BIR Certificate of Registration (Form 2303)', true, 1),
  ('bir_atp', 'Sample receipt/invoice layout', true, 2),
  ('bir_books', 'BIR Certificate of Registration (Form 2303)', true, 1),
  ('sec_gis', 'List of stockholders/officers', true, 1),
  ('sec_gis', 'Prior year GIS (if any)', false, 2);
