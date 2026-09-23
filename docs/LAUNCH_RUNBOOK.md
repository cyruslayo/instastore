# Controlled Launch Runbook

This is a one-developer checklist for an authorized launch. Do not use the old shared Supabase project as a migration target; its migration state is known to be behind. Use a fresh isolated launch-candidate project for T09, then a clearly identified and explicitly authorized production project for launch. Never create paid resources without approval. No service-role key belongs in the application build or Cloudflare public variables.

## Before deploy

1. Confirm the target branch and main commit with `git status --short --branch` and `git rev-parse HEAD`. Confirm the target Supabase project and Cloudflare environment with the operator; do not infer project IDs.
2. Install the locked dependencies: `pnpm install --frozen-lockfile`.
3. Run `pnpm check` and `pnpm build`.
4. Set and review public build values in the local or deployment build environment: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SITE_URL`, `PUBLIC_OPERATOR_NAME`, `PUBLIC_SUPPORT_EMAIL`, `PUBLIC_SUPPORT_WHATSAPP`. Add Umami URL and website ID only if analytics is enabled for this launch. Run `pnpm launch:check`. Do not print values or commit `.env`.
5. Verify the intended isolated/production Supabase project identity in the dashboard and CLI link before any remote command. Check `supabase migration list --linked`; inspect the expected state and target. Run `supabase db push --dry-run`, inspect the pending 0001–0016 migrations, then run `supabase db push` only with explicit authorization for that exact project. Verify history again with `supabase migration list --linked` and run the queries in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
6. In Supabase Storage, verify `receipts` is private, 5 MiB maximum, JPEG/PNG/PDF only; verify `product-images` is public, 5 MiB maximum, JPEG/PNG/WebP only. Confirm public reads do not grant writes/deletes.
7. Confirm the authorized test merchant can sign in and out, access only its own store, and use a known test storefront. Verify a test checkout and merchant receipt review in staging. Production merchant financial details must be confirmed by the merchant.

## Deploy and verify

8. Deploy with the existing controlled Cloudflare Worker flow: `pnpm deploy`. This builds and invokes Wrangler. Confirm the environment is the intended Worker and that observability is enabled in `wrangler.jsonc`.
9. Run `BASE_URL=https://<authorized-worker-host> STORE_SLUG=<known-active-store> pnpm smoke:live` (PowerShell: `$env:BASE_URL='https://<authorized-worker-host>'; $env:STORE_SLUG='<known-active-store>'; pnpm smoke:live`). Verify `/`, storefront home/shop, `/admin`, unknown store 404, and legacy redirect.
10. In the deployed environment, manually verify catalog, product detail, cart, checkout, tracking, admin login, product/orders/delivery/settings screens, privacy, and terms. Complete a controlled real post-deploy checkout with a test receipt and confirm the merchant review, inventory reservation, status update, and tracking. Never initiate a real transfer as an automated test.
11. Inspect Worker logs/observability and Supabase Auth, API, database and Storage logs for the verification window. Check that analytics network requests are absent before consent and after rejection, and present only after Analytics consent if Umami is part of launch. Analytics outages must not block commerce.
12. Record the deployed commit SHA, target environment, smoke result, test-order cleanup, and any unresolved launch gates in the release record. Create a launch tag only after the owner accepts the real production launch.

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

The repository record through B4 shows migrations 0001–0015 exercised on disposable PostgreSQL with limited Supabase-compatible SQL shims. It explicitly records that this is not a real Supabase platform and does not verify GoTrue, PostgREST, Storage HTTP, real checkout, real Umami, or Cloudflare runtime. T09 is therefore In Progress until those gates are performed and recorded against an authorized isolated environment.
