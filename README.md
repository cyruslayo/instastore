# InstaStore

A storefront and order-management product for Instagram-first merchants.

## Stack

- [Astro](https://astro.build) — server-rendered `.astro` pages with React islands
- React — interactive islands hydrated client-side
- TypeScript — strict mode
- Tailwind CSS — design tokens defined in `src/styles/global.css`
- Supabase — database, admin authentication, and storage
- Netlify — serverless deployment via `@astrojs/netlify`
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

Copy `.env.example` to `.env` and set `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` to your Supabase project values.

## Database Setup

InstaStore uses Supabase for its database, admin authentication, and storage. See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the fresh-install steps, including the required Storage buckets and admin account provisioning.
