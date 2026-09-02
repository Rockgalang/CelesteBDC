# Celeste.bdc

Philippine business-compliance platform for Celeste BDC. Next.js 15 (App
Router) + Supabase Postgres, RLS-enforced, mobile-first.

This repository currently implements **Phase 0 — Foundation** of the build
spec: project scaffold, database schema, auth/RBAC, row-level security,
audit logging, the document vault, the client registry, and the Ops
Cockpit shell. Phases 1–5 (registration pipeline, billing, bookkeeping,
tax engine, payroll, scale) are not yet built.

## Stack

Next.js 15 · TypeScript · Supabase (Postgres, Auth, Storage) · Tailwind CSS
+ shadcn/ui · react-hook-form + Zod · decimal.js for money · Resend
(configured, not yet wired to any send) · Vercel.

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
```

Apply the schema with the Supabase CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This runs every file in `supabase/migrations/` in order — extensions,
enums, tables, RLS policies, storage bucket, and the owner-bootstrap
functions. It also seeds the four subscription plans from build spec §5
and the overage/handling-fee config from §5.1.

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
by an existing owner (update their `profiles.role` — an admin UI for this
ships in a later phase).

## Database

- `supabase/migrations/*.sql` — applied in filename order. Each migration
  is scoped to one concern (extensions/helpers, clients, profiles, plans,
  billing config, documents, audit log, RLS, storage, owner bootstrap).
- Row-level security is enabled on every table holding client, financial,
  or employee data, keyed off `auth.uid() → profiles.role` /
  `profiles.client_id` (see `supabase/migrations/20260902100008_rls.sql`).
  This is the real authorization boundary — page-level role checks in the
  app are a UX convenience, not a substitute for it.
- Writes to client/employee-data tables are audit-logged automatically via
  a Postgres trigger (`audit_row_change()`); reads are logged from the
  application layer where that's added in a later phase. See
  `supabase/migrations/20260902100007_audit_log.sql` for why writes and
  reads are handled differently.
- Document retention (BIR's 10-year rule, build spec §2.3) is enforced by
  `enforce_document_retention()` — deleting a `documents` row before its
  `retention_until` date fails unless the caller is `owner` **and** sets
  `celeste.retention_override_reason` for the transaction, which the audit
  trigger then logs alongside the delete.
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

(This has been verified by hand against a throwaway Postgres 16 instance
with stand-in `auth`/`storage` schemas, since this environment has no
Docker daemon for `supabase start`. All 8 assertions pass. Re-run it for
real once the project is linked, as part of Phase 1's CI setup.)

## What's deliberately not here yet

- No payment gateway (manual proof-of-payment at launch, per build spec
  §2.4) — and no billing/invoicing at all yet; that's Phase 1.
- No registration pipeline, bookkeeping, tax engine, or payroll — Phases
  1–4.
- The Ops Cockpit shell renders its real section (permits expiring in 90
  days, from `documents.expires_at`) plus six honest empty states for
  sections whose backing tables don't exist yet — each labeled with the
  phase that will populate it.
- The client portal is a placeholder welcome card for `client_admin` /
  `client_user` roles; receipt upload, financials, invoices, and payslips
  are Phase 1+.
