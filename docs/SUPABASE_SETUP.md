# InstaStore Supabase setup

This is the fresh-install path for a **new, empty Supabase project**. Never run these migrations against an existing project that already has production data. The previously configured shared project is known to be behind the repository migration chain and is read-only unless the owner explicitly authorizes a migration. Use an isolated project for T09 and an explicitly identified, authorized project for production. Never create paid resources without approval.

## Setup

1. Create/identify a new isolated Supabase project only with authorization and any required resource-cost approval. Do not guess a project ID or treat the old shared project as production.
2. Copy its Project URL and anon key.
3. Configure local `.env`:

   ```env
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. In Storage, manually create a bucket named `receipts`. Set it **private**, maximum file size to **5,242,880 bytes (5 MiB)**, and allowed MIME types to `image/jpeg`, `image/png`, and `application/pdf`. Do not create the bucket with SQL.
5. In Storage, manually create a second bucket named `product-images`. Set it **public**, maximum file size to **5,242,880 bytes (5 MiB)**, and allowed MIME types to `image/jpeg`, `image/png`, and `image/webp`. Product images are public storefront assets; only admins can upload or delete them through Storage policies. Receipts are separate private data and must never be made public.
6. Apply migrations in filename order. For an authorized fresh remote project, use the current Supabase CLI workflow from the repository root:

   ```sh
   supabase login
   supabase link --project-ref PROJECT_REF
   supabase migration list --linked
   supabase db push --dry-run
   # Inspect the target project and every pending migration before proceeding.
   supabase db push
   supabase migration list --linked
   ```

   Substitute only the actual project reference provided by the operator. Never link the shared/production project without explicit authorization. If the CLI reports existing remote migration history or unexpected pending migrations, stop and investigate; do not bypass migration history manually. Do not reset a remote project. For local SQL testing, use a disposable local database. Then apply the migrations in filename order:

   - `0001_initial_commerce_schema.sql`
   - `0002_commerce_security_and_rpcs.sql`
   - `0003_receipt_storage_policies.sql`
   - `0004_product_image_storage_policies.sql`
   - `0005_harden_order_status_rpc_privilege.sql`
   - `0006_qualify_order_code_random_bytes.sql`
   - `0007_multi_store_foundation.sql`
   - `0008_tenant_security_and_rpcs.sql`
   - `0009_tenant_storage_policies.sql`
   - `0010_storefront_tenancy_and_delivery_zones.sql`
   - `0011_trusted_delivery_checkout.sql`
   - `0012_delivery_zone_ordering.sql`
    - `0013_product_merchandising.sql`
    - `0014_store_branding.sql`
     - `0015_measurement_foundation.sql`
     - `0016_launch_security_hardening.sql`
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

Public storefronts are live at `/s/<store-slug>` (for example `/s/default-store`). `/` is the InstaStore platform homepage. Legacy customer URLs (`/shop`, `/cart`, `/checkout`, `/track`, `/product/<slug>`, `/oils`) redirect to the matching `default-store` route.

## Delivery zones

Delivery pricing is per store and per city. Only `Abuja` and `Lagos` are supported. Zone names are unique within a store and city (`store_id + city + lower(btrim(name))`), so the same name may exist in Abuja and Lagos. Public and merchant zone lists order by `city`, then `sort_order`, then `name`; `sort_order` defaults to `0`. Migrations never insert delivery zones; the merchant or operator must enter real prices (through `/admin/delivery`, or directly with SQL before a merchant exists):

```sql
insert into public.delivery_zones (store_id, city, name, provider, fee, estimate, note)
values (
  (select id from public.stores where slug = 'default-store'),
  'Abuja', 'Wuse 2', 'Private Rider', 2500, 'Same day', null
);
```

Checkout requires an active delivery zone for the selected city and rejects orders without one. `store_settings.delivery_fee` is deprecated and is no longer read by checkout.

## Deployment sequence for the delivery contract change

The delivery-contract rollout originally listed `0010` and `0011` but omitted `0012`. Apply the complete ordered chain through `0012` before deploying the matching delivery code. For a fresh rollout including B3, apply `0010` through `0014` in order before deploying:

1. `pnpm check`
2. `pnpm build`
3. Apply migrations `0010_storefront_tenancy_and_delivery_zones.sql` through `0014_store_branding.sql` in filename order (including `0012_delivery_zone_ordering.sql` and both B3 migrations).
4. Configure real delivery zones for `default-store`
5. Deploy the application
6. Test `default-store` checkout and public catalog/branding

Do not create fake delivery zones in migrations.

## Storage path formats

New writes are store-scoped; legacy single-store objects remain usable.

- Product images (public `product-images` bucket): new uploads use `products/<store-id>/<random-id>.<ext>`. Legacy `products/<random-id>.<ext>` objects keep their public URLs and are deletable only by the `default-store` merchant.
- Product galleries use the same bucket and `products/<store-id>/<random-id>.<ext>` paths. A product has zero to four ordered gallery URLs in `gallery_images`; its primary image stays in `image`.
- Store logos and hero images use the same bucket under `stores/<store-id>/logo/<random-id>.<ext>` and `stores/<store-id>/hero/<random-id>.<ext>`. JPEG, PNG, and WebP files up to 5 MiB are supported. Migration `0014` scopes merchant upload/read/delete policies to their own store namespace.
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
  and tablename in ('profiles', 'products', 'store_settings', 'orders', 'stores', 'delivery_zones');
select policyname, tablename, cmd, roles
from pg_policies
where tablename in ('products', 'orders', 'store_settings', 'stores', 'delivery_zones')
   or tablename = 'objects';
select
  has_function_privilege('anon', 'public.set_order_status(uuid,text)', 'EXECUTE') as anon_set_order_status,
  has_function_privilege('authenticated', 'public.set_order_status(uuid,text)', 'EXECUTE') as authenticated_set_order_status;
```

