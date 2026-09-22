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
   - `0008_tenant_security_and_rpcs.sql`
   - `0009_tenant_storage_policies.sql`
7. Create the first user in Supabase Auth (email/password or the configured Auth provider).
8. Copy the Auth user's UUID and insert the matching admin profile for the existing `default-store` in the SQL editor:

   ```sql
   insert into public.profiles (id, email, role, store_id)
   values ('AUTH_USER_UUID', 'admin@example.com', 'admin',
           (select id from public.stores where slug = 'default-store'))
   on conflict (id) do update set role = 'admin', email = excluded.email,
     store_id = excluded.store_id;
   ```

   Do not put a password in repository documentation.

Customers are guests and must not receive Supabase Auth accounts.

## Manual merchant provisioning

There is no self-signup and no store switcher. Each merchant belongs to exactly one store. To onboard another merchant:

1. Create a store:

   ```sql
   insert into public.stores (slug, name) values ('my-store', 'My Store');
   ```

2. Create that store's settings row (keyed by `store_id`):

   ```sql
   insert into public.store_settings (store_id, store_name, currency, delivery_fee)
   values ((select id from public.stores where slug = 'my-store'), 'My Store', 'NGN', 0);
   ```

3. Create the merchant's Auth user, then assign their profile to the store:

   ```sql
   insert into public.profiles (id, email, role, store_id)
   values ('AUTH_USER_UUID', 'merchant@example.com', 'admin',
           (select id from public.stores where slug = 'my-store'));
   ```

Do not expose public multi-store URLs yet; `default-store` remains the only live public storefront until T02.

## Storage path formats

New writes are store-scoped; legacy single-store objects remain usable.

- Product images (public `product-images` bucket): new uploads use `products/<store-id>/<random-id>.<ext>`. Legacy `products/<random-id>.<ext>` objects keep their public URLs and are deletable only by the `default-store` merchant.
- Receipts (private `receipts` bucket): new uploads use `receipts/<store-slug>/<random-id>.<ext>`. Legacy `receipts/<random-id>.<ext>` objects remain readable only by the `default-store` merchant.

`<store-id>` is a UUID; `<store-slug>` matches `^[a-z0-9]+(-[a-z0-9]+)*$`; `<random-id>` is 32–36 URL-safe characters.

## Verification SQL

Run these against the new project:

```sql
select to_regclass('public.stores'), to_regclass('public.profiles'),
       to_regclass('public.products'), to_regclass('public.store_settings'),
       to_regclass('public.orders');
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('is_admin', 'current_store_id', 'current_store_slug',
                  'default_store_id', 'get_storefront_settings',
                  'get_storefront_settings_by_slug', 'create_store_order',
                  'get_order_status', 'set_order_status')
order by proname;
select store_id, store_name, currency, delivery_fee from public.store_settings;
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'products', 'store_settings', 'orders', 'stores');
select policyname, tablename, cmd, roles
from pg_policies
where tablename in ('products', 'orders', 'store_settings', 'stores')
   or tablename = 'objects';
select
  has_function_privilege('anon', 'public.set_order_status(uuid,text)', 'EXECUTE') as anon_set_order_status,
  has_function_privilege('authenticated', 'public.set_order_status(uuid,text)', 'EXECUTE') as authenticated_set_order_status;
```

Expected security conclusions: anon can select active `default-store` products and execute `get_storefront_settings`, `create_store_order`, and `get_order_status`; anon cannot execute `set_order_status`, read/write orders, modify products, or modify settings. Authenticated merchants can manage only their own store's products/settings/orders and execute `set_order_status`. Receipt uploads are store-scoped; receipts are private and only the owning merchant can read them (plus legacy receipts for the `default-store` merchant).

For the order-status privilege check, expect `anon_set_order_status = false` and `authenticated_set_order_status = true`.

### Tenant verification

Run these after applying `0007` through `0009`:

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

-- store_settings is keyed by store_id (no boolean id column remains).
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'store_settings'
order by ordinal_position;
select count(*) as settings_id_column
from information_schema.columns
where table_schema = 'public' and table_name = 'store_settings' and column_name = 'id';

-- No null store_id remains in any backfilled table (all counts must be 0).
select
  (select count(*) from public.profiles where store_id is null)      as profiles_null_store,
  (select count(*) from public.products where store_id is null)      as products_null_store,
  (select count(*) from public.orders where store_id is null)        as orders_null_store,
  (select count(*) from public.store_settings where store_id is null) as settings_null_store;

-- store_settings.store_id is the primary key.
select count(*) = count(distinct store_id) as store_settings_store_id_unique
from public.store_settings;
```

Expected results: `stores_table` is not null, `rowsecurity` is `true`, `default_store_count` is `1`, `settings_id_column` is `0`, every null count is `0`, and `store_settings_store_id_unique` is `true`.

Products referenced by historical orders cannot be hard-deleted. Deactivate those products instead. The status state machine allows `Pending Verification -> Processing` or `Cancelled`, `Processing -> Shipped` or `Cancelled`, and `Shipped -> Fulfilled`; `Fulfilled` and `Cancelled` are terminal, and repeated same-status calls are idempotent. Cancellation restores reserved inventory exactly once only before shipment; shipped and fulfilled orders cannot be cancelled through the MVP RPC. Customers remain guests.

Confirm the application is configured for this new project only. It must never point at production data.

## Two-store isolation verification

Create a second store plus two merchant profiles in a disposable project, then run these checks. Runtime RLS verification requires an actual Supabase/Postgres instance; if one is not available, review the policies statically and treat this section as the exact procedure to run when a disposable project exists.

Setup:

```sql
insert into public.stores (slug, name) values ('store-b', 'Store B');
insert into public.store_settings (store_id, store_name, currency, delivery_fee)
values ((select id from public.stores where slug = 'store-b'), 'Store B', 'NGN', 0);
-- profiles for Merchant A (default-store) and Merchant B (store-b) are inserted
-- per the manual provisioning steps above using each merchant's auth UUID.
```

Run each check impersonating the relevant role. Merchant A must NOT be able to: read Store B draft products, insert/update/delete a Store B product, read Store B orders, change Store B order status, update Store B settings, read Store B private receipts, upload into Store B's product-image folder, or delete Store B's images. Merchant B has the same isolation from Store A.

Anonymous users must: be able to read active `default-store` products; be unable to read drafts, private orders, or settings; be unable to change orders/settings or manage product images; be able to upload a correctly formatted `receipts/<slug>/<uuid>.<ext>` object; and be unable to download private receipts.

`create_store_order()` must reject a product from a different store, an unknown store, a suspended store, and a receipt-namespace mismatch, while preserving stock locking and trusted price calculation. `set_order_status()` must reject a cross-store order ID (returns "Order not found").
