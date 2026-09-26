# Controlled Launch Runbook

This is a one-developer checklist for an authorized launch. The current T09 staging/launch-candidate environment deliberately reuses an existing Supabase project because the Free organization could not create a third active project. That project is authorized for T09 verification; its migration history was established incrementally through launch hardening, and its remote migration version IDs differ from local migration filenames. A future fresh production Supabase project is a separate target and requires explicit planning and authorization before migration setup or application. Never create paid resources without approval. No service-role key belongs in the application build or Cloudflare public variables.

## Before deploy

1. Confirm the target branch and main commit with `git status --short --branch` and `git rev-parse HEAD`. Confirm the target Supabase project and Cloudflare environment with the operator; do not infer project IDs.
2. Install the locked dependencies: `pnpm install --frozen-lockfile`.
3. Run `pnpm check` and `pnpm build`.
4. Set and review public build values in the local or deployment build environment: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`, `PUBLIC_OPERATOR_NAME`, `PUBLIC_SUPPORT_EMAIL`, `PUBLIC_SUPPORT_WHATSAPP`. Add Umami URL and website ID only if analytics is enabled for this launch. Run `pnpm launch:check`. Do not print values or commit `.env`.
5. **Current reused T09 project:** verify project identity in the dashboard and CLI link before any operation. Its migration history has already been established incrementally; remote migration version IDs differ from local migration filenames. Do not blindly run `supabase db push`, do not run `supabase db reset --linked`, and do not use migration repair merely to normalize history. Use read-only verification and Supabase advisors for pre-deploy review. Any new schema change must be introduced as a new forward migration and deliberately reviewed/applied to the verified target.
   **Future fresh production project:** migration setup must be planned and explicitly authorized for that exact project. Before applying anything, inspect the target identity and exact pending migrations with the operator. Do not assume the current T09 staging history should be copied or repaired automatically. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) only after the migration plan and target are approved.
6. In Supabase Storage, verify `receipts` is private, 5 MiB maximum, JPEG/PNG/PDF only; verify `product-images` is public, 5 MiB maximum, JPEG/PNG/WebP only. Confirm public reads do not grant writes/deletes.
7. Confirm the authorized test merchant can sign in and out, access only its own store, and use a known test storefront. Verify a test checkout and merchant receipt review in staging. Production merchant financial details must be confirmed by the merchant.

## Deploy and verify

8. Deploy with the existing controlled Cloudflare Worker flow: `pnpm deploy`. This builds and invokes Wrangler. Confirm the environment is the intended Worker and that observability is enabled in `wrangler.jsonc`.
9. Run `BASE_URL=https://<authorized-worker-host> STORE_SLUG=<known-active-store> pnpm smoke:live` (PowerShell: `$env:BASE_URL='https://<authorized-worker-host>'; $env:STORE_SLUG='<known-active-store>'; pnpm smoke:live`). Verify `/`, storefront home/shop, `/admin`, unknown store 404, and legacy redirect.
10. In the deployed environment, manually verify catalog, product detail, cart, checkout, tracking, admin login, product/orders/delivery/settings screens, privacy, and terms. Complete a controlled real post-deploy checkout with a test receipt and confirm the merchant review, inventory reservation, status update, and tracking. Never initiate a real transfer as an automated test.
11. Inspect Worker logs/observability and Supabase Auth, API, database and Storage logs for the verification window. Check that analytics network requests are absent before consent and after rejection, and present only after Analytics consent if Umami is part of launch. Analytics outages must not block commerce.
12. Record the deployed commit SHA, target environment, smoke result, test-order cleanup, and any unresolved launch gates in the release record. Create a launch tag only after the owner accepts the real production launch.

## Migration 0017 verification (payment fact and consent metadata)

Apply `0017_payment_verification_fact.sql` to the verified target as a reviewed forward migration only (no `db push` of the whole chain, `db reset`, or `migration repair`). Then verify on the real project with a controlled test order:

- New checkout succeeds; `orders.attribution` contains `consent_version = '2'`, `consent_received_at`, and `consent_store_id` equal to the order's `store_id` when a choice was made. A forged `consent_store_id` is dropped.
- First `Pending Verification → Processing`: `payment_verified_at` and `payment_event_id` are set once. Repeating the call, or two simultaneous calls, leaves both unchanged.
- Cancel before verification: both remain null; inventory restores once.
- Verify then cancel: both are kept; no second fact is created.
- Pre-existing orders keep null payment fields (no backfill).
- Merchant A cannot read merchant B's orders; anon cannot read orders or execute `set_order_status`; a forged client total is still rejected.
- `get_order_status` responses do not include payment or attribution fields; tracking still works.
- Consent: choosing on store A does not apply on store B; with Marketing only, no Umami request occurs; with Umami blocked, checkout still completes.