Expected security conclusions: anon can select active products and active delivery zones for any active store, and execute `get_storefront_settings`, `get_storefront_settings_by_slug`, `create_store_order`, and `get_order_status`; anon cannot execute `set_order_status`, read/write orders, modify products, or modify settings. Draft products and products belonging to suspended stores are not public. Authenticated merchants can manage only their own store's products/settings/orders/delivery zones and execute `set_order_status`. Receipt uploads are store-scoped to an active store; receipts are private and only the owning merchant can read them (plus legacy receipts for the `default-store` merchant).

For the order-status privilege check, expect `anon_set_order_status = false` and `authenticated_set_order_status = true`.

Also verify the migration history with `supabase migration list --linked`; a fresh launch candidate must have every repository migration `0001` through `0016` recorded. Verify `orders.attribution` exists after migration 0015. Do not mark a SQL-shim run as real Supabase verification.

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

Confirm the application is configured for the intended project. Test project values must never point at production data. The service-role key is never a browser/build setting and must not be exposed through a `PUBLIC_` variable.

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

Anonymous users must: be able to read active products and active delivery zones for any active store; be unable to read drafts, private orders, or settings; be unable to change orders/settings or manage product images; be able to upload a correctly formatted `receipts/<slug>/<uuid>.<ext>` object for an active store; and be unable to download private receipts.

`create_store_order()` must reject a product from a different store, an unknown store, a suspended store, a receipt-namespace mismatch, a missing delivery zone, a delivery zone owned by another store, an inactive delivery zone, and a manipulated total, while preserving stock locking and trusted price calculation. `set_order_status()` must reject a cross-store order ID (returns "Order not found").
`get_order_status()` must require the store slug and must not return another store's order.

## Storefront and delivery verification

Run these after applying `0010` through `0012` to a disposable project. Runtime verification requires an actual Supabase/Postgres instance; if none is available, review the SQL statically and treat this as the procedure to run.

Schema and RLS:

```sql
-- delivery_zones exists with RLS enabled.
select to_regclass('public.delivery_zones') as delivery_zones_table;
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('delivery_zones', 'stores', 'products');

-- Product slugs are unique per store, not globally.
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.products'::regclass and contype = 'u';

-- orders carries the delivery snapshot columns.
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'orders'
  and column_name in ('delivery_zone_id', 'delivery_city', 'delivery_zone_name',
                      'delivery_provider', 'delivery_estimate');

-- create_store_order now takes a delivery zone id.
select proname, pg_get_function_arguments(oid)
from pg_proc where proname in ('create_store_order', 'get_order_status');
```

