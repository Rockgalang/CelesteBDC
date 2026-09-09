-- Extra Fee Ledger (build spec §2, renaming "Government Fee"): a
-- registration job's extra fees must be settled before its documents are
-- released. Cel may shoulder an unexpected fee mid-processing, but the
-- client must reimburse it — with a receipt on file to justify the
-- books — before the job can be marked completed.

create type public.extra_fee_status as enum ('pending', 'shouldered', 'settled');

alter table public.government_fees
  add column status public.extra_fee_status not null default 'pending',
  add column settled_at timestamptz,
  add column settled_by uuid references auth.users (id);

-- ---------------------------------------------------------------------
-- guard_job_completion_requires_settled_fees: a job can't be marked
-- 'completed' (documents released) while any of its extra fees are
-- still pending or only shouldered-but-unreimbursed.
-- ---------------------------------------------------------------------
create or replace function public.guard_job_completion_requires_settled_fees()
returns trigger
language plpgsql
as $$
declare
  v_unsettled_count integer;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    select count(*) into v_unsettled_count
    from public.government_fees
    where job_id = new.id and status <> 'settled';

    if v_unsettled_count > 0 then
      raise exception 'Job % has % unsettled extra fee(s) — settle them before marking the job completed.',
        new.id, v_unsettled_count;
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_job_completion_requires_settled_fees
  before update on public.registration_jobs
  for each row execute function public.guard_job_completion_requires_settled_fees();

-- ---------------------------------------------------------------------
-- mark_extra_fee_shouldered: owner/staff only. Cel paid this fee
-- upfront during processing — the client still owes it.
-- ---------------------------------------------------------------------
create or replace function public.mark_extra_fee_shouldered(p_fee_id uuid)
returns public.government_fees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee public.government_fees;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can update an extra fee.';
  end if;

  update public.government_fees
    set status = 'shouldered'
    where id = p_fee_id and status = 'pending'
    returning * into v_fee;

  if v_fee.id is null then
    raise exception 'Extra fee % not found or not pending.', p_fee_id;
  end if;

  return v_fee;
end;
$$;

revoke all on function public.mark_extra_fee_shouldered(uuid) from public;
grant execute on function public.mark_extra_fee_shouldered(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- settle_extra_fee: owner/staff only. Requires a receipt on file (either
-- already attached, or passed here) so every settled fee is justified in
-- the books. If the fee was never billed through an invoice (no
-- billed_invoice_id — e.g. the client reimbursed Cel directly), this
-- also books the expense straight into the client's own books; if it
-- was billed, confirming that invoice's payment already books it
-- (20260902100031), so this skips the entry to avoid double-booking.
-- ---------------------------------------------------------------------
create or replace function public.settle_extra_fee(
  p_fee_id uuid, p_receipt_document_id uuid default null
)
returns public.government_fees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fee public.government_fees;
  v_client_id uuid;
  v_total numeric(14, 2);
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can settle an extra fee.';
  end if;

  select * into v_fee from public.government_fees where id = p_fee_id;
  if v_fee.id is null then
    raise exception 'Extra fee % not found.', p_fee_id;
  end if;
  if v_fee.status = 'settled' then
    raise exception 'Extra fee % is already settled.', p_fee_id;
  end if;
  if v_fee.receipt_document_id is null and p_receipt_document_id is null then
    raise exception 'Upload a receipt for this fee before settling it.';
  end if;

  update public.government_fees
    set status = 'settled',
        settled_at = now(),
        settled_by = auth.uid(),
        receipt_document_id = coalesce(p_receipt_document_id, receipt_document_id)
    where id = p_fee_id
    returning * into v_fee;

  if v_fee.billed_invoice_id is null then
    select client_id into v_client_id from public.registration_jobs where id = v_fee.job_id;
    v_total := v_fee.amount_at_cost + v_fee.handling_fee;

    insert into public.manual_ledger_entries (client_id, entry_type, entry_date, description, amount, category, created_by)
    values (v_client_id, 'expense', current_date, v_fee.agency || ' — ' || v_fee.description, v_total, 'Extra fee ledger', auth.uid());
  end if;

  return v_fee;
end;
$$;

revoke all on function public.settle_extra_fee(uuid, uuid) from public;
grant execute on function public.settle_extra_fee(uuid, uuid) to authenticated;