## Rollback and database issues

- For an application regression, identify the last known-good commit, check out/build that commit, and redeploy it through the normal Worker process. Record the commit used.
- Database failures are fix-forward. Stop rollout, assess exactly which migrations ran, preserve data, and add a corrective forward migration with a compatible application change. Do not casually reverse applied production migrations. Before future risky production migrations, use the Supabase backup mechanisms available for the specific project/account; verify backup status rather than assuming it.

## Basic incident response

- **Storefront unavailable:** check Worker status/logs, deploy health and Supabase public API/database logs; verify the store remains active. Communicate via configured support.
- **Checkout fails:** pause promotion of the flow, inspect browser errors and Supabase RPC/Storage logs, verify active delivery zones and bucket policy; do not ask customers to retry a transfer without checking whether an order exists.
- **Supabase unavailable:** preserve the current deployment, monitor Supabase status/logs, and avoid manual order or inventory edits until the source of truth is available.
- **Storage upload fails:** check bucket limits, allowed MIME types, policy and Storage logs; preserve the private receipts bucket.
- **Merchant cannot sign in:** confirm the merchant Auth user is enabled/confirmed and its profile points at the correct active store. Never request or record the merchant password.
- **Incorrect order state reported:** verify order and status history with the owning merchant, inspect the allowed transition and inventory restock flag, and make a careful corrective action without double-restocking.
- **Umami unavailable:** leave analytics disabled/no-op and continue commerce. Do not disable checkout or storefront functionality to restore analytics.

## Current verification record

Real T09 staging verification has covered Supabase Auth; PostgREST/RLS tenant isolation; Storage HTTP and tenant isolation; product CRUD; delivery-zone CRUD; storefront tenancy; receipt privacy; full checkout; receipt/order linkage; inventory reservation/restoration; order idempotency; merchant status workflow; customer tracking; adversarial price/product/zone/receipt/status tests; and consent and attribution gating, including analytics-disabled behavior. Cloudflare deployed-runtime verification has not yet been completed. T09 remains In Progress; this record does not mark launch complete or T10 started.

## Migration 0017 T09 application record — 2026-09-26

- Target: T09 reused InstaStore Supabase project `instastore` (`qlhmirqekwxcrdvilmzb`). The connected project identity and existing remote migration list were checked before execution. The dashboard SQL Editor required a separate sign-in, so this application used the project-scoped Supabase SQL connection.
- Applied `supabase/migrations/0017_payment_verification_fact.sql` from repository commit `bb2c38e241489589a393371e77740a7f9028014e` once, with explicit `BEGIN` and `COMMIT`. This was a manual SQL application. It is **not recorded in remote migration history**. The remote list still ends at `launch_security_hardening` (0016); do not infer 0017 is pending from that list or rerun it.
- Post-application inspection confirmed both payment columns, the paired-fact and unique-event constraints, and both updated RPC bodies. Existing default-store orders retained null payment facts.
- Rollback-only checks on the real T09 database passed: first verification and repeat retain one fact; cancel before verification keeps null facts; cancel after verification retains the fact; stock restores once; the checkout RPC accepts a valid total and consent metadata, drops a forged consent store ID, and rejects a forged total; merchant A cannot read or update a test order in a temporary second store; anon cannot read orders or execute `set_order_status`; tracking returns status without attribution or payment fields. Temporary rows and stock changes were rolled back.
- Local source checks: `pnpm check` passed with 0 errors; the consent, attribution, and routing test run passed (42 tests); `pnpm build` passed with a temporary, workspace-only network-interface shim. No application code or lockfile was changed.
- Still required before the 0017 checklist is closed: simultaneous status calls on a committed test order and live `pnpm dev` checkout/consent checks against T09. The dev process was started with the same temporary shim, but the cloud browser blocked its local URL. This workspace could not reach the T09 API directly. No checkout order was created through the dev application; no test order or receipt from these SQL checks was left behind. Do not mark these browser checks complete from SQL or unit checks.
