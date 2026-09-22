-- Tenant security boundary and tenant-aware commerce RPCs.
--
-- T01A added the store_id columns and backfilled the single default-store.
-- This migration turns that data foundation into an actual security boundary:
-- every merchant belongs to one store, and every private table and RPC is
-- scoped to the caller's store via public.current_store_id().
--
-- Principles kept throughout:
--   * SECURITY DEFINER functions use a restricted search_path.
--   * Policies never trust client-supplied store_id; the session is the only
--     source of store identity.
--   * No generalized authorization framework and no super-admin.

-- ---------------------------------------------------------------------------
-- Store identity helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_store_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.id
  from public.profiles p
  join public.stores s on s.id = p.store_id
  where p.id = auth.uid()
    and p.role = 'admin'
    and s.status = 'active';
$$;
revoke all on function public.current_store_id() from public;
grant execute on function public.current_store_id() to authenticated;

create or replace function public.current_store_slug()
returns text
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.slug
  from public.profiles p
  join public.stores s on s.id = p.store_id
  where p.id = auth.uid()
    and p.role = 'admin'
    and s.status = 'active';
$$;
revoke all on function public.current_store_slug() from public;
grant execute on function public.current_store_slug() to authenticated;

create or replace function public.default_store_id()
returns uuid
language sql stable security definer set search_path = public, pg_temp
as $$
  select id from public.stores where slug = 'default-store';
$$;
revoke all on function public.default_store_id() from public;
grant execute on function public.default_store_id() to anon, authenticated;

-- is_admin stays for compatibility but now requires an active store. There is
-- no global super-admin: an admin with a missing or suspended store is not an
-- admin for the purposes of any policy or RPC.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select public.current_store_id() is not null;
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- stores: authenticated merchants may read only their own store
-- ---------------------------------------------------------------------------

create policy stores_select_own on public.stores
  for select to authenticated
  using (id = public.current_store_id());

-- No INSERT/UPDATE/DELETE policy: store provisioning remains manual and no
-- merchant may create a store, change ownership, or read another store.

-- ---------------------------------------------------------------------------
-- profiles: a merchant may read only their own profile, and may not change
-- their own store_id
-- ---------------------------------------------------------------------------

drop policy if exists profiles_admin_select on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- ---------------------------------------------------------------------------
-- products: anonymous reads stay public (default-store only until T02), while
-- merchant administration is scoped to the caller's store
-- ---------------------------------------------------------------------------

drop policy if exists products_public_active_select on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;

create policy products_public_active_select on public.products
  for select to anon
  using (is_active and store_id = public.default_store_id());

create policy products_admin_select on public.products
  for select to authenticated
  using (store_id = public.current_store_id());

create policy products_admin_insert on public.products
  for insert to authenticated
  with check (store_id = public.current_store_id());

create policy products_admin_update on public.products
  for update to authenticated
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

create policy products_admin_delete on public.products
  for delete to authenticated
  using (store_id = public.current_store_id());

-- ---------------------------------------------------------------------------
-- store_settings: convert from boolean singleton to one row per store keyed by
-- store_id
-- ---------------------------------------------------------------------------

drop policy if exists store_settings_admin_select on public.store_settings;
drop policy if exists store_settings_admin_update on public.store_settings;

-- store_id is already NOT NULL and unique from T01A, so it can become the key.
alter table public.store_settings drop constraint if exists store_settings_store_id_unique;
alter table public.store_settings drop constraint if exists store_settings_pkey;
alter table public.store_settings drop column id;
alter table public.store_settings add primary key (store_id);

create policy store_settings_admin_select on public.store_settings
  for select to authenticated
  using (store_id = public.current_store_id());

create policy store_settings_admin_update on public.store_settings
  for update to authenticated
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- ---------------------------------------------------------------------------
-- storefront settings RPC: keep the zero-arg call working
-- ---------------------------------------------------------------------------