Behavioral checks (impersonate `anon` unless noted):

- Two active stores can each own a product with the same slug; one store cannot duplicate its own slug.
- Anon can read active products and active delivery zones for Store A and Store B, cannot read drafts, and cannot read anything for a suspended store.
- A merchant can manage only their own store's delivery zones; anon can read only active zones.
- Receipt upload rejects an unknown or suspended store namespace.
- `create_store_order()` fails for an unknown store, a suspended store, a cross-store delivery zone id, an inactive zone, a missing zone, a cross-store product id, a manipulated product total, and a manipulated delivery total.
- A successful order's `delivery_city`, `delivery_zone_name`, `delivery_provider`, `delivery_estimate`, and `shipping_fee` match the selected zone.
- Changing a zone's fee afterwards does not change an existing order.
- Stock locking still rejects an order that exceeds inventory; cancelling an order restores stock exactly once.
- `get_order_status()` returns nothing when the store slug is wrong, and requires code + phone + store slug.

## B2V runtime verification record

These results were produced on a **disposable local PostgreSQL 18.4 cluster**, created with
`initdb` on a private port with trust auth and a minimal set of Supabase-compatible shims
(`anon`/`authenticated`/`service_role` roles, `auth.users` + `auth.uid()`, `storage.objects` +
`storage.allow_only_operation()`, and `pgcrypto` in the `extensions` schema). It is **not a real
Supabase stack**: GoTrue, PostgREST, and the Storage HTTP API are absent, so only the SQL, RLS, and
RPC layers are exercised. Nothing was run against the configured shared project, which is left
untouched.

### Tests actually run (all passed)

- **Fresh migration chain** — `0001` through `0012` applied in filename order to an empty database
  with no errors. This is the first time `0007`–`0012` were executed in a real PostgreSQL engine.
- **Product slug constraints** — a duplicate `shared-product` slug inside one store is rejected;
  the same slug in two different stores is accepted.
- **Public product reads (anon)** — active products for both stores are readable; drafts are not;
  a suspended store's products and zones are hidden; the store is reactivated afterwards.
- **Merchant product isolation** — each merchant reads its own products (including drafts), cannot
  read the other store's drafts, cannot update or delete the other store's products, and cannot
  insert a product carrying the other store's `store_id`.
- **Delivery zone rules** — a duplicate zone name in the same store and city is rejected (including
  a case/whitespace variant), and the same name is accepted across cities and across stores.
- **Delivery zone RLS** — anon reads only active zones; a merchant can create/update/delete its own
  zones but cannot read, update, delete, or insert into the other store's zones.
- **Receipt policies** — anon uploads succeed only under an active store namespace; unknown and
  suspended namespaces are rejected; anon cannot list or download receipts (except the narrow
  upload-completion metadata path); each merchant reads only its own store's receipts.
- **Product-image policies** — a merchant uploads only into its own `products/<store-id>/` folder,
  cannot upload into or delete the other store's folder, and cannot read the other store's images.
- **Store A checkout** — order created with `store_id` = Store A, inventory decremented, `subtotal`
  from database prices, `shipping_fee` from the zone fee, `total = subtotal + shipping_fee`, and
  `delivery_zone_id`/`delivery_city`/`delivery_zone_name`/`delivery_provider`/`delivery_estimate`
  matching the selected zone.
- **Trusted pricing** — a manipulated product total and a manipulated delivery total are rejected;
  the RPC exposes no client-supplied delivery-metadata parameters.
- **Cross-store / invalid checkout** — rejected for a cross-store product, a cross-store zone id, a
  cross-store receipt namespace, an unknown store, a suspended store, a missing zone, and an
  inactive zone.
- **Stock protection** — an order above available stock is rejected. Two simultaneous sessions each
  ordering 4 units against 5 in stock: exactly one succeeded and the other failed with
  "Insufficient inventory", leaving stock at 1.
- **Receipt idempotency** — the same receipt and phone return the existing tracking code without a
  second inventory decrement; the same receipt with a different phone is rejected.
- **Order status** — Merchant A completes `Pending Verification → Processing → Shipped → Fulfilled`;
  an invalid transition from a terminal state is rejected; Merchant B cannot change Store A's order;
  cancellation restores stock exactly once and repeating it does not double-restock.
