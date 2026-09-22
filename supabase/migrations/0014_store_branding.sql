-- Store identity fields remain plain data; color is restricted to #RRGGBB.

alter table public.store_settings
  add column description text not null default '',
  add column hero_image_url text not null default '',
  add column primary_color text not null default '#18231a',
  add constraint store_settings_primary_color_hex
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$');

-- Return types cannot be changed with CREATE OR REPLACE, so recreate these
-- functions while preserving their input signatures, security, and grants.
drop function public.get_storefront_settings();
create function public.get_storefront_settings()
returns table (
  store_name text, tagline text, logo_url text, instagram_handle text,
  whatsapp_number text, currency text, delivery_fee numeric,
  bank_name text, account_name text, account_number text,
  announcement_enabled boolean, announcement_text text,
  description text, hero_image_url text, primary_color text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.store_name, s.tagline, s.logo_url, s.instagram_handle,
    s.whatsapp_number, s.currency, s.delivery_fee, s.bank_name,
    s.account_name, s.account_number, s.announcement_enabled, s.announcement_text,
    s.description, s.hero_image_url, s.primary_color
  from public.store_settings s
  where s.store_id = coalesce(public.current_store_id(), public.default_store_id());
$$;
revoke all on function public.get_storefront_settings() from public;
grant execute on function public.get_storefront_settings() to anon, authenticated;

drop function public.get_storefront_settings_by_slug(text);
create function public.get_storefront_settings_by_slug(p_slug text)
returns table (
  store_name text, tagline text, logo_url text, instagram_handle text,
  whatsapp_number text, currency text, delivery_fee numeric,
  bank_name text, account_name text, account_number text,
  announcement_enabled boolean, announcement_text text,
  description text, hero_image_url text, primary_color text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select s.store_name, s.tagline, s.logo_url, s.instagram_handle,
    s.whatsapp_number, s.currency, s.delivery_fee, s.bank_name,
    s.account_name, s.account_number, s.announcement_enabled, s.announcement_text,
    s.description, s.hero_image_url, s.primary_color
  from public.store_settings s
  join public.stores st on st.id = s.store_id
  where st.slug = btrim(p_slug) and st.status = 'active';
$$;
revoke all on function public.get_storefront_settings_by_slug(text) from public;
grant execute on function public.get_storefront_settings_by_slug(text) to anon, authenticated;

-- Store public assets have separate top-level namespaces from product photos.
-- Existing products/<store-id>/ policies remain untouched.
create policy store_assets_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and name ~ '^stores/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(logo|hero)/[A-Za-z0-9-]{32,36}\.(jpg|png|webp)$'
    and split_part(name, '/', 2)::uuid = public.current_store_id()
  );

create policy store_assets_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and name ~ '^stores/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(logo|hero)/[A-Za-z0-9-]{32,36}\.(jpg|png|webp)$'
    and split_part(name, '/', 2)::uuid = public.current_store_id()
  );

create policy store_assets_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and name ~ '^stores/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/(logo|hero)/[A-Za-z0-9-]{32,36}\.(jpg|png|webp)$'
    and split_part(name, '/', 2)::uuid = public.current_store_id()
  );
