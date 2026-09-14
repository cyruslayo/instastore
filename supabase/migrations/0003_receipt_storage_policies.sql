-- The receipts bucket is created manually (private, 5 MiB, JPEG/PNG/PDF).
-- These policies do not create or alter storage.buckets metadata.

create policy receipts_upload on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'receipts'
    and name ~ '^receipts/[A-Za-z0-9-]{32,36}\.(jpg|jpeg|png|pdf)$'
  );

-- Storage may perform a metadata SELECT as part of upload completion. This
-- narrow exception does not permit ordinary downloads/listing.
create policy receipts_upload_metadata_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'receipts' and storage.allow_only_operation('storage.object.upload'));

create policy receipts_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
