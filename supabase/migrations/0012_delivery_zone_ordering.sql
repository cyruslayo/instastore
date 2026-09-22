-- Delivery zone ordering and per-city name uniqueness.
--
-- 0010 made zone names unique across an entire store. The intended rule is
-- uniqueness within store + city, so one merchant may reuse a zone name in
-- Abuja and Lagos. This migration also adds a merchant-controlled sort order so
-- public and merchant zone lists are deterministic.
--
-- Existing zone rows are never rewritten; sort_order defaults to 0.

alter table public.delivery_zones
  add column if not exists sort_order integer not null default 0;

alter table public.delivery_zones
  drop constraint if exists delivery_zones_sort_order_non_negative;
alter table public.delivery_zones
  add constraint delivery_zones_sort_order_non_negative check (sort_order >= 0);

-- Uniqueness is per store and city, not per store.
drop index if exists public.delivery_zones_store_name_key;
create unique index if not exists delivery_zones_store_city_name_key
  on public.delivery_zones (store_id, city, lower(btrim(name)));

-- Deterministic ordering index; supersedes the (store_id, city) index from 0010.
drop index if exists public.delivery_zones_store_city_idx;
create index if not exists delivery_zones_store_city_sort_idx
  on public.delivery_zones (store_id, city, sort_order);
