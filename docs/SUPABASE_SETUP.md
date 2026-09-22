# InstaStore Supabase setup

This is the fresh-install path for a **new, empty Supabase project**. Never run these migrations against an existing project that already has production data.

## Setup

1. Create a new Supabase project.
2. Copy its Project URL and anon key.
3. Configure local `.env`:

   ```env
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. In Storage, manually create a bucket named `receipts`. Set it **private**, maximum file size to **5,242,880 bytes (5 MiB)**, and allowed MIME types to `image/jpeg`, `image/png`, and `application/pdf`. Do not create the bucket with SQL.
5. In Storage, manually create a second bucket named `product-images`. Set it **public**, maximum file size to **5,242,880 bytes (5 MiB)**, and allowed MIME types to `image/jpeg`, `image/png`, and `image/webp`. Product images are public storefront assets; only admins can upload or delete them through Storage policies. Receipts are separate private data and must never be made public.
6. Apply the migrations in filename order (Supabase CLI may be used locally, but do not link or push to a remote project):

   - `0001_initial_commerce_schema.sql`
   - `0002_commerce_security_and_rpcs.sql`
   - `0003_receipt_storage_policies.sql`
   - `0004_product_image_storage_policies.sql`
   - `0005_harden_order_status_rpc_privilege.sql`
   - `0006_qualify_order_code_random_bytes.sql`
   - `0007_multi_store_foundation.sql`
7. Create the first user in Supabase Auth (email/password or the configured Auth provider).
8. Copy the Auth user's UUID and insert the matching admin profile in the SQL editor:

   ```sql
   insert into public.profiles (id, email, role)
   values ('AUTH_USER_UUID', 'admin@example.com', 'admin')
   on conflict (id) do update set role = 'admin', email = excluded.email;
   ```

   Do not put a password in repository documentation.

Customers are guests and must not receive Supabase Auth accounts.

## Verification SQL

Run these against the new project:

```sql
select to_regclass('public.profiles'), to_regclass('public.products'),
       to_regclass('public.store_settings'), to_regclass('public.orders');
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_admin', 'get_storefront_settings', 'create_store_order',
                  'get_order_status', 'set_order_status')
order by proname;
select id, store_name, currency, delivery_fee from public.store_settings;
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'products', 'store_settings', 'orders');
select policyname, tablename, cmd, roles
from pg_policies
where tablename in ('products', 'orders', 'store_settings')
   or tablename = 'objects';
select
  has_function_privilege('anon', 'public.set_order_status(uuid,text)', 'EXECUTE') as anon_set_order_status,
  has_function_privilege('authenticated', 'public.set_order_status(uuid,text)', 'EXECUTE') as authenticated_set_order_status;
```

Expected security conclusions: anon can select active products and execute `get_storefront_settings`, `create_store_order`, and `get_order_status`; anon cannot execute `set_order_status`, select/insert/update/delete orders, or modify products. Authenticated admins can select all products, manage products/settings, inspect orders, and execute `set_order_status`. Receipt uploads are limited to randomized `receipts/<uuid>.<extension>` paths; receipts are private and only admins can read them.

For the order-status privilege check, expect `anon_set_order_status = false` and `authenticated_set_order_status = true`.

To verify product-image policies, use:

```sql
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname like 'product_images_%';
```

The expected product-image policy model is admin-only INSERT, SELECT, and DELETE scoped to `bucket_id = 'product-images'`; anonymous and non-admin authenticated users cannot write. The bucket's public setting allows customer-facing image URLs, while receipts remain private and use separate policies.

### Tenant verification

Run these after applying `0007_multi_store_foundation.sql`:

```sql
-- public.stores exists and RLS is enabled.
select to_regclass('public.stores') as stores_table;
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and tablename = 'stores';

-- Exactly one initial store with slug default-store.
select id, slug, name, status from public.stores;
select count(*) as default_store_count
from public.stores where slug = 'default-store';

-- No null store_id remains in any backfilled table (all counts must be 0).
select
  (select count(*) from public.profiles where store_id is null)      as profiles_null_store,
  (select count(*) from public.products where store_id is null)      as products_null_store,
  (select count(*) from public.orders where store_id is null)        as orders_null_store,
  (select count(*) from public.store_settings where store_id is null) as settings_null_store;

-- No orphaned store_id references (all counts must be 0).
select
  (select count(*) from public.profiles p left join public.stores s on s.id = p.store_id where s.id is null)      as profiles_orphans,
  (select count(*) from public.products p left join public.stores s on s.id = p.store_id where s.id is null)      as products_orphans,
  (select count(*) from public.orders o left join public.stores s on s.id = o.store_id where s.id is null)        as orders_orphans,
  (select count(*) from public.store_settings st left join public.stores s on s.id = st.store_id where s.id is null) as settings_orphans;

-- store_settings.store_id is unique.
select count(*) = count(distinct store_id) as store_settings_store_id_unique
from public.store_settings;

-- Relevant constraints and indexes exist.
select conname, contype
from pg_constraint
where conrelid in ('public.stores'::regclass, 'public.store_settings'::regclass)
  and conname in ('stores_slug_url_safe', 'stores_status_valid', 'store_settings_store_id_unique')
order by conname;

select indexname
from pg_indexes
where tablename in ('profiles', 'products', 'orders')
  and indexname in ('profiles_store_id_idx', 'products_store_id_idx',
                    'orders_store_id_created_at_idx', 'orders_store_id_status_idx')
order by indexname;
```

Expected results: `stores_table` is not null, `rowsecurity` is `true`, `default_store_count` is `1`, every null/orphan count is `0`, `store_settings_store_id_unique` is `true`, and all three constraints plus all four indexes are present.

Products referenced by historical orders cannot be hard-deleted. Deactivate those products instead. The status state machine allows `Pending Verification -> Processing` or `Cancelled`, `Processing -> Shipped` or `Cancelled`, and `Shipped -> Fulfilled`; `Fulfilled` and `Cancelled` are terminal, and repeated same-status calls are idempotent. Cancellation restores reserved inventory exactly once only before shipment; shipped and fulfilled orders cannot be cancelled through the MVP RPC. Customers remain guests.

Confirm the application is configured for this new project only. It must never point at production data.

## Tenant foundation

The migrations now establish the data foundation for multiple merchant stores:

- `public.stores` exists, with one initial store created during migration.
- `profiles`, `products`, `orders`, and `store_settings` each contain a `store_id` referencing `public.stores`.
- Existing data is assigned to that one initial store (`slug = 'default-store'`).
- The UI still operates as one storefront at this stage. Tenant-aware authorization is not implemented until T01B, and store-scoped public routes are not implemented until T02.

There is still no customer login, subscription, payment gateway, or multi-image gallery in this MVP baseline.
