-- Email template for the sales/expense report upload reminder (see
-- src/lib/reports/reminders.ts), following the same seed pattern as
-- 20260902100014_email_templates.sql.

insert into public.email_templates (key, subject, body_text, description) values
  ('report_reminder', 'Time to upload your {{frequency}} sales/expense report',
    'Hi {{business_name}},\n\nJust a reminder to upload your sales and expense receipts for the {{frequency}} report — it only takes a minute from your Celeste.bdc portal, and it keeps your books current.\n\n— Celeste BDC',
    'Sent when a client hasn''t uploaded a receipt or ledger entry within their declared report frequency.');
