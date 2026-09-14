-- Access control and transaction-bound commerce functions.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;

create policy profiles_admin_select on public.profiles for select to authenticated using (public.is_admin());
create policy products_public_active_select on public.products for select to anon, authenticated using (is_active or public.is_admin());
create policy products_admin_insert on public.products for insert to authenticated with check (public.is_admin());
create policy products_admin_update on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy products_admin_delete on public.products for delete to authenticated using (public.is_admin());
create policy store_settings_admin_select on public.store_settings for select to authenticated using (public.is_admin());
create policy store_settings_admin_update on public.store_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_select on public.orders for select to authenticated using (public.is_admin());

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
  from public.store_settings s where s.id = true;
$$;
revoke all on function public.get_storefront_settings() from public;
grant execute on function public.get_storefront_settings() to anon, authenticated;

create or replace function public.create_store_order(
  p_customer_name text,
  p_customer_phone text,
  p_customer_instagram text,
  p_items jsonb,
  p_total numeric,
  p_shipping_address jsonb,
  p_receipt_path text
)
returns text
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  normalized_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9+]', '', 'g');
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
  item_count integer;
begin
  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then raise exception 'Customer name is required'; end if;
  if length(normalized_phone) < 7 then raise exception 'A valid phone number is required'; end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' or p_shipping_address = '{}'::jsonb then raise exception 'Shipping address is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if p_receipt_path is null or p_receipt_path !~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$' then raise exception 'Invalid receipt path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'receipts' and name = p_receipt_path) then raise exception 'Receipt object does not exist'; end if;
  if p_total is null or p_total < 0 then raise exception 'Invalid submitted total'; end if;

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
    select * into product_row from public.products where id = product_id and is_active for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if product_row.inventory < quantity then raise exception 'Insufficient inventory'; end if;
    update public.products set inventory = inventory - quantity where id = product_id;
    calculated_subtotal := calculated_subtotal + product_row.price * quantity;
    trusted_items := trusted_items || jsonb_build_array(jsonb_build_object(
      'product_id', product_row.id, 'name', product_row.name, 'sku', product_row.sku,
      'category', product_row.category, 'price', product_row.price, 'quantity', quantity,
      'image', product_row.image));
  end loop;

  select delivery_fee into delivery from public.store_settings where id = true;
  delivery := coalesce(delivery, 0);
  calculated_total := calculated_subtotal + delivery;
  if p_total <> calculated_total then raise exception 'Submitted total does not match current prices'; end if;

  loop
      generated_code := 'ORD-' || upper(encode(gen_random_bytes(12), 'hex'));
    begin
      insert into public.orders (public_code, customer_name, customer_phone, customer_instagram, items, subtotal, shipping_fee, total, shipping_address, receipt_path)
      values (generated_code, btrim(p_customer_name), normalized_phone, nullif(btrim(p_customer_instagram), ''), trusted_items, calculated_subtotal, delivery, calculated_total, p_shipping_address, p_receipt_path)
      returning id into inserted_id;
      exit;
    exception when unique_violation then
      -- Retry only the public-code collision; all other constraints still fail.
    end;
  end loop;
  return generated_code;
end;
$$;
revoke all on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text) from public;
grant execute on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text) to anon, authenticated;

create or replace function public.set_order_status(p_order_id uuid, p_status text)
returns public.orders
language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  current_order public.orders%rowtype;
  restored_count integer;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('Pending Verification', 'Processing', 'Shipped', 'Fulfilled', 'Cancelled') then raise exception 'Invalid order status'; end if;
  select * into current_order from public.orders where id = p_order_id for update;
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
    where p.id = i.product_id;
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
grant execute on function public.set_order_status(uuid, text) to authenticated;

create or replace function public.get_order_status(p_public_code text, p_phone text)
returns table (public_code text, items jsonb, subtotal numeric, shipping_fee numeric, total numeric, status text, shipping_address jsonb, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp
as $$
  select o.public_code, o.items, o.subtotal, o.shipping_fee, o.total, o.status, o.shipping_address, o.created_at, o.updated_at
  from public.orders o
  where o.public_code = upper(btrim(p_public_code))
    and o.customer_phone = regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')
    and length(btrim(coalesce(p_public_code, ''))) > 0
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) >= 7;
$$;
revoke all on function public.get_order_status(text, text) from public;
grant execute on function public.get_order_status(text, text) to anon, authenticated;