- **Store-scoped tracking** — `get_order_status()` returns the order only for the correct store slug
  and phone; another store slug or a wrong phone returns nothing.
- **Historical HTTP routing at the time of B2V (dev server, dummy Supabase env)** — `/`, `/shop`, `/cart`, `/checkout`, `/track`,
  `/product/<slug>`, `/oils` all redirect to `/s/default-store/...` and preserve query strings
  (e.g. `/track?order=ORD-123`, `/oils?x=1`); `/s/store-a` returns 404 with a "Store unavailable"
  page and does not leak `default-store` content.

After B5, `/` is the platform homepage; the compatibility redirect list no longer includes `/`.

### Tests expected but not run

- **Application-level Supabase behavior** — storefront rendering, admin flows, and checkout against
  real data require GoTrue/PostgREST/Storage, which the disposable cluster does not provide. The
  store-scoped application smoke tests in `/s/<store>/...` were therefore not run against live data.
- **Storage HTTP semantics** — signed URLs, bucket visibility, and upload size/MIME enforcement are
  platform behaviors, not covered by the SQL-level policy checks.
- **Public product-image URL serving** — served by the public bucket outside RLS; asserted only that
  the RLS layer exposes no anon select for it.

To re-run: create a `initdb` cluster on a spare port with the shims above, apply migrations
`0001`–`0012` in order, seed two stores with products, delivery zones, and receipts, then run the
behavioral checks listed under "Storefront and delivery verification". All of the above passed on
the disposable cluster; none of it has been run against the configured shared project.

## B3 migration verification record

B3 migrations `0013` and `0014` were applied on a separate disposable local PostgreSQL 18 cluster
with the same limited Supabase-compatible SQL shims described above. A product and customized
settings row were inserted after `0012` and before `0013`, verifying that existing merchant data
survives the new columns. The configured shared Supabase project was not accessed or modified.

### Checks actually run

- Applied the clean migration sequence `0001`–`0012`, seeded pre-B3 product/settings rows, then
  applied `0013` and `0014` successfully.
- Confirmed the existing product receives `compare_at_price = null` and `gallery_images = {}`;
  existing store name/tagline remain intact, and new branding fields use valid defaults.
- Confirmed a compare-at value equal to current price, five gallery URLs, and a non-hex primary
  color are rejected. Confirmed a valid six-digit hex color is accepted.
- Ran the new store-asset policies as `authenticated`: own-namespace uploads work, another store's
  object metadata is hidden, cross-store uploads are rejected, and another store's object cannot
  be deleted. Inspected policy predicates to confirm product-image policies remain tenant-scoped.
- Ran in-memory catalog checks for name/category/description search, casing and whitespace,
  category filtering, in-stock filtering, newest and both price sorts, zero results, featured
  priority, newest fallback, and the four-product home limit.
- `pnpm check` completed with zero errors. `pnpm build` completed successfully.

### Not performed

- Product/admin workflows against Supabase data, file upload or cleanup over the Storage HTTP API,
  storefront interactive browser checks, and public image serving were not exercised. The local
  surrogate has no GoTrue, PostgREST, or Storage HTTP API. These checks remain launch verification;
  no live Supabase project was used.

## B4 migration and attribution verification record

B4 migrations `0001` through `0015` were applied in order to a fresh disposable local PostgreSQL 18 cluster on a private local port. The only Supabase compatibility shims were local SQL roles and minimal `auth.uid()`, `auth.users`, `storage.objects`, and `storage.allow_only_operation()` definitions. No shared or production Supabase project was contacted.

### Checks actually run

