-- Store-scoped public storefronts and merchant delivery zones.
--
-- T02 turns the single default-storefront into one public storefront per active
-- store. This migration adds only the read-path scaffolding and the delivery
-- zone schema; the trusted checkout contract changes land in 0011.
--
--   * Anonymous visitors resolve a store by slug and read its active products
--     and active delivery zones. Suspended or unknown stores expose nothing.
--   * Product slugs become unique per store, not globally.
--   * Orders gain delivery snapshot columns so historical orders keep the
--     delivery information that applied at the time of purchase.
--
-- Principles kept throughout:
--   * SECURITY DEFINER helpers use a restricted search_path.
--   * Row level security stays the authoritative boundary; the application
--     filters are defense-in-depth only.

-- ---------------------------------------------------------------------------
-- Active-store helpers (usable from policies without exposing the stores table)
-- ---------------------------------------------------------------------------

create or replace function public.store_is_active(p_store_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.stores
    where id = p_store_id and status = 'active'
  );
$$;
revoke all on function public.store_is_active(uuid) from public;
grant execute on function public.store_is_active(uuid) to anon, authenticated;

create or replace function public.store_slug_is_active(p_slug text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.stores
    where slug = btrim(p_slug) and status = 'active'
  );
$$;
revoke all on function public.store_slug_is_active(text) from public;
grant execute on function public.store_slug_is_active(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- stores: public storefronts resolve active stores by slug
-- ---------------------------------------------------------------------------

create policy stores_public_active_select on public.stores
  for select to anon, authenticated
  using (status = 'active');

-- ---------------------------------------------------------------------------
-- products: anonymous reads become store-scoped (any active store) instead of
-- default-store-only. Merchants keep their own-store administrative policies.
-- ---------------------------------------------------------------------------

drop policy if exists products_public_active_select on public.products;

create policy products_public_active_select on public.products
  for select to anon, authenticated
  using (is_active and public.store_is_active(store_id));

-- Product slugs are unique within a store. Two merchants may use the same slug.
alter table public.products drop constraint if exists products_slug_key;
alter table public.products add constraint products_store_id_slug_key unique (store_id, slug);

-- ---------------------------------------------------------------------------
-- delivery_zones: merchant-defined delivery pricing for Abuja and Lagos
-- ---------------------------------------------------------------------------

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  city text not null,
  name text not null,
  provider text not null,
  fee numeric(12,2) not null,
  estimate text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_zones_city_valid check (city in ('Abuja', 'Lagos')),
  constraint delivery_zones_name_not_blank check (length(btrim(name)) > 0),
  constraint delivery_zones_provider_not_blank check (length(btrim(provider)) > 0),
  constraint delivery_zones_fee_non_negative check (fee >= 0)
);

create unique index delivery_zones_store_name_key
  on public.delivery_zones (store_id, lower(btrim(name)));

create index delivery_zones_store_city_idx
  on public.delivery_zones (store_id, city);

create trigger delivery_zones_touch_updated_at before update on public.delivery_zones
for each row execute function public.touch_updated_at();

alter table public.delivery_zones enable row level security;

-- Public storefronts read only active zones of active stores.
create policy delivery_zones_public_active_select on public.delivery_zones
  for select to anon, authenticated
  using (is_active and public.store_is_active(store_id));

-- Merchants manage only their own store's zones (active or not).
create policy delivery_zones_merchant_select on public.delivery_zones
  for select to authenticated
  using (store_id = public.current_store_id());

create policy delivery_zones_merchant_insert on public.delivery_zones
  for insert to authenticated
  with check (store_id = public.current_store_id());

create policy delivery_zones_merchant_update on public.delivery_zones
  for update to authenticated
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

create policy delivery_zones_merchant_delete on public.delivery_zones
  for delete to authenticated
  using (store_id = public.current_store_id());

-- ---------------------------------------------------------------------------
-- orders: delivery snapshots
--
-- Historical orders keep these columns null; existing rows are never rewritten.
-- shipping_fee remains the historical delivery amount for every order.
-- ---------------------------------------------------------------------------

alter table public.orders
  add column delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  add column delivery_city text,
  add column delivery_zone_name text,
  add column delivery_provider text,
  add column delivery_estimate text;

alter table public.orders add constraint orders_delivery_city_valid
  check (delivery_city is null or delivery_city in ('Abuja', 'Lagos'));
