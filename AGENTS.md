# Memory

## Project Overview
InstaStore — a storefront and order-management product for Instagram-first merchants.

- Built with Astro 7 (`.astro` pages + React 19 islands hydrated via `client:load`), TypeScript (strict).
- Server-rendered (`output: 'server'`) with the `@astrojs/cloudflare` adapter (Cloudflare Workers); some pages are static shells (`prerender = true`) and others render on request (`prerender = false`).
- Styled with Tailwind CSS 4 using `@theme` tokens in `src/styles/global.css` (no `tailwind.config`).
- Backed by Supabase: DB, Auth, and Storage initialized in `src/lib/supabase.ts`.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`).
- pnpm is the package manager (see `packageManager` in `package.json`).
- MVP scope is documented in `docs/MVP_SCOPE.md`; Supabase setup is documented in `docs/SUPABASE_SETUP.md`.

## Code Style Guidelines
- Keep TypeScript strict; use descriptive variable names; extract complex conditions into named booleans.
- Mark interactive/browser-dependent React components with `'use client'`; Astro pages are server-rendered by default.
- Prefer `@/` imports over relative imports.
- Use `cn()` from `src/lib/utils.ts` to merge Tailwind classes.
- Use the design tokens (font-*, text-*, spacing-*, color-*) instead of arbitrary values.
- Existing Supabase rows are typed in `src/lib/types.ts`; introduce typed interfaces for new logic.
- Mobile-first: base styles target small screens; use `md:`/`lg:` (min-width) variants to layer desktop styles.
- Use `dvh` (not `vh`) for mobile containers; use `aspect-ratio` over fixed heights; use `clamp()` for fluid type/spacing.

## Architecture Notes
- Routes live under `src/pages/`. Storefront pages use `src/layouts/Layout.astro` (Header, skip link, MotionProvider, BottomNav, StorefrontFooter); admin pages use `src/layouts/AdminLayout.astro` (sidebar + AdminBottomNav on mobile).
- Storefront pages fetch Supabase and fall back to empty/placeholder data when the DB is empty or unavailable.
- Cart state is client-only in a `nanostores` store (`src/store/cart.ts`), read via `useStore()` from `@nanostores/react`.
- Checkout is a single page (`/checkout`) that collects delivery details, shows bank-transfer instructions, uploads the payment receipt, then creates an `orders` row with status `Pending Verification`.
- Admin pages are static shells (`prerender = true`) that hydrate client components gated by `AdminGate` (auth check via `src/lib/auth.ts`).
- Animations use the `motion` package via `src/components/FadeIn.tsx` (`FadeIn`, `StaggerContainer`, `StaggerItem`), wrapped in `MotionProvider` (`reducedMotion="user"`); `global.css` also defines scroll-driven `reveal`/`load-in` utilities.
- External images: use plain `<img>` with `referrerpolicy="no-referrer"`; host allowlisting is not needed (no Next Image).
- Mobile bottom navs: `src/components/BottomNav.tsx` (storefront) and `src/components/admin/AdminBottomNav.tsx` (admin), both fixed with `pb-safe` (safe-area-inset).

## Storefront Routes
- `/` — storefront home: store branding plus a subset of active products.
- `/shop` — full active product catalog.
- `/oils` — legacy redirect to `/shop`.
- `/product/[slug]` — product detail (redirects to `/shop` when not found).
- `/cart` — client-side cart.
- `/checkout` — guest checkout: delivery details + bank transfer + receipt upload.
- `/track` — order status lookup by tracking code + phone.

## Admin Routes
- `/admin` — dashboard with live metrics (order value, total orders, active products, recent orders).
- `/admin/products` — product CRUD (name, slug, description, price, inventory, category, image, SKU, featured, active).
- `/admin/orders` — order list and status updates.
- `/admin/content` — store settings (store name, tagline, logo, Instagram/WhatsApp, bank details, delivery fee, announcement).

## Data Model (Supabase tables)
- `profiles`: `id` (references `auth.users`), `email`, `role` (admin only), `created_at`, `updated_at`.
- `products`: `id`, `name`, `slug`, `description`, `price`, `inventory`, `category`, `image`, `sku`, `featured`, `is_active`, `created_at`, `updated_at`.
- `store_settings`: singleton (`id = true`) holding store branding, currency (`NGN`), `delivery_fee`, bank details, and announcement.
- `orders`: `id`, `public_code`, `customer_name`, `customer_phone`, `customer_instagram`, `items` (jsonb), `subtotal`, `shipping_fee`, `total`, `status`, `shipping_address` (jsonb), `receipt_path`, `inventory_restocked`, `created_at`, `updated_at`.
- Admin users are Supabase Auth users with a matching `profiles` row whose `role = 'admin'`.

## Order State Machine
- Statuses: `Pending Verification`, `Processing`, `Shipped`, `Fulfilled`, `Cancelled`.
- Allowed transitions:
  - `Pending Verification` → `Processing` or `Cancelled`
  - `Processing` → `Shipped` or `Cancelled`
  - `Shipped` → `Fulfilled`
- `Fulfilled` and `Cancelled` are terminal; repeated same-status calls are idempotent.
- Cancellation restores reserved inventory exactly once (`inventory_restocked`) and only before shipment.

## Storage
- Receipts: private `receipts` bucket (5 MiB; JPEG/PNG/PDF). Anonymous/authenticated users upload to `receipts/<uuid>.<ext>`; only admins can read. Handled by `uploadReceipt` in `src/lib/orders.ts`.
- Product images: public `product-images` bucket (5 MiB; JPEG/PNG/WebP). Admin-only upload/delete via `src/lib/productImages.ts`; public URLs serve storefront images.

## Commerce Transaction Rules
- Orders are created through the `create_store_order` RPC, which trusts the server, not the client:
  - Requires a customer name, a valid phone (≥ 7 digits), a non-empty shipping address, and at least one item.
  - Rejects duplicate products in a single order.
  - Requires the uploaded receipt to already exist in the `receipts` bucket.
  - Recalculates the subtotal from current product prices and rejects a mismatched client total.
  - Decrements inventory under row locks and rejects orders that exceed stock.
  - Is idempotent per receipt (same receipt + same phone returns the existing tracking code).
- Products referenced by any order cannot be hard-deleted; deactivate them instead.
- Status changes go through the `set_order_status` RPC (admin only).
- Order tracking uses the `get_order_status` RPC keyed on `public_code` + normalized phone.

## Design System
- Defined in `src/styles/global.css` under `@theme`.
- Colors: `surface*`, `primary` (#18231a), `secondary`, `tertiary`, `error`, plus `on-*`, `*-container`, and `*-fixed` variants.
- Fonts: Bodoni Moda for display/headline, Plus Jakarta Sans for body/label.
- Typography: `text-display-*`, `text-headline-*`, `text-body-*`, `text-label-sm` — fluid `clamp()` values.
- Spacing tokens: `unit`, `container-max`, `gutter`, `margin-mobile`, `margin-desktop`, `stack-sm/md/lg`, `section-gap` — fluid `clamp()` where responsive.
- Radius tokens: `radius-sm/md/lg/xl/full`.
- Custom utilities: `botanical-shadow`, `hide-scrollbar`, `input-underline`, `pb-safe`, `touch-target`, `visually-hidden`, `skip-link`, `load-in`, `reveal`/`reveal-group`, `target-glow-effect`; global `:focus-visible` outline styles.

## Development Rules
- Never modify an already applied migration. Add a new numbered migration.
- Coding agents must not implement future roadmap features unless the task explicitly requests them.
- Cloudflare currently provides hosting and compute only; Supabase provides PostgreSQL, Auth, and Storage.
- Coding agents must not introduce other Cloudflare data services (D1, R2, KV, Durable Objects, another database, or another authentication system) unless an active roadmap task explicitly requires them.

## Common Workflows
- `pnpm dev` — start the local dev server.
- `pnpm build` — production build.
- `pnpm preview` — serve the production build.
- `pnpm check` — Astro type check.
- `pnpm clean` — clear `dist`/`.astro` caches.
