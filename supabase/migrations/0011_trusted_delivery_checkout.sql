-- Trusted delivery checkout and store-scoped order tracking.
--
-- This is the second half of the T02/T03 rollout. It replaces the flat
-- store_settings.delivery_fee checkout contract with delivery_zones and makes
-- both order creation and order tracking store-explicit.
--
-- The browser never supplies authoritative delivery data. create_store_order()
-- resolves the store and the delivery zone, confirms the zone belongs to the
-- store and is active, then reads the fee, city, zone name, provider, and
-- estimate from the database and snapshots them onto the order.
--
-- store_settings.delivery_fee is deprecated but kept for now; nothing here
-- reads it. Existing protections are preserved: product row locking, stock
-- checks, duplicate-product rejection, trusted product prices, receipt
-- existence validation, receipt idempotency, tracking-code generation, and
-- transaction safety.

-- ---------------------------------------------------------------------------
-- Receipts: uploads must target an active store namespace
-- ---------------------------------------------------------------------------

drop policy if exists receipts_upload on storage.objects;

create policy receipts_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'receipts'
    and name ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
    and public.store_slug_is_active(split_part(name, '/', 2))
  );

drop policy if exists receipts_upload_metadata_select on storage.objects;

create policy receipts_upload_metadata_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'receipts'
    and name ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
    and public.store_slug_is_active(split_part(name, '/', 2))
    and storage.allow_only_operation('storage.object.upload')
  );

-- ---------------------------------------------------------------------------
-- create_store_order: store slug and delivery zone are required
-- ---------------------------------------------------------------------------

drop function if exists public.create_store_order(text, text, text, jsonb, numeric, jsonb, text);
drop function if exists public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text);

create or replace function public.create_store_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_instagram text,
  p_items jsonb,
  p_total numeric,
  p_shipping_address jsonb,
  p_receipt_path text,
  p_store_slug text,
  p_delivery_zone_id uuid
)
returns text
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9+]', '', 'g');
  v_store_slug text := lower(btrim(coalesce(p_store_slug, '')));
  v_store_id uuid;
  zone public.delivery_zones%rowtype;
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
  if length(v_store_slug) = 0 then raise exception 'Store slug is required'; end if;
  select id into v_store_id
  from public.stores
  where slug = v_store_slug
    and status = 'active';
  if v_store_id is null then raise exception 'Store is unavailable'; end if;

  -- The delivery zone is resolved and validated server-side. Fee, city, zone
  -- name, provider, and estimate all come from this row, never from the client.
  if p_delivery_zone_id is null then raise exception 'Delivery zone is required'; end if;
  select * into zone from public.delivery_zones where id = p_delivery_zone_id for share;
  if not found then raise exception 'Delivery zone is unavailable'; end if;
  if zone.store_id <> v_store_id then raise exception 'Delivery zone does not belong to this store'; end if;
  if not zone.is_active then raise exception 'Delivery zone is unavailable'; end if;

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

  delivery := zone.fee;
  calculated_total := calculated_subtotal + delivery;
  if p_total <> calculated_total then raise exception 'Submitted total does not match current prices'; end if;

  loop
    generated_code := 'ORD-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    insert into public.orders (
      store_id, public_code, customer_name, customer_phone, customer_instagram,
      items, subtotal, shipping_fee, total, shipping_address, receipt_path,
      delivery_zone_id, delivery_city, delivery_zone_name, delivery_provider, delivery_estimate
    )
    values (
      v_store_id, generated_code, btrim(p_customer_name), normalized_phone, nullif(btrim(p_customer_instagram), ''),
      trusted_items, calculated_subtotal, delivery, calculated_total, p_shipping_address, p_receipt_path,
      zone.id, zone.city, zone.name, zone.provider, zone.estimate
    )
    on conflict (public_code) do nothing
    returning id into inserted_id;
    if inserted_id is not null then exit; end if;
  end loop;
  return generated_code;
end;
$$;
revoke all on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text, uuid) from public;
grant execute on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_order_status: store slug is now required, and delivery snapshots are
-- returned so customers can see what they paid for
-- ---------------------------------------------------------------------------

drop function if exists public.get_order_status(text, text, text);

create or replace function public.get_order_status(p_public_code text, p_phone text, p_store_slug text)
returns table (
  public_code text, items jsonb, subtotal numeric, shipping_fee numeric, total numeric,
  status text, shipping_address jsonb, delivery_city text, delivery_zone_name text,
  delivery_provider text, delivery_estimate text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.public_code, o.items, o.subtotal, o.shipping_fee, o.total, o.status,
    o.shipping_address, o.delivery_city, o.delivery_zone_name, o.delivery_provider,
    o.delivery_estimate, o.created_at, o.updated_at
  from public.orders o
  where o.public_code = upper(btrim(p_public_code))
    and o.customer_phone = regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')
    and o.store_id = (
      select s.id from public.stores s
      where s.slug = btrim(p_store_slug) and s.status = 'active'
    )
    and length(btrim(coalesce(p_public_code, ''))) > 0
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) >= 7
    and length(btrim(coalesce(p_store_slug, ''))) > 0;
$$;
revoke all on function public.get_order_status(text, text, text) from public;
grant execute on function public.get_order_status(text, text, text) to anon, authenticated;