- Fresh migration chain `0001`–`0015` completed successfully.
- On a second fresh disposable database, seeded a valid historical order after `0014`, applied `0015`, and confirmed it remained present with `{}` attribution and JSON object type.
- Inserted orders with empty attribution, analytics consent, and marketing-only consent. Confirmed the attribution constraint/default is an object; analytics fields/IDs are omitted without Analytics consent; Meta IDs are omitted without Marketing consent; unknown keys are ignored.
- Confirmed query strings and hashes are removed from landing URLs/referrers, UTM fields are limited to 200 characters, Meta identifiers to 500 characters, and overlong values are truncated.
- Retried an existing receipt with different attribution and confirmed the same order code is returned, its original attribution is unchanged, and stock is not decremented twice.
- Valid trusted-price/zone orders created successfully and reserved inventory. Manipulated totals rolled back without inventory loss; cross-store products, mismatched-store receipts, and inactive delivery zones were rejected.
- Temporary Node assertions covered verified revenue statuses, pending counts, draft exclusion, the active inventory 0–5 boundary, five-row queue limits, every allowed/terminal status transition, invalid query-status fallback, consent version/persistence shape, consent-gated attribution capture, URL stripping, and store-scoped random ID behavior.
- `pnpm check` and `pnpm build` passed with the Umami configuration absent. Existing unrelated React `FormEvent` deprecation hints remain.

### Not performed; required for T09

- GoTrue login/session, PostgREST queries/RPCs, actual Storage HTTP upload/read behavior, receipt MIME/size enforcement, product image and logo/hero upload, private signed receipt reads, and public image delivery.
- Full customer checkout in a real Supabase project, merchant payment verification, stock changes through the real app, and order tracking.
- A real Umami script load after Analytics consent, real event receipt, network inspection proving no request before consent, browser preference-change checks, and a real order with stored attribution.

T09 must complete those real-integration checks before launch. The SQL-shim results above are not a substitute.

## Consent-aware measurement configuration

Optional build-time values may be added to `.env`:

```env
PUBLIC_UMAMI_SCRIPT_URL=https://analytics.example.com/script.js
PUBLIC_UMAMI_WEBSITE_ID=your-umami-website-id
PUBLIC_UMAMI_HOST_URL=https://analytics.example.com
```

`PUBLIC_UMAMI_HOST_URL` is optional; the other two values are also optional for the build. When missing, the event adapter is a no-op. Necessary is always enabled; Analytics and Marketing default off and are saved in a versioned localStorage preference without customer identity. walkerOS supplies the storefront event model; the local Umami adapter uses manually named events with automatic tracker behavior disabled. No Meta destination is loaded.

The event taxonomy is page view, product view, search submit, product add, cart view, checkout start, and order submit. Event data always identifies `store_id` and `store_slug`, and otherwise contains only event-specific safe fields. No customer PII, delivery details, receipt path, bank details, or tracking code may be sent. `orders.attribution` (migration `0015`) stores only the allowlisted fields described above after a second server-side whitelist/length/consent check. Landing and referrer query/hash components are removed. The same receipt retry never changes existing attribution.

For each storefront, footer **Privacy choices** reopens Necessary/Analytics/Marketing controls. Analytics must be explicitly accepted before loading the external script; rejecting both optional categories must leave browsing and checkout functional.

## Platform build configuration

The public build-time values `PUBLIC_SITE_URL`, `PUBLIC_OPERATOR_NAME`, `PUBLIC_SUPPORT_EMAIL`, and `PUBLIC_SUPPORT_WHATSAPP` configure the platform homepage and support/privacy contact. These values are optional for local builds. `pnpm launch:check` checks them before launch. Supabase URL/anon key and Umami settings remain public values; never add service-role keys, database passwords, or access tokens to application build variables. Umami settings are optional and analytics is a no-op when absent.

See [LAUNCH_RUNBOOK.md](LAUNCH_RUNBOOK.md) for controlled deployment and rollback, and [MERCHANT_ONBOARDING.md](MERCHANT_ONBOARDING.md) for a transaction-based assisted provisioning template. Terms copy is a starting point requiring owner/legal review before commercial launch.

## B5 status record

Repository-only launch preparation added the public platform homepage, privacy and terms pages, storefront attribution link, consent dialog, response security headers, Cloudflare built-in Worker observability, launch configuration/smoke scripts, and launch/onboarding documentation. The current environment has not been used to apply remote migrations, create merchants, alter Storage buckets, deploy a Worker, or run real Umami checks. The prior B4 SQL-shim record is not a substitute. T09 remains In Progress; T10 remains Next. Cohort preparation is documented, but first-merchant provisioning and the T09 real-integration gates remain outstanding. Owner authorization and access to isolated Supabase, Umami test property, and Cloudflare staging are needed to run those external gates.
