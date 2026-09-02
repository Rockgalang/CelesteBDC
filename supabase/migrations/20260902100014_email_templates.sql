-- Email templates + delivery status tracking (build spec §7.11: "Every
-- template is previewable and editable by Cel without a deploy" and "all
-- notifications log to notifications with delivery status").
--
-- Only the templates this build actually fires are seeded here:
-- invoice_issued, payment_confirmed, payment_overdue_warning_day7/day12,
-- payment_overdue_suspended. The rest of §7.11's list (document request,
-- document reminder, filing confirmation, financial statements ready,
-- permit expiring, plan limit warnings) depends on data this build
-- doesn't have yet (document-request tracking, the tax engine, FS
-- generation, transaction counting, the renewal engine — the last of
-- which the spec's own §8 build order places in Phase 5). Add their rows
-- here when the phase that produces their trigger data ships.

create table public.email_templates (
  key text primary key,
  subject text not null,
  -- Simple {{placeholder}} substitution, not a templating engine — kept
  -- deliberately simple so Cel can edit it from an admin screen without
  -- needing to understand a template language.
  body_text text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.email_templates
  for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;

create policy email_templates_select_internal on public.email_templates
  for select using (public.is_owner_or_staff());
create policy email_templates_write_owner_only on public.email_templates
  for insert with check (public.is_owner());
create policy email_templates_update_owner_only on public.email_templates
  for update using (public.is_owner()) with check (public.is_owner());

alter table public.notifications
  add column delivery_status text not null default 'pending',
  add column error text;

alter table public.notifications
  add constraint notifications_delivery_status_check
  check (delivery_status in ('pending', 'sent', 'failed'));

insert into public.email_templates (key, subject, body_text, description) values
  ('invoice_issued', 'Your Celeste BDC invoice {{invoice_number}} is ready',
    'Hi {{business_name}},\n\nInvoice {{invoice_number}} for {{amount}} is now available. It is due on {{due_date}}.\n\nUpload your proof of payment any time from your Celeste.bdc portal.\n\n— Celeste BDC',
    'Sent when a subscription invoice is generated.'),
  ('payment_confirmed', 'Payment received for invoice {{invoice_number}}',
    'Hi {{business_name}},\n\nWe''ve confirmed your payment for invoice {{invoice_number}}. Thank you!\n\n— Celeste BDC',
    'Sent when Cel confirms a submitted payment.'),
  ('payment_overdue_warning_day7', 'Invoice {{invoice_number}} is 7 days overdue',
    'Hi {{business_name}},\n\nInvoice {{invoice_number}} is now 7 days past its due date. Please submit proof of payment soon to avoid a service interruption.\n\n— Celeste BDC',
    'First overdue warning, sent 7 days past due_date.'),
  ('payment_overdue_warning_day12', 'Invoice {{invoice_number}} is 12 days overdue',
    'Hi {{business_name}},\n\nInvoice {{invoice_number}} is now 12 days past its due date. Your account will move into grace status soon.\n\n— Celeste BDC',
    'Second overdue warning, sent 12 days past due_date.'),
  ('payment_overdue_suspended', 'Your Celeste BDC account has been suspended',
    'Hi {{business_name}},\n\nInvoice {{invoice_number}} remains unpaid, and your subscription has been suspended. You can still view and download your existing documents; portal write access is restricted until payment is confirmed.\n\n— Celeste BDC',
    'Sent when a subscription is suspended for non-payment.');
