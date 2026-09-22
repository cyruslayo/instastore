-- Multi-store foundation.
--
-- Adds a public.stores table and a store_id foreign key to the existing
-- single-store tables (profiles, products, orders, store_settings), then
-- backfills the one existing store so the application keeps working exactly
-- as a single storefront. Tenant-aware policies, routes, and RPC changes
-- belong to T01B and later; nothing here changes runtime application behavior.

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stores_name_not_blank check (length(btrim(name)) > 0),
  constraint stores_slug_not_blank check (length(btrim(slug)) > 0),
  constraint stores_slug_url_safe check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint stores_status_valid check (status in ('active', 'suspended'))
);

create trigger stores_touch_updated_at before update on public.stores
for each row execute function public.touch_updated_at();

-- RLS is enabled immediately. Public client policies are added in T01B; the
-- current application does not query public.stores, so this changes nothing.
alter table public.stores enable row level security;

alter table public.profiles add column store_id uuid references public.stores(id);
alter table public.products add column store_id uuid references public.stores(id);
alter table public.orders add column store_id uuid references public.stores(id);
alter table public.store_settings add column store_id uuid references public.stores(id);

-- Backfilling store_id is a data-only change. Temporarily suspend the
-- touch_updated_at triggers so existing rows keep their historical updated_at.
alter table public.profiles disable trigger profiles_touch_updated_at;
alter table public.products disable trigger products_touch_updated_at;
alter table public.orders disable trigger orders_touch_updated_at;
alter table public.store_settings disable trigger store_settings_touch_updated_at;

do $$
declare
  initial_store_id uuid;
  initial_store_name text;
begin
  select store_name into initial_store_name from public.store_settings where id = true;
  initial_store_name := nullif(btrim(coalesce(initial_store_name, '')), '');
  if initial_store_name is null then
    initial_store_name := 'Your Store';
  end if;

  insert into public.stores (slug, name)
  values ('default-store', initial_store_name)
  returning id into initial_store_id;

  update public.profiles set store_id = initial_store_id;
  update public.products set store_id = initial_store_id;
  update public.orders set store_id = initial_store_id;
  update public.store_settings set store_id = initial_store_id;
end;
$$;

alter table public.profiles enable trigger profiles_touch_updated_at;
alter table public.products enable trigger products_touch_updated_at;
alter table public.orders enable trigger orders_touch_updated_at;
alter table public.store_settings enable trigger store_settings_touch_updated_at;

alter table public.profiles alter column store_id set not null;
alter table public.products alter column store_id set not null;
alter table public.orders alter column store_id set not null;
alter table public.store_settings alter column store_id set not null;

-- The singleton settings row belongs to exactly one store.
alter table public.store_settings add constraint store_settings_store_id_unique unique (store_id);

create index profiles_store_id_idx on public.profiles (store_id);
create index products_store_id_idx on public.products (store_id);
create index orders_store_id_created_at_idx on public.orders (store_id, created_at desc);
create index orders_store_id_status_idx on public.orders (store_id, status);
