-- Lets a client_admin ask Celeste to handle a registration (DTI/SEC, BIR,
-- Mayor's Permit) themselves, from the self-registration permits step,
-- without granting them the general create_registration_job() privilege
-- (which stays owner/staff-only — registration_jobs is an internal
-- pipeline clients only ever read, per 20260902100011).
--
-- Deliberately NOT implemented as create_registration_job() called from
-- inside a SECURITY DEFINER wrapper: that function re-checks
-- is_owner_or_staff() itself, and auth.uid() (and therefore that check)
-- is unchanged across a SECURITY DEFINER call — a client_admin session
-- would still fail it. So the job/stage/checklist instantiation is
-- duplicated here, scoped to the caller's own client_id only.

create or replace function public.request_client_registration_job(
  p_job_type public.job_type
)
returns public.registration_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_job public.registration_jobs;
  v_first_stage text;
begin
  if public.current_profile_role() <> 'client_admin' then
    raise exception 'Only a client admin can request a registration job.';
  end if;

  v_client_id := public.current_profile_client_id();
  if v_client_id is null then
    raise exception 'No business linked to this account.';
  end if;

  -- Already have an open job of this type for this client — return it
  -- rather than creating a duplicate (the client may resubmit the form).
  select * into v_job
  from public.registration_jobs
  where client_id = v_client_id
    and job_type = p_job_type
    and status not in ('completed', 'cancelled')
  order by created_at desc
  limit 1;
  if v_job.id is not null then
    return v_job;
  end if;

  insert into public.registration_jobs (client_id, job_type, notes, created_by)
  values (
    v_client_id, p_job_type,
    'Requested by client during self-registration onboarding.',
    auth.uid()
  )
  returning * into v_job;

  insert into public.job_stages (job_id, name, sequence, status)
  select
    v_job.id, t.name, t.sequence,
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

revoke all on function public.request_client_registration_job(public.job_type) from public;
grant execute on function public.request_client_registration_job(public.job_type) to authenticated;
