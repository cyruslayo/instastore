-- Store-scoped storage policies.
--
-- Replaces the single-store policies from 0003 (receipts) and 0004 (product
-- images) with tenant-aware versions. The buckets and their public/private
-- visibility are unchanged:
--   * product-images stays public for customer-facing URLs.
--   * receipts stays private.
--
-- Legacy paths (from before multi-store) remain usable:
--   * product images: products/<random-id>.<ext> — readable/deletable only by
--     the default-store merchant.
--   * receipts:       receipts/<random-id>.<ext>  — readable only by the
--     default-store merchant.
-- New writes always use the store-scoped format below.

-- ---------------------------------------------------------------------------
-- Product images
-- ---------------------------------------------------------------------------

drop policy if exists product_images_admin_insert on storage.objects;
drop policy if exists product_images_admin_select on storage.objects;
drop policy if exists product_images_admin_delete on storage.objects;

-- New uploads land under products/<store-id>/<random-id>.<ext>. The store-id
-- segment must equal the caller's active store, so a merchant cannot write into
-- another store's folder.
create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and name ~ '^products/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|webp)$'
    and split_part(name, '/', 2)::uuid = public.current_store_id()
  );

create policy product_images_admin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-images'
    and (
      (name ~ '^products/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|webp)$'
       and split_part(name, '/', 2)::uuid = public.current_store_id())
      or (name ~ '^products/[A-Za-z0-9-]{20,64}\.(jpg|jpeg|png|webp)$'
          and public.current_store_id() = public.default_store_id())
    )
  );

create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (
      (name ~ '^products/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|webp)$'
       and split_part(name, '/', 2)::uuid = public.current_store_id())
      or (name ~ '^products/[A-Za-z0-9-]{20,64}\.(jpg|jpeg|png|webp)$'
          and public.current_store_id() = public.default_store_id())
    )
  );

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------

drop policy if exists receipts_upload on storage.objects;
drop policy if exists receipts_upload_metadata_select on storage.objects;
drop policy if exists receipts_admin_select on storage.objects;

-- New uploads are store-scoped only. Anonymous customers may upload into any
-- store namespace; order creation enforces that the receipt namespace matches
-- the requested store.
create policy receipts_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'receipts'
    and name ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
  );

-- Storage performs a metadata SELECT as part of upload completion.
create policy receipts_upload_metadata_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'receipts'
    and name ~ '^receipts/[a-z0-9]+(-[a-z0-9]+)*/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
    and storage.allow_only_operation('storage.object.upload')
  );

-- Merchants read receipts under their own store namespace; the default-store
-- merchant additionally keeps access to legacy receipts.
create policy receipts_admin_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      name ~ ('^receipts/' || public.current_store_slug() || '/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$')
      or (name ~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
          and public.current_store_slug() = 'default-store')
    )
  );
