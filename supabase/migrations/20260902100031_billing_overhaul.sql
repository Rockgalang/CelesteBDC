-- Subscription & Billing overhaul (build spec §1/§3): proof-of-payment
-- review before an ad-hoc/extra-charge invoice is issued (not before
-- the auto-generated monthly subscription invoice, which the cron still
-- inserts directly as 'issued' — unaffected by anything here), invoice
-- letterhead, and tips (never invoiced, always reported as a customer
-- expense + additional Cel earnings). Confirming a payment or a tip now
-- also books the matching expense straight into the client's own books.

create type public.tip_status as enum ('submitted', 'confirmed', 'rejected');

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  proof_document_id uuid references public.documents (id) on delete set null,
  status public.tip_status not null default 'submitted',
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.tips
  for each row execute function public.set_updated_at();

create index tips_client_id_idx on public.tips (client_id);

create trigger audit_tips
  after insert or update or delete on public.tips
  for each row execute function public.audit_row_change();

alter table public.tips enable row level security;

create policy tips_internal_all on public.tips
  for all using (public.is_owner_or_staff()) with check (public.is_owner_or_staff());

create policy tips_select_own_client_admin on public.tips
  for select using (
    client_id = public.current_profile_client_id()
    and public.current_profile_role() = 'client_admin'
  );

-- A client submits their own tip; only confirm_tip()/reject_tip() may
-- move it from there — same shape as payments_insert_own_client_admin.
create policy tips_insert_own_client_admin on public.tips
  for insert
  with check (
    status = 'submitted'
    and client_id = public.current_profile_client_id()
    and public.current_profile_role() = 'client_admin'
  );

-- ---------------------------------------------------------------------
-- confirm_tip: owner/staff only. Books the tip as an expense in the
-- client's own books — a tip is never invoiced, but it did leave the
-- client's pocket, and it counts as extra earnings for Cel.
-- ---------------------------------------------------------------------
create or replace function public.confirm_tip(p_tip_id uuid)
returns public.tips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tip public.tips;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can confirm a tip.';
  end if;

  update public.tips
    set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
    where id = p_tip_id and status = 'submitted'
    returning * into v_tip;

  if v_tip.id is null then
    raise exception 'Tip % not found or not awaiting confirmation.', p_tip_id;
  end if;

  insert into public.manual_ledger_entries (client_id, entry_type, entry_date, description, amount, category, created_by)
  values (v_tip.client_id, 'expense', current_date, 'Tip to Celeste BDC', v_tip.amount, 'Tips', auth.uid());

  return v_tip;
end;
$$;

revoke all on function public.confirm_tip(uuid) from public;
grant execute on function public.confirm_tip(uuid) to authenticated;

create or replace function public.reject_tip(p_tip_id uuid)
returns public.tips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tip public.tips;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can reject a tip.';
  end if;

  update public.tips
    set status = 'rejected', confirmed_by = auth.uid(), confirmed_at = now()
    where id = p_tip_id and status = 'submitted'
    returning * into v_tip;

  if v_tip.id is null then
    raise exception 'Tip % not found or not awaiting confirmation.', p_tip_id;
  end if;

  return v_tip;
end;
$$;

revoke all on function public.reject_tip(uuid) from public;
grant execute on function public.reject_tip(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- issue_invoice_after_proof_review: owner/staff only. The gate the build
-- spec asks for on ad-hoc/extra-charge invoices — a staff-created draft
-- can only become 'issued' (and get its official number, via the
-- existing assign_invoice_number trigger) once at least one payment
-- row against it carries a proof document. The monthly subscription
-- cron never goes through here — it inserts invoices directly as
-- 'issued', so it is completely unaffected.
-- ---------------------------------------------------------------------
create or replace function public.issue_invoice_after_proof_review(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_has_proof boolean;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can issue an invoice.';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Invoice % not found.', p_invoice_id;
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Invoice % is not a draft.', p_invoice_id;
  end if;

  select exists (
    select 1 from public.payments
    where invoice_id = p_invoice_id and proof_document_id is not null
  ) into v_has_proof;
  if not v_has_proof then
    raise exception 'Attach the client''s proof of payment before issuing this invoice.';
  end if;

  update public.invoices set status = 'issued' where id = p_invoice_id
    returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke all on function public.issue_invoice_after_proof_review(uuid) from public;
grant execute on function public.issue_invoice_after_proof_review(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- confirm_payment: extended to also book the payment as an expense in
-- the client's own books (build spec: "released invoices ... auto-
-- reflect as expenses in customers' books, down to tiny details").
-- Guarded by the payment's *previous* status so re-confirming an
-- already-confirmed payment (should never happen, but just in case)
-- never double-books the expense.
-- ---------------------------------------------------------------------
create or replace function public.confirm_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_invoice public.invoices;
  v_confirmed_total numeric(14, 2);
  v_was_confirmed boolean;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can confirm a payment.';
  end if;

  select (status = 'confirmed') into v_was_confirmed
  from public.payments where id = p_payment_id;

  update public.payments
    set status = 'confirmed', confirmed_by = auth.uid(), paid_at = coalesce(paid_at, now())
    where id = p_payment_id
    returning * into v_payment;

  if v_payment.id is null then
    raise exception 'Payment % not found.', p_payment_id;
  end if;

  select * into v_invoice from public.invoices where id = v_payment.invoice_id;

  select coalesce(sum(amount), 0) into v_confirmed_total
  from public.payments
  where invoice_id = v_invoice.id and status = 'confirmed';

  update public.invoices
    set status = case
      when v_confirmed_total >= v_invoice.total then 'paid'
      when v_confirmed_total > 0 then 'partially_paid'
      else status
    end
    where id = v_invoice.id;

  if not coalesce(v_was_confirmed, false) then
    insert into public.manual_ledger_entries (client_id, entry_type, entry_date, description, amount, category, created_by)
    values (
      v_invoice.client_id, 'expense', current_date,
      'Celeste BDC — invoice ' || coalesce(v_invoice.number, v_invoice.id::text),
      v_payment.amount, 'Professional fees', auth.uid()
    );
  end if;

  return v_payment;
end;
$$;

revoke all on function public.confirm_payment(uuid) from public;
grant execute on function public.confirm_payment(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Invoice letterhead — singleton, same pattern as payroll_standards.
-- ---------------------------------------------------------------------
create table public.invoice_letterhead (
  id smallint primary key default 1 check (id = 1),
  business_name text not null default 'Celeste BDC',
  logo_data_url text,
  address text,
  footer_note text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

insert into public.invoice_letterhead (id) values (1);

create trigger set_updated_at
  before update on public.invoice_letterhead
  for each row execute function public.set_updated_at();

alter table public.invoice_letterhead enable row level security;

create policy invoice_letterhead_select_internal on public.invoice_letterhead
  for select using (public.is_owner_or_staff());
create policy invoice_letterhead_update_owner_only on public.invoice_letterhead
  for update using (public.is_owner()) with check (public.is_owner());

-- Letterhead shows on the client-facing invoice page too.
create policy invoice_letterhead_select_own_client_admin on public.invoice_letterhead
  for select using (public.current_profile_role() = 'client_admin');
