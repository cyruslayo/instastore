# Assisted Merchant Onboarding

The first cohort is intentionally small (target 1–3 merchants) and provisioned with operator assistance. There is no self-service signup, organization/team model, merchant switcher, CRM, or automated onboarding. Do not write passwords, access tokens, or bank details into this document, source control, or chat.

## Intake checklist

Collect directly from the merchant and confirm spelling before setup:

- [ ] Store name
- [ ] Desired store slug (lowercase letters/numbers separated by single hyphens)
- [ ] Merchant email for the Auth account
- [ ] Store tagline and description
- [ ] Logo file; optional hero image
- [ ] Primary brand color (six-digit hex, e.g. `#18231a`)
- [ ] Instagram handle
- [ ] WhatsApp number in an international format usable for contact links
- [ ] Bank name, account name, and account number, supplied and explicitly confirmed by the merchant
- [ ] Delivery city and zone names (Abuja/Lagos only), provider for each zone, delivery fee, estimate, and optional note
- [ ] Initial product catalog: name, slug, description, price, optional compare-at price, initial inventory, category, SKU, primary image, up to four gallery images, featured and active flags

Share bank details only through an operator-approved private channel and enter them directly into the authorized environment. The operator must not decide that the financial details are correct; the merchant verifies them during acceptance.

## Provisioning sequence

1. Confirm the target Supabase project is the approved environment, with the correct migration chain, RLS and Storage buckets. Do not provision into the old shared project by default.
2. Create the store row.
3. Create its `store_settings` row keyed by the store UUID.
4. Create/confirm the merchant Auth user in Supabase Auth. Use the Auth invitation/password-reset workflow as appropriate; do not store a password.
5. Create the profile mapping from that Auth UUID to the store with `role = 'admin'`.
6. Add the confirmed delivery zones and fees.
7. Ask the merchant to sign in and verify settings; correct any errors with their confirmation.
8. Merchant/operator enters products and uploads product images, logo and optional hero through the admin application.
9. Verify the active public store, assets, catalog, prices, inventory and delivery options from a signed-out browser.
10. Run a merchant acceptance order from store link through checkout, receipt review, payment-status workflow, shipment and tracking. Use staging test details and receipts in staging. Do not initiate a real production transfer as an automated acceptance step.

## SQL provisioning template

Create the Auth user first using Supabase Auth tooling and substitute the resulting UUID. Replace every placeholder, quote string values safely, and review the target project before execution. Run the database changes in one transaction. Never include a password in SQL or repository files.

```sql
begin;

insert into public.stores (slug, name, status)
values ('STORE_SLUG', 'STORE_NAME', 'active');

insert into public.store_settings (store_id, store_name, currency, delivery_fee)
select id, 'STORE_NAME', 'NGN', 0
from public.stores
where slug = 'STORE_SLUG';

insert into public.profiles (id, email, role, store_id)
select 'AUTH_USER_UUID'::uuid, 'MERCHANT_EMAIL', 'admin', id
from public.stores
where slug = 'STORE_SLUG';

commit;
```

Configure zones through `/admin/delivery` after merchant login, or insert confirmed values inside the same provisioning transaction using a statement like this (replace placeholders and city with `Abuja` or `Lagos`):

```sql
insert into public.delivery_zones
  (store_id, city, name, provider, fee, estimate, note, is_active)
select id, 'Abuja', 'ZONE_NAME', 'DELIVERY_PROVIDER', 0, 'DELIVERY_ESTIMATE', null, true
from public.stores
where slug = 'STORE_SLUG';
```

The zero in this example is a placeholder, not a suggested price. Never activate a placeholder fee. Enter the merchant-confirmed amount before making the storefront available for orders.

## Provisioning validation

Run after provisioning, substituting the slug and UUID:

```sql
select count(*) = 1 as exactly_one_store
from public.stores where slug = 'STORE_SLUG';

select st.slug, st.status, ss.store_name, p.email, p.role, p.store_id
from public.stores st
join public.store_settings ss on ss.store_id = st.id
join public.profiles p on p.store_id = st.id
where st.slug = 'STORE_SLUG' and p.id = 'AUTH_USER_UUID'::uuid;

select city, name, provider, fee, estimate, is_active
from public.delivery_zones
where store_id = (select id from public.stores where slug = 'STORE_SLUG')
order by city, sort_order, name;
```

Confirm one settings row is present, the store is active, the profile UUID/email/role/store mapping are correct, and zones have merchant-confirmed values. Then verify real merchant login, own-store isolation (no access to another store), and the public URL `/s/STORE_SLUG`.

## Merchant acceptance

The merchant reviews and confirms store name, logo, hero, colors, description, Instagram/WhatsApp, bank name/account name/account number, delivery areas/fees/providers/estimates, products, prices, inventory, and sale pricing. Record their confirmation outside this template without unnecessarily retaining sensitive financial information.

Complete the full flow: Instagram/direct link → store home → shop/search → product → cart → checkout → bank-transfer instructions → receipt upload → order creation → merchant receipt review → payment verification → shipment → customer tracking. Provide the launch URL to the merchant. T10 remains open until at least one real merchant has confirmed configuration and completed this acceptance flow.
