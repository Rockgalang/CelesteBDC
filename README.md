# Celeste.bdc

Philippine business-compliance platform for Celeste BDC. Next.js 15 (App
Router) + Supabase Postgres, RLS-enforced, mobile-first.

This repository implements all six phases of the build spec end to end —
schema, RLS, business logic, and UI for every phase, including payroll.
What's real:

- **Phase 0 — Foundation**: project scaffold, database schema, auth/RBAC,
  row-level security, audit logging, the document vault, the client
  registry, the Ops Cockpit shell.
- **Phase 1 — Money and pipeline**: the onboarding wizard, the
  registration pipeline (Kanban, checklists, government fee ledger),
  billing (subscriptions, invoice generation, manual payment
  confirmation), a first client portal, core email notifications.
- **Phase 2 — Bookkeeping**: a double-entry journal engine with period
  close/reopen, per-client chart of accounts, receipt capture with Claude
  vision OCR extraction and a review queue that posts journal entries,
  bank statement import/reconciliation, and compiled (unaudited) trial
  balance/income statement/balance sheet views.
- **Phase 3 — Tax**: a BIR filing deadline calendar (per client, derived
  from entity type/tax type/VAT registration) with filed/overdue tracking
  for internal staff and a read-only view for clients. No filing API —
  build spec §2.4 rules that out entirely; this only tracks what's due.
- **Phase 4 — Payroll**: an employee roster, monthly payroll runs seeded
  from each active employee's rate, per-payslip government-contribution
  estimates (SSS/PhilHealth/Pag-IBIG/withholding tax — editable before
  processing), and processing a run posts one balanced journal entry
  (wages + employer contributions debited; withholding tax payable,
  contributions payable, and cash credited). Processed runs and their
  payslips are immutable, same as posted journal entries.
- **Phase 5 — Scale**: a plan-usage indicator on the client receipt page
  (transactions used vs. plan limit), transaction/employee-overage
  invoice lines generated automatically from real receipt and employee
  counts, a real Ops Cockpit wired to actual data across every shipped
  module (including payroll-runs-due), and a daily renewal-reminder sweep
  that creates an internal task when a tracked document nears expiry.
- **Landing page**: a public marketing page at `/` with live pricing
  pulled from the `plans` table; the authenticated app now lives at
  `/dashboard`.

The Ops Cockpit, every internal nav item, and the client portal reflect
all of the above — nothing here is a Phase-N stub pretending to be
finished. Where a section is genuinely unbuilt (document requests), it
says so instead of faking data.

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
overdue warnings, grace, suspension, **and** the renewal-reminder sweep),
and `send-notifications` (daily — actually sends queued emails via
Resend). Each checks `Authorization: Bearer $CRON_SECRET` when that env
var is set; Vercel sets the header automatically for its own cron
invocations.

A fourth route, `renewal-reminders`, exists at
`/api/cron/renewal-reminders` for manual/on-demand use but isn't in
`vercel.json` — its logic runs inside `sweep-subscriptions` instead
(see `src/lib/renewals/reminders.ts`) to stay within the Hobby-plan cron
count rather than claim a fourth schedule slot.

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

(This has been verified by hand after every phase's migrations were
added — Phase 0 through the Phase 4 payroll migration — against a
throwaway Postgres 16 instance with stand-in `auth`/`storage` schemas,
since this environment has no Docker daemon for `supabase start`. All 8
assertions pass every time. Every RPC that changes money or posts a
journal entry — `create_registration_job`, `confirm_payment`,
`approve_receipt`, `close_accounting_period`, `match_bank_transaction`,
`process_payroll_run`, and more — has an accompanying hand-run smoke test
covering its balancing/immutability/RLS invariants (see the `*_smoke.sql`
scripts referenced in each phase's commit). Re-run the pgTAP suite for
real once the project is linked, as part of a CI setup.)

## What's deliberately not here yet

- **Payroll (Phase 4) computes contributions with approximate formulas,
  not the official bracket tables.** `src/lib/payroll/computations.ts`
  estimates SSS, PhilHealth, and Pag-IBIG as flat percentages of a capped
  base, not the real Monthly Salary Credit / contribution bracket tables
  (which step in narrower bands than a flat rate) — close for most
  salaries, not exact at bracket boundaries. Every figure is editable per
  payslip before a run is processed, so the estimate is a starting point,
  not the final word. The BIR monthly withholding tax table it uses *is*
  the official TRAIN-law table and is not a simplification. There's also
  no employee self-service login — payslips are managed by owner/staff
  only, per build spec's framing of payroll as a service Cel's team runs.
- **Tax (Phase 3) is a deadline calendar, not a filing system.**
  `src/lib/tax/deadlines.ts` computes a generic BIR calendar from a
  client's entity type/tax type/VAT registration — it is explicitly
  labeled a planning aid, not tax advice, and is not a substitute for a
  CPA's review of the actual due dates for a given RDO/ruling. Marking an
  obligation "filed" just closes an internal task; nothing here prepares,
  computes, or submits a return (no BIR API exists to submit to — build
  spec §2.4).
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
- **The renewal engine only reminds, it doesn't act.** The daily sweep
  (`src/lib/renewals/reminders.ts`) creates an internal task when a
  tracked document is within 30 days of `expires_at` — it does not
  auto-create a renewal `registration_job`, because `documents.category`
  is generic free text with no reliable mapping to a specific BIR/DTI/SEC
  job type. Guessing that mapping wrong seemed worse than a human
  starting the renewal themselves from the reminder.
- **Document-request tracking, filing confirmations, and "FS ready"
  notifications** are not built — each needs a data source this build
  doesn't have (a document-request table, filing-status webhooks, an
  FS-generation trigger). Their `email_templates` rows aren't seeded
  either; add them when the feature that triggers them ships.
- **No message thread** between Cel and clients (build spec §7.10) yet.
- The client portal home shows registration status, document count, and
  unpaid invoices; the receipt page separately shows plan-usage and the
  tax page shows the filing calendar — these haven't been consolidated
  onto one dashboard widget.
