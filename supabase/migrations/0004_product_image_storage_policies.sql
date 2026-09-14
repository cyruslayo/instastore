-- The product-images bucket is created manually as a public bucket.
-- These policies only govern object management; public URLs serve storefront images.

create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_admin()
    and name ~ '^products/[A-Za-z0-9-]{20,64}\.(jpg|jpeg|png|webp)$'
  );

-- Admin SELECT is required for authenticated management clients and any
-- storage metadata checks. Public storefront reads use the bucket's public URL.
create policy product_images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
