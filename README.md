# Celeste.bdc

Philippine business-compliance platform for Celeste BDC. Next.js 15 (App
Router) + Supabase Postgres, RLS-enforced, mobile-first.

This repository currently implements **Phase 0 — Foundation**,
**Phase 1 — Money and pipeline**, and **Phase 2 — Bookkeeping** of the
build spec: project scaffold, database schema, auth/RBAC, row-level
security, audit logging, the document vault, the client registry, the
Ops Cockpit shell, the onboarding wizard, the registration pipeline
(Kanban, checklists, government fee ledger), billing (subscriptions,
invoice generation, manual payment confirmation), a first client portal,
core email notifications, a double-entry journal engine with period
close/reopen, per-client chart of accounts, receipt capture with Claude
vision OCR extraction and a review queue that posts journal entries, bank
statement import/reconciliation, and compiled (unaudited) trial
balance/income statement/balance sheet views. Phases 3–5 (tax engine,
payroll, scale) are not yet built.

## Stack

Next.js 15 · TypeScript · Supabase (Postgres, Auth, Storage) · Tailwind CSS
+ shadcn/ui · react-hook-form + Zod · decimal.js for money · Resend ·
Vercel (including Vercel Cron).

## Getting started

### 1. Supabase project

Create a Supabase project, then set these in `.env.local` (copy
`.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@celestebdc.com
CRON_SECRET=
```

Apply the schema with the Supabase CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This runs every file in `supabase/migrations/` in order — extensions,
enums, tables, RLS policies, storage bucket, owner-bootstrap functions,
the registration pipeline, billing, engagement letters/notifications/
tasks, and email templates. It also seeds the four subscription plans
from build spec §5, the overage/handling-fee config from §5.1, the
registration checklist/stage templates (§10 in the spec — see the
migration header comment on why these need Cel's review), and the email
templates from §7.11.

### 2. Run the app

```bash
npm install
npm run dev
```

### 3. Claim the owner role

There is no seeded owner account. Sign up through `/signup` like any
user, then visit `/setup` and click **Claim owner role**. This only works
once — the underlying `bootstrap_first_owner()` Postgres function refuses
if an owner already exists. Every account created after that is promoted
by an existing owner (update their `profiles.role` — a dedicated admin
screen for this hasn't been built yet).

### 4. Cron jobs

`vercel.json` schedules three routes once deployed to Vercel:
`generate-invoices` (1st of the month), `sweep-subscriptions` (daily —
overdue warnings, grace, suspension), and `send-notifications` (daily —
actually sends queued emails via Resend). Each checks `Authorization:
Bearer $CRON_SECRET` when that env var is set; Vercel sets the header
automatically for its own cron invocations.

Hobby-plan Vercel accounts only allow daily cron jobs, so
`send-notifications` runs once a day rather than every 15 minutes — a
queued notification can sit for up to 24h before it goes out. Tighten
this schedule once the project is on a paid plan (Pro allows any
interval).

## Database

- `supabase/migrations/*.sql` — applied in filename order. Each migration
  is scoped to one concern.
- Row-level security is enabled on every table holding client, financial,
  or employee data, keyed off `auth.uid() → profiles.role` /
  `profiles.client_id` (see `supabase/migrations/20260902100008_rls.sql`
  and `20260902100012_billing.sql`). This is the real authorization
  boundary — page-level role checks in the app are a UX convenience, not
  a substitute for it.
- Writes to client/employee-data tables are audit-logged automatically via
  a Postgres trigger (`audit_row_change()`); reads are logged from the
  application layer where that's added in a later phase.
- Document retention (BIR's 10-year rule, build spec §2.3) is enforced by
  `enforce_document_retention()` — deleting a `documents` row before its
  `retention_until` date fails unless the caller is `owner` **and** sets
  `celeste.retention_override_reason` for the transaction, which the audit
  trigger then logs alongside the delete.
- Invoice numbers (`CEL-2026-0001`) are sequential and gapless per year,
  assigned only at issuance (never at draft creation) by
  `generate_invoice_number()` — a single atomic `UPDATE` on a counter
  table, per build spec §6.2.
- `src/lib/supabase/types.ts` is hand-maintained to mirror the SQL schema.
  Once the project is linked, prefer regenerating it:
  `npx supabase gen types typescript --linked > src/lib/supabase/types.ts`.
  **Note:** table row/insert/update shapes must be plain `type` aliases,
  not `interface` — an `interface` here breaks postgrest-js's generic
  resolution and silently types every query result as `never` with no
  error at the `createClient()` call site (only at every downstream usage).

### RLS tests

`supabase/tests/database/rls_cross_tenant.test.sql` is a pgTAP test
proving a `client_admin` from one client cannot read, update, or
self-promote using another client's data, even via a direct id lookup.
Run it against a local Supabase stack:

```bash
npx supabase start
npx supabase test db
```

(This has been verified by hand — twice, once after Phase 0 and again
after Phase 1's migrations were added — against a throwaway Postgres 16
instance with stand-in `auth`/`storage` schemas, since this environment
has no Docker daemon for `supabase start`. All 8 assertions pass both
times. The billing/registration RPCs — `create_registration_job`,
`advance_registration_job_stage`, `confirm_payment`, `reject_payment`,
`generate_invoice_number` — were also smoke-tested by hand the same way.
Re-run the pgTAP suite for real once the project is linked, as part of a
CI setup.)

## What's deliberately not here yet

- **No tax engine or payroll** — Phases 3–4. Concretely: employee
  overage invoice lines are never generated (there's no payroll data yet
  to count them from — see the comment atop
  `src/app/api/cron/generate-invoices/route.ts`); the Ops Cockpit's
  "filings due" and "payroll runs due" sections stay at their honest
  empty state; no BIR forms, tax computations, or payslips exist yet.
  Transaction-overage invoice lines are still not generated either —
  `count_receipts_for_period()` exists but nothing wires it into billing
  yet.
- **Bookkeeping (Phase 2) is built but manually operated**: receipt OCR
  needs `ANTHROPIC_API_KEY` set or every upload falls back to
  `needs_review` with manual data entry; bank reconciliation is
  CSV-import-only (no live bank feed); financial statements are compiled
  management accounts (trial balance, income statement, balance sheet)
  computed live from posted journal entries — not audited, and revenue/
  expense accounts are never closed to retained earnings at period end
  (the balance sheet shows a running "net income to date, not yet closed"
  line instead).
- **No payment gateway** — proof-of-payment upload + manual confirmation
  only, per build spec §2.4, behind a schema that isolates billing logic
  from any specific payment method.
- **The renewal engine is not automated** — build spec §8 itself places
  this in Phase 5. `documents.expires_at` is tracked and the Ops Cockpit
  surfaces what's expiring in 90 days, but nothing auto-creates a renewal
  `registration_job` yet.
- **Document-request tracking, filing confirmations, "FS ready," and plan
  limit warnings** are not built — each needs a data source this build
  doesn't have (a document-request table, the tax engine, FS generation,
  transaction counting). Their `email_templates` rows aren't seeded
  either; add them when the phase that triggers them ships.
- **No message thread** between Cel and clients (build spec §7.10) yet.
- The client portal home shows registration status, document count, and
  unpaid invoices — not yet the receipt-count-against-plan-limit or
  next-tax-deadline widgets, which need Phase 2/3 data.