create or replace function public.get_storefront_settings()
returns table (
  store_name text, tagline text, logo_url text, instagram_handle text,
  whatsapp_number text, currency text, delivery_fee numeric,
  bank_name text, account_name text, account_number text,
  announcement_enabled boolean, announcement_text text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.store_name, s.tagline, s.logo_url, s.instagram_handle,
    s.whatsapp_number, s.currency, s.delivery_fee, s.bank_name,
    s.account_name, s.account_number, s.announcement_enabled, s.announcement_text
  from public.store_settings s
  where s.store_id = coalesce(public.current_store_id(), public.default_store_id());
$$;
revoke all on function public.get_storefront_settings() from public;
grant execute on function public.get_storefront_settings() to anon, authenticated;

-- Slug-resolved variant for T02 public routing. Not used by the frontend yet.
create or replace function public.get_storefront_settings_by_slug(p_slug text)
returns table (
  store_name text, tagline text, logo_url text, instagram_handle text,
  whatsapp_number text, currency text, delivery_fee numeric,
  bank_name text, account_name text, account_number text,
  announcement_enabled boolean, announcement_text text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.store_name, s.tagline, s.logo_url, s.instagram_handle,
    s.whatsapp_number, s.currency, s.delivery_fee, s.bank_name,
    s.account_name, s.account_number, s.announcement_enabled, s.announcement_text
  from public.store_settings s
  join public.stores st on st.id = s.store_id
  where st.slug = btrim(p_slug)
    and st.status = 'active';
$$;
revoke all on function public.get_storefront_settings_by_slug(text) from public;
grant execute on function public.get_storefront_settings_by_slug(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- orders.receipt_path: accept legacy and new store-scoped formats only
-- ---------------------------------------------------------------------------

alter table public.orders drop constraint if exists orders_receipt_path_check;
alter table public.orders add constraint orders_receipt_path_check check (
  receipt_path ~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
  or receipt_path ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
);

-- ---------------------------------------------------------------------------
-- create_store_order: tenant-aware
-- ---------------------------------------------------------------------------

drop function if exists public.create_store_order(text, text, text, jsonb, numeric, jsonb, text);

create or replace function public.create_store_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_instagram text,
  p_items jsonb,
  p_total numeric,
  p_shipping_address jsonb,
  p_receipt_path text,
  p_store_slug text default 'default-store'
)
returns text
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9+]', '', 'g');
  v_store_slug text := coalesce(nullif(btrim(p_store_slug), ''), 'default-store');
  v_store_id uuid;
  item jsonb;
  product_row public.products%rowtype;
  product_id uuid;
  quantity integer;
  trusted_items jsonb := '[]'::jsonb;
  calculated_subtotal numeric(12,2) := 0;
  delivery numeric(12,2);
  calculated_total numeric(12,2);
  generated_code text;
  inserted_id uuid;
  existing_code text;
  existing_phone text;
  item_count integer;
begin
  select id into v_store_id
  from public.stores
  where slug = v_store_slug
    and status = 'active';
  if v_store_id is null then raise exception 'Store is unavailable'; end if;

  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then raise exception 'Customer name is required'; end if;
  if length(normalized_phone) < 7 then raise exception 'A valid phone number is required'; end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' or p_shipping_address = '{}'::jsonb then raise exception 'Shipping address is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if p_receipt_path is null
     or not (p_receipt_path ~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
          or p_receipt_path ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$') then raise exception 'Invalid receipt path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'receipts' and name = p_receipt_path) then raise exception 'Receipt object does not exist'; end if;
  if p_total is null or p_total < 0 then raise exception 'Invalid submitted total'; end if;

  -- The receipt namespace must match the requested store. A receipt uploaded
  -- for Store A can never create an order for Store B.
  if p_receipt_path ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/' then
    if split_part(p_receipt_path, '/', 2) <> v_store_slug then
      raise exception 'Receipt does not belong to this store';
    end if;
  else
    -- Legacy path (no slug) belongs to the original default store only.
    if v_store_slug <> 'default-store' then
      raise exception 'Legacy receipt cannot be used for this store';
    end if;
  end if;

  -- Serialize submissions for the same receipt before touching inventory.
  perform pg_advisory_xact_lock(hashtextextended(p_receipt_path, 0));
  select public_code, customer_phone into existing_code, existing_phone
  from public.orders where receipt_path = p_receipt_path;
  if existing_code is not null then
    if existing_phone = normalized_phone then return existing_code; end if;
    raise exception 'This receipt has already been submitted';
  end if;

  select count(*), count(distinct (coalesce(value->>'product_id', value->>'id')))
    into item_count, quantity
  from jsonb_array_elements(p_items);
  if item_count <> quantity then raise exception 'Duplicate products are not allowed'; end if;

  -- Product IDs are processed in a stable order. FOR UPDATE locks each row before
  -- its conditional decrement, so concurrent orders cannot reserve the same stock.
  for item in select value from jsonb_array_elements(p_items) order by coalesce(value->>'product_id', value->>'id') loop
    if coalesce(item->>'product_id', item->>'id') is null
      or not (coalesce(item->>'product_id', item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'Invalid product ID'; end if;
    product_id := (coalesce(item->>'product_id', item->>'id'))::uuid;
    if jsonb_typeof(item->'quantity') is distinct from 'number'
      or (item->>'quantity') is null
      or (item->>'quantity') !~ '^[1-9][0-9]*$' then raise exception 'Quantity must be a positive integer'; end if;
    quantity := (item->>'quantity')::integer;
    select * into product_row from public.products where id = product_id and is_active and store_id = v_store_id for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if product_row.inventory < quantity then raise exception 'Insufficient inventory'; end if;
    update public.products set inventory = inventory - quantity where id = product_id;
    calculated_subtotal := calculated_subtotal + product_row.price * quantity;
    trusted_items := trusted_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id, 'name', product_row.name, 'sku', product_row.sku,
      'category', product_row.category, 'price', product_row.price, 'quantity', quantity,
      'image', product_row.image));
  end loop;

  select delivery_fee into delivery from public.store_settings where store_id = v_store_id;
  delivery := coalesce(delivery, 0);
  calculated_total := calculated_subtotal + delivery;
  if p_total <> calculated_total then raise exception 'Submitted total does not match current prices'; end if;

  loop
    generated_code := 'ORD-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    insert into public.orders (store_id, public_code, customer_name, customer_phone, customer_instagram, items, subtotal, shipping_fee, total, shipping_address, receipt_path)
    values (v_store_id, generated_code, btrim(p_customer_name), normalized_phone, nullif(btrim(p_customer_instagram), ''), trusted_items, calculated_subtotal, delivery, calculated_total, p_shipping_address, p_receipt_path)
    on conflict (public_code) do nothing
    returning id into inserted_id;
    if inserted_id is not null then exit; end if;
  end loop;
  return generated_code;
end;
$$;
revoke all on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text) from public;
grant execute on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- set_order_status: tenant-safe
-- ---------------------------------------------------------------------------

