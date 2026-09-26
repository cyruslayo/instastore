-- Trusted payment verification fact and store-scoped consent metadata.
--
-- A verified payment is a fact on the order itself: the first
-- Pending Verification -> Processing transition stamps payment_verified_at and a
-- stable payment_event_id in the same transaction as the status change. The
-- order row already holds the trusted amounts and consent snapshot, so no copy
-- is made. No external service is called. Historical orders are not backfilled.

alter table public.orders
  add column payment_verified_at timestamptz,
  add column payment_event_id uuid,
  add constraint orders_payment_event_id_key unique (payment_event_id),
  add constraint orders_payment_fact_complete check ((payment_verified_at is null) = (payment_event_id is null));

-- ---------------------------------------------------------------------------
-- set_order_status: unchanged rules from 0008, plus the payment fact.
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
  elsif current_order.status = 'Pending Verification' and p_status = 'Processing' then
    -- First trusted payment verification. coalesce keeps the original fact.
    update public.orders set
      status = p_status,
      payment_verified_at = coalesce(payment_verified_at, now()),
      payment_event_id = coalesce(payment_event_id, gen_random_uuid())
    where id = p_order_id returning * into current_order;
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
-- create_store_order: 0015 body, plus bounded store-scoped consent metadata.
-- Same signature, so existing PostgREST calls are unaffected.
-- ---------------------------------------------------------------------------

create or replace function public.create_store_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_instagram text,
  p_items jsonb,
  p_total numeric,
  p_shipping_address jsonb,
  p_receipt_path text,
  p_store_slug text,
  p_delivery_zone_id uuid,
  p_attribution jsonb default '{}'::jsonb
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
  analytics_allowed boolean := coalesce(p_attribution->'analytics_consent' = 'true'::jsonb, false);
  marketing_allowed boolean := coalesce(p_attribution->'marketing_consent' = 'true'::jsonb, false);
  trusted_attribution jsonb;
begin
  if length(v_store_slug) = 0 then raise exception 'Store slug is required'; end if;
  select id into v_store_id from public.stores where slug = v_store_slug and status = 'active';
  if v_store_id is null then raise exception 'Store is unavailable'; end if;

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

  if p_receipt_path ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/' then
    if split_part(p_receipt_path, '/', 2) <> v_store_slug then raise exception 'Receipt does not belong to this store'; end if;
  else
    if v_store_slug <> 'default-store' then raise exception 'Legacy receipt cannot be used for this store'; end if;
  end if;

  -- Preserve receipt idempotency: retries return before any attribution rewrite,
  -- stock mutation, or second order insert.
  perform pg_advisory_xact_lock(hashtextextended(p_receipt_path, 0));
  select public_code, customer_phone into existing_code, existing_phone
  from public.orders where receipt_path = p_receipt_path;
  if existing_code is not null then
    if existing_phone = normalized_phone then return existing_code; end if;
    raise exception 'This receipt has already been submitted';
  end if;

  select count(*), count(distinct (coalesce(value->>'product_id', value->>'id')))
    into item_count, quantity from jsonb_array_elements(p_items);
  if item_count <> quantity then raise exception 'Duplicate products are not allowed'; end if;

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

  -- Analytics identifiers are retained only with Analytics consent. Landing URL
  -- and referrer are reduced to origin+path; approved campaign parameters are
  -- separate bounded keys. Meta identifiers require Marketing consent.
  trusted_attribution := jsonb_strip_nulls(jsonb_build_object(
    'analytics_consent', analytics_allowed,
    'marketing_consent', marketing_allowed,
    'consent_version', left(nullif(btrim(coalesce(p_attribution->>'consent_version', '')), ''), 32),
    -- Customer choice time as reported by the browser, and the server time the
    -- choice was received. Receipt time does not prove the browser's claim.
    'consent_updated_at', case when (p_attribution->>'consent_updated_at') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$'
      then p_attribution->>'consent_updated_at' end,
    'consent_received_at', now(),
    -- A choice recorded for another store is never attached to this order.
    'consent_store_id', case when (p_attribution->>'consent_store_id') = v_store_id::text then v_store_id end,
    'landing_url', case when analytics_allowed then left(regexp_replace(coalesce(p_attribution->>'landing_url', ''), '[?#].*$', ''), 1000) end,
    'referrer', case when analytics_allowed then left(regexp_replace(coalesce(p_attribution->>'referrer', ''), '[?#].*$', ''), 1000) end,
    'utm_source', case when analytics_allowed then left(nullif(btrim(p_attribution->>'utm_source'), ''), 200) end,
    'utm_medium', case when analytics_allowed then left(nullif(btrim(p_attribution->>'utm_medium'), ''), 200) end,
    'utm_campaign', case when analytics_allowed then left(nullif(btrim(p_attribution->>'utm_campaign'), ''), 200) end,
    'utm_content', case when analytics_allowed then left(nullif(btrim(p_attribution->>'utm_content'), ''), 200) end,
    'utm_term', case when analytics_allowed then left(nullif(btrim(p_attribution->>'utm_term'), ''), 200) end,
    'visitor_id', case when analytics_allowed then left(nullif(btrim(p_attribution->>'visitor_id'), ''), 64) end,
    'session_id', case when analytics_allowed then left(nullif(btrim(p_attribution->>'session_id'), ''), 64) end,
    'fbclid', case when marketing_allowed then left(nullif(btrim(p_attribution->>'fbclid'), ''), 500) end,
    'fbc', case when marketing_allowed then left(nullif(btrim(p_attribution->>'fbc'), ''), 500) end,
    'fbp', case when marketing_allowed then left(nullif(btrim(p_attribution->>'fbp'), ''), 500) end
  ));

  loop
    generated_code := 'ORD-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    insert into public.orders (
      store_id, public_code, customer_name, customer_phone, customer_instagram,
      items, subtotal, shipping_fee, total, shipping_address, receipt_path,
      delivery_zone_id, delivery_city, delivery_zone_name, delivery_provider, delivery_estimate,
      attribution
    ) values (
      v_store_id, generated_code, btrim(p_customer_name), normalized_phone, nullif(btrim(p_customer_instagram), ''),
      trusted_items, calculated_subtotal, delivery, calculated_total, p_shipping_address, p_receipt_path,
      zone.id, zone.city, zone.name, zone.provider, zone.estimate, trusted_attribution
    ) on conflict (public_code) do nothing returning id into inserted_id;
    if inserted_id is not null then exit; end if;
  end loop;
  return generated_code;
end;
$$;

revoke all on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text, uuid, jsonb) from public;
grant execute on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text, text, uuid, jsonb) to anon, authenticated;
