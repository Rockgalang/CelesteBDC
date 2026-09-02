-- Client registry. entity_type + tax_type + vat_registered +
-- fiscal_year_end_month is the tuple that will deterministically generate
-- every tax deadline a client has (build spec §6.1) — Phase 3 reads it, but
-- the columns live here from the start so onboarding never has to migrate
-- data later.

create type public.entity_type as enum (
  'sole_proprietor',
  'opc',
  'corporation',
  'partnership',
  'branch_office',
  'rep_office'
);

create type public.tax_type as enum (
  'vat',
  'percentage',
  'exempt'
);

create type public.client_status as enum (
  'prospect',
  'onboarding',
  'active',
  'suspended',
  'cancelled'
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  trade_name text,
  entity_type public.entity_type not null,
  tin text,
  rdo_code text,
  tax_type public.tax_type not null,
  fiscal_year_end_month smallint not null default 12
    check (fiscal_year_end_month between 1 and 12),
  vat_registered boolean not null default false,
  dti_reg_no text,
  sec_reg_no text,
  mayors_permit_no text,
  address_line text,
  barangay text,
  city text,
  province text,
  postal_code text,
  status public.client_status not null default 'prospect',
  onboarded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

comment on column public.clients.fiscal_year_end_month is
  'Month (1-12) the fiscal year ends. Defaults to December (calendar year), the common case for Philippine sole proprietors and most corporations.';

create trigger set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_status_idx on public.clients (status);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create trigger set_updated_at
  before update on public.client_contacts
  for each row execute function public.set_updated_at();

create index client_contacts_client_id_idx on public.client_contacts (client_id);

-- Only one primary contact per client.
create unique index client_contacts_one_primary_per_client
  on public.client_contacts (client_id)
  where is_primary;
