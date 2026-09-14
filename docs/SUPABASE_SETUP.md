# InstaStore Supabase setup

This is the fresh-install path for a **new, empty Supabase project**. Never point it at Botanica production or run these migrations against an existing project.

## Setup

1. Create a new Supabase project.
2. Copy its Project URL and anon key.
3. Configure local `.env`:

   ```env
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. In Storage, manually create a bucket named `receipts`. Set it **private**, maximum file size to **5,242,880 bytes (5 MiB)**, and allowed MIME types to `image/jpeg`, `image/png`, and `application/pdf`. Do not create the bucket with SQL.
5. Apply `supabase/migrations/0001_initial_commerce_schema.sql`, then `0002_commerce_security_and_rpcs.sql`, then `0003_receipt_storage_policies.sql` in filename order (Supabase CLI may be used locally, but do not link or push to a remote project).
6. Create the first user in Supabase Auth (email/password or the configured Auth provider).
7. Copy the Auth user's UUID and insert the matching admin profile in the SQL editor:

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
```

Expected security conclusions: anon can select active products and execute `get_storefront_settings`, `create_store_order`, and `get_order_status`; anon cannot select/insert/update/delete orders or modify products. Only admins can select all products, manage products/settings, inspect orders, and execute `set_order_status`. Receipt uploads are limited to randomized `receipts/<uuid>.<extension>` paths; receipts are private and only admins can read them.

Products referenced by historical orders cannot be hard-deleted. Deactivate those products instead. The status state machine allows `Pending Verification -> Processing` or `Cancelled`, `Processing -> Shipped` or `Cancelled`, and `Shipped -> Fulfilled`; `Fulfilled` and `Cancelled` are terminal, and repeated same-status calls are idempotent. Cancellation restores reserved inventory exactly once only before shipment; shipped and fulfilled orders cannot be cancelled through the MVP RPC. Customers remain guests.

Confirm the application is configured for this new project only. It must never point at Botanica production data. There is no `store_id`, tenant system, customer login, subscription, payment gateway, or product-image upload in this MVP baseline.
