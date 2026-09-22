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

Copy `.env.example` to `.env` and set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to your Supabase project values. These are public (non-secret) values that Astro inlines into the build at build time.

## Deploy

1. Authenticate Wrangler once: `pnpm wrangler login`
2. Build and deploy to Cloudflare Workers: `pnpm deploy`

`pnpm deploy` runs `astro build` then `wrangler deploy`, uploading the prebuilt Worker. The two `PUBLIC_*` variables must be present in `.env` when you build. No Supabase service-role key or other secrets are required.

## Storefront URLs

Each merchant storefront is reachable at `/s/<store-slug>` (for example `/s/default-store`), with `/s/<store-slug>/shop`, `/s/<store-slug>/product/<slug>`, `/s/<store-slug>/cart`, `/s/<store-slug>/checkout`, and `/s/<store-slug>/track`. Legacy customer URLs (`/`, `/shop`, `/cart`, `/checkout`, `/track`, `/product/<slug>`, `/oils`) redirect to the matching `default-store` route and preserve query parameters.

## Database Setup

InstaStore uses Supabase for its database, admin authentication, and storage. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the fresh-install steps, including the required Storage buckets and admin account provisioning.
