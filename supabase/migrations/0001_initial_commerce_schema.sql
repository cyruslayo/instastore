-- InstaStore clean baseline for a new, empty Supabase project.
-- No tenant/store_id column is used: this database serves one storefront.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (length(btrim(slug)) > 0),
  description text,
  price numeric(12,2) not null check (price >= 0),
  inventory integer not null check (inventory >= 0),
  category text not null check (length(btrim(category)) > 0),
  image text,
  sku text,
  featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_settings (
  id boolean primary key default true check (id),
  store_name text,
  tagline text,
  logo_url text,
  instagram_handle text,
  whatsapp_number text,
  currency text not null default 'NGN',
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  bank_name text,
  account_name text,
  account_number text,
  announcement_enabled boolean not null default false,
  announcement_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  customer_name text not null check (length(btrim(customer_name)) > 0),
  customer_phone text not null check (length(btrim(customer_phone)) > 0),
  customer_instagram text,
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null check (shipping_fee >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'Pending Verification' check (status in ('Pending Verification', 'Processing', 'Shipped', 'Fulfilled', 'Cancelled')),
  shipping_address jsonb not null check (jsonb_typeof(shipping_address) = 'object'),
  receipt_path text not null unique check (receipt_path ~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'),
  inventory_restocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_slug_idx on public.products (slug);
create index products_active_idx on public.products (is_active);
create index products_category_idx on public.products (category);
create index products_featured_idx on public.products (featured);
create index orders_public_code_idx on public.orders (public_code);
create index orders_customer_phone_idx on public.orders (customer_phone);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger products_touch_updated_at before update on public.products for each row execute function public.touch_updated_at();
create trigger store_settings_touch_updated_at before update on public.store_settings for each row execute function public.touch_updated_at();
create trigger orders_touch_updated_at before update on public.orders for each row execute function public.touch_updated_at();

create or replace function public.prevent_ordered_product_delete()
returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1 from public.orders o
    where exists (
      select 1 from jsonb_array_elements(o.items) item
      where item->>'product_id' = old.id::text
    )
  ) then
    raise exception 'Products referenced by orders cannot be deleted. Deactivate the product instead.';
  end if;
  return old;
end;
$$;

create trigger products_prevent_ordered_delete
before delete on public.products
for each row execute function public.prevent_ordered_product_delete();

insert into public.store_settings (id, store_name, currency, delivery_fee)
values (true, 'Your Store', 'NGN', 0);
