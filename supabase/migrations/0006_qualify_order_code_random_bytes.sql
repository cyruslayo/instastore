-- pgcrypto is installed in Supabase's extensions schema. Keep the SECURITY
-- DEFINER search_path restricted and schema-qualify the random byte function.

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
  existing_code text;
  existing_phone text;
  item_count integer;
begin
  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then raise exception 'Customer name is required'; end if;
  if length(normalized_phone) < 7 then raise exception 'A valid phone number is required'; end if;
  if p_shipping_address is null or jsonb_typeof(p_shipping_address) <> 'object' or p_shipping_address = '{}'::jsonb then raise exception 'Shipping address is required'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if p_receipt_path is null or p_receipt_path !~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$' then raise exception 'Invalid receipt path'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'receipts' and name = p_receipt_path) then raise exception 'Receipt object does not exist'; end if;
  if p_total is null or p_total < 0 then raise exception 'Invalid submitted total'; end if;

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
    generated_code := 'ORD-' || upper(encode(extensions.gen_random_bytes(12), 'hex'));
    insert into public.orders (public_code, customer_name, customer_phone, customer_instagram, items, subtotal, shipping_fee, total, shipping_address, receipt_path)
    values (generated_code, btrim(p_customer_name), normalized_phone, nullif(btrim(p_customer_instagram), ''), trusted_items, calculated_subtotal, delivery, calculated_total, p_shipping_address, p_receipt_path)
    on conflict (public_code) do nothing
    returning id into inserted_id;
    if inserted_id is not null then exit; end if;
  end loop;
  return generated_code;
end;
$$;

revoke all on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text) from public;
grant execute on function public.create_store_order(text, text, text, jsonb, numeric, jsonb, text) to anon, authenticated;
