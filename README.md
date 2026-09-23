# InstaStore

A storefront and order-management product for Instagram-first merchants.

## Stack

- [Astro](https://astro.build) — server-rendered `.astro` pages with React islands
- React — interactive islands hydrated client-side
- TypeScript — strict mode
- Tailwind CSS — design tokens defined in `src/styles/global.css`
- Supabase — database, admin authentication, and storage
- Cloudflare Workers — hosting and compute via `@astrojs/cloudflare`
- pnpm — package manager

## Run Locally

**Prerequisites:** Node.js 22+ and pnpm.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Start the dev server:

   ```sh
   pnpm dev
   ```

3. Type-check the project:

   ```sh
   pnpm check
   ```

4. Build for production:

   ```sh
   pnpm build
   ```

5. Preview the production build:

   ```sh
   pnpm preview
   ```

## Configuration

Copy `.env.example` to `.env`. `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are public, non-secret values required for storefront data; Astro inlines them into the build. `PUBLIC_SITE_URL`, `PUBLIC_OPERATOR_NAME`, `PUBLIC_SUPPORT_EMAIL`, and `PUBLIC_SUPPORT_WHATSAPP` configure the platform homepage, canonical URLs, and assisted onboarding contact. Production launch configuration can be checked with `pnpm launch:check`; missing optional launch values do not block the build. Optional analytics uses `PUBLIC_UMAMI_SCRIPT_URL` and `PUBLIC_UMAMI_WEBSITE_ID`; `PUBLIC_UMAMI_HOST_URL` is optional when the script and collection host differ. Without Umami configuration, analytics safely does nothing.

## Deploy

1. Authenticate Wrangler once: `pnpm wrangler login`
2. Build and deploy to Cloudflare Workers: `pnpm deploy`

`pnpm deploy` runs `astro build` then `wrangler deploy`, uploading the prebuilt Worker. The two `PUBLIC_*` variables must be present in `.env` when you build. No Supabase service-role key or other secrets are required.

## Storefront URLs

The platform homepage is `/`. Each merchant storefront is reachable at `/s/<store-slug>` (for example `/s/default-store`), with `/s/<store-slug>/shop`, `/s/<store-slug>/product/<slug>`, `/s/<store-slug>/cart`, `/s/<store-slug>/checkout`, and `/s/<store-slug>/track`. The legacy customer URLs `/shop`, `/cart`, `/checkout`, `/track`, `/product/<slug>`, and `/oils` redirect to the matching `default-store` route and preserve query parameters. Public platform information is available at `/privacy` and `/terms`.

## Merchant operations and measurement

The dashboard reports **Verified Revenue** from orders in `Processing`, `Shipped`, or `Fulfilled`; submissions awaiting payment verification and cancelled orders are excluded. It also counts the pending-verification queue, active products, and active low-stock products (inventory `<= 5`, including zero stock). Its short attention lists link to the existing order and product workflows.

Storefront consent has Necessary (always on), Analytics (optional), and Marketing (optional) categories. Optional categories default off and are stored as a versioned local browser preference. walkerOS (`@walkeros/collector` and `@walkeros/web-source-browser`) supplies the entity/action event model; Umami is the optional reporting destination and is loaded only after Analytics consent. Events contain store identity and minimal behavioral fields, never customer or receipt data. Anonymous order attribution is sanitized again by `create_store_order()` and stored on `orders.attribution` by migration `0015_measurement_foundation.sql`. No Meta tracking destination is included.

T09 is the required real-integration launch gate: it must test Supabase Auth, PostgREST RPCs, actual Storage HTTP uploads and reads, end-to-end checkout and merchant verification, tracking, plus real Umami loading/receipt only after consent and attribution on a real order. The disposable SQL checks do not replace these platform tests.

First merchants are provisioned with operator assistance. See [docs/MERCHANT_ONBOARDING.md](docs/MERCHANT_ONBOARDING.md) and [docs/LAUNCH_RUNBOOK.md](docs/LAUNCH_RUNBOOK.md). The Terms copy requires owner/legal review before commercial launch. T10 remains open until a real merchant accepts a complete customer-to-tracking flow.

Store catalogs include browser-side search across product names, categories, and descriptions, with category and in-stock filters plus newest/price sorting. Products support a presentation-only compare-at price and up to four additional gallery images. Merchants can customize their storefront description, logo, hero image, and primary brand color in Store Settings.

## Database Setup

InstaStore uses Supabase for its database, admin authentication, and storage. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the fresh-install steps, including the required Storage buckets and admin account provisioning.
