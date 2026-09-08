-- Products/Services + Inventory menu (build spec §1.2): per-client catalog
-- of products and services, each with a description, optional inventory
-- tracking, and links into the client's own chart of accounts so sales of
-- an item can eventually post against the right revenue/COGS accounts.
-- Standards (what a "product" vs "service" needs, tax treatment, etc.)
-- stay configurable in Accounting Standards going forward — this
-- migration only adds the catalog + inventory ledger itself.

create type public.product_kind as enum ('product', 'service');
create type public.inventory_movement_type as enum ('purchase', 'sale', 'adjustment', 'initial');

create table public.products_services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  sku text,
  name text not null,
  description text,
  kind public.product_kind not null default 'product',
  unit_price numeric(12, 2) not null default 0,
  cost_price numeric(12, 2),
  track_inventory boolean not null default false,
  quantity_on_hand numeric(12, 2) not null default 0,
  revenue_account_id uuid references public.chart_of_accounts (id),
  cogs_account_id uuid references public.chart_of_accounts (id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create unique index products_services_client_sku_key
  on public.products_services (client_id, sku)
  where sku is not null and sku <> '';

create trigger set_updated_at
  before update on public.products_services
  for each row execute function public.set_updated_at();

create index products_services_client_id_idx on public.products_services (client_id);

create trigger audit_products_services
  after insert or update or delete on public.products_services
  for each row execute function public.audit_row_change();

alter table public.products_services enable row level security;

create policy products_services_internal_all on public.products_services
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy products_services_select_own_client on public.products_services
  for select
  using (client_id = public.current_profile_client_id());

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products_services (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  movement_type public.inventory_movement_type not null,
  quantity numeric(12, 2) not null check (quantity <> 0),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index inventory_movements_product_id_idx on public.inventory_movements (product_id);
create index inventory_movements_client_id_idx on public.inventory_movements (client_id);

alter table public.inventory_movements enable row level security;

create policy inventory_movements_internal_all on public.inventory_movements
  for all
  using (public.is_owner_or_staff())
  with check (public.is_owner_or_staff());

create policy inventory_movements_select_own_client on public.inventory_movements
  for select
  using (client_id = public.current_profile_client_id());

-- ---------------------------------------------------------------------
-- record_inventory_movement: owner/staff only. Logs the movement and
-- adjusts quantity_on_hand in the same transaction, so the two never
-- drift out of sync.
-- ---------------------------------------------------------------------
create or replace function public.record_inventory_movement(
  p_product_id uuid, p_movement_type public.inventory_movement_type,
  p_quantity numeric, p_note text
)
returns public.products_services
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products_services;
begin
  if not public.is_owner_or_staff() then
    raise exception 'Only owner or staff can record inventory movements.';
  end if;
  if p_quantity is null or p_quantity = 0 then
    raise exception 'Quantity must be non-zero.';
  end if;

  select * into v_product from public.products_services where id = p_product_id;
  if v_product.id is null then
    raise exception 'Product/service % not found.', p_product_id;
  end if;
  if not v_product.track_inventory then
    raise exception '"%" does not track inventory.', v_product.name;
  end if;

  insert into public.inventory_movements (product_id, client_id, movement_type, quantity, note, created_by)
  values (p_product_id, v_product.client_id, p_movement_type, p_quantity, p_note, auth.uid());

  update public.products_services
    set quantity_on_hand = quantity_on_hand + p_quantity
    where id = p_product_id
    returning * into v_product;

  return v_product;
end;
$$;

revoke all on function public.record_inventory_movement(uuid, public.inventory_movement_type, numeric, text) from public;
grant execute on function public.record_inventory_movement(uuid, public.inventory_movement_type, numeric, text) to authenticated;