create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  current_order public.orders%rowtype;
  restored_count integer;
begin
  if p_status not in ('Pending Verification', 'Processing', 'Shipped', 'Fulfilled', 'Cancelled') then raise exception 'Invalid order status'; end if;
  select * into current_order from public.orders where id = p_order_id and store_id = public.current_store_id() for update;
  if not found then raise exception 'Order not found'; end if;
  if current_order.status = p_status then return current_order; end if;

  if (current_order.status, p_status) not in (
    ('Pending Verification', 'Processing'),
    ('Pending Verification', 'Cancelled'),
    ('Processing', 'Shipped'),
    ('Processing', 'Cancelled'),
    ('Shipped', 'Fulfilled')
  ) then
    raise exception 'Invalid order status transition from % to %', current_order.status, p_status;
  end if;

  if p_status = 'Cancelled' then
    update public.products p set inventory = p.inventory + i.quantity
    from jsonb_to_recordset(current_order.items) as i(product_id uuid, quantity integer)
    where p.id = i.product_id
      and p.store_id = current_order.store_id;
    get diagnostics restored_count = row_count;
    if restored_count <> jsonb_array_length(current_order.items) then raise exception 'Order inventory cannot be restored'; end if;
    update public.orders set inventory_restocked = true, status = p_status where id = p_order_id returning * into current_order;
  else
    update public.orders set status = p_status where id = p_order_id returning * into current_order;
  end if;
  return current_order;
end;
$$;
revoke all on function public.set_order_status(uuid, text) from public;
revoke execute on function public.set_order_status(uuid, text) from anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_order_status: store-ready without breaking the default flow
-- ---------------------------------------------------------------------------

drop function if exists public.get_order_status(text, text);

create or replace function public.get_order_status(p_public_code text, p_phone text, p_store_slug text default null)
returns table (public_code text, items jsonb, subtotal numeric, shipping_fee numeric, total numeric, status text, shipping_address jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.public_code, o.items, o.subtotal, o.shipping_fee, o.total, o.status, o.shipping_address, o.created_at, o.updated_at
  from public.orders o
  where o.public_code = upper(btrim(p_public_code))
    and o.customer_phone = regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')
    and length(btrim(coalesce(p_public_code, ''))) > 0
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) >= 7
    and (
      p_store_slug is null
      or btrim(p_store_slug) = ''
      or o.store_id = (select s.id from public.stores s where s.slug = btrim(p_store_slug) and s.status = 'active')
    );
$$;
revoke all on function public.get_order_status(text, text, text) from public;
grant execute on function public.get_order_status(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- orders RLS: merchants read only their own store's orders; no direct writes
-- ---------------------------------------------------------------------------

drop policy if exists orders_admin_select on public.orders;

create policy orders_admin_select on public.orders
  for select to authenticated
  using (store_id = public.current_store_id());
