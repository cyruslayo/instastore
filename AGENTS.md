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
- Routes live under `src/pages/`. `/` is the InstaStore platform homepage; `/privacy` and `/terms` are public platform pages. Public storefronts are store-scoped under `/s/<store-slug>/...`; compatibility customer URLs are lightweight redirects to `default-store` (see below). Storefront pages use `src/layouts/Layout.astro` (Header, skip link, MotionProvider, BottomNav, StorefrontFooter), which requires a `storeSlug` prop; admin pages use `src/layouts/AdminLayout.astro` (sidebar + AdminBottomNav on mobile).
- Storefront pages resolve the store with `getPublicStoreBySlug` (`src/lib/stores.ts`) and render a not-found "Store unavailable" result when the slug is unknown or the store is suspended. Invalid stores never fall back to `default-store`.
- Storefront pages fetch Supabase and fall back to empty/placeholder data when the DB is empty or unavailable.
- Cart state is client-only in a `nanostores` store (`src/store/cart.ts`) keyed by store slug (`Record<storeSlug, CartItem[]>`), read via `useStore()` from `@nanostores/react`. One browser keeps separate carts per store; products never cross between them.
- Checkout is a single store-scoped page (`/s/<store>/checkout`) that collects delivery details, selects an active delivery zone for the city, shows bank-transfer instructions, uploads the payment receipt, then creates an `orders` row with status `Pending Verification` through the `create_store_order` RPC.
- Admin pages are static shells (`prerender = true`) that hydrate client components gated by `AdminGate` (auth check via `src/lib/auth.ts`).
- Animations use the `motion` package via `src/components/FadeIn.tsx` (`FadeIn`, `StaggerContainer`, `StaggerItem`), wrapped in `MotionProvider` (`reducedMotion="user"`); `global.css` also defines scroll-driven `reveal`/`load-in` utilities.
- External images: use plain `<img>` with `referrerpolicy="no-referrer"`; host allowlisting is not needed (no Next Image).
- Mobile bottom navs: `src/components/BottomNav.tsx` (storefront) and `src/components/admin/AdminBottomNav.tsx` (admin), both fixed with `pb-safe` (safe-area-inset).

## Storefront Routes
Public storefronts live under `/s/<store-slug>/`. Every route resolves the store
by slug, requires `status = 'active'`, uses that store's settings and products,
keeps navigation inside the store, and passes `storeSlug` explicitly. Unknown or
suspended stores render a "Store unavailable" result (HTTP 404) and never fall
back to `default-store`.

- `/s/<store>` — storefront home: store branding plus up to four featured products, falling back to newest active products.
- `/s/<store>/shop` — full active product catalog with browser-side search (name/category/description), category and in-stock filters, and newest/price sorting.
- `/s/<store>/product/<slug>` — product detail (redirects to that store's `/shop` when not found).
- `/s/<store>/cart` — client-side cart for that store.
- `/s/<store>/checkout` — guest checkout: delivery details + delivery zone + bank transfer + receipt upload.
- `/s/<store>/track` — order status lookup by tracking code + phone.

Legacy customer URLs (except `/`, now the platform homepage) are lightweight redirects that preserve query parameters (`/track?order=ORD-123` → `/s/default-store/track?order=ORD-123`):

- `/shop` → `/s/default-store/shop`
- `/oils` → `/s/default-store/shop`
- `/product/<slug>` → `/s/default-store/product/<slug>`
- `/cart` → `/s/default-store/cart`
- `/checkout` → `/s/default-store/checkout`
- `/track` → `/s/default-store/track`

The platform homepage is configurable with public build-time `PUBLIC_SITE_URL`, `PUBLIC_OPERATOR_NAME`, `PUBLIC_SUPPORT_EMAIL`, and `PUBLIC_SUPPORT_WHATSAPP` values. Those values may be absent for development builds; `pnpm launch:check` checks required launch configuration. Do not add secrets with a `PUBLIC_` prefix.

HTTP response security headers are set by `src/middleware.ts` for Worker-rendered responses and `public/_headers` for Cloudflare static assets. The Worker uses Cloudflare's built-in observability; no external monitoring service is required.

The `/` platform homepage is intentionally small and supports assisted onboarding only; do not add self-service signup.

## Admin Routes
- `/admin` — dashboard with verified revenue (Processing/Shipped/Fulfilled only), pending-verification count, active low-stock count (inventory <= 5), active-product count, two short attention queues, and the latest five orders.
- `/admin/products` — product CRUD (name, slug, description, price, optional compare-at price, inventory, category, primary image, up to four ordered gallery images, SKU, featured, active).
- `/admin/orders` — order list and status updates; order details show the delivery snapshot when present.
- `/admin/delivery` — merchant delivery zones (Abuja/Lagos): view, add, edit, activate/deactivate, delete.
- `/admin/content` — store settings (store name, tagline, description, managed logo and hero image, primary brand color, Instagram/WhatsApp, bank details, currency, announcement). The flat delivery fee input has been removed; delivery pricing lives under `/admin/delivery`.

## Data Model (Supabase tables)
- `stores`: `id`, `slug` (unique), `name`, `status` (`active` | `suspended`), `created_at`, `updated_at`.
- `profiles`: `id` (references `auth.users`), `email`, `role` (admin only), `store_id` (references `stores`), `created_at`, `updated_at`.
- `products`: `id`, `store_id`, `name`, `slug`, `description`, `price`, nullable presentation-only `compare_at_price` (must exceed `price`), `inventory`, `category`, primary `image`, up to four ordered `gallery_images`, `sku`, `featured`, `is_active`, `created_at`, `updated_at`. Product slugs are unique per store (`unique (store_id, slug)`), so two merchants may use the same slug. Checkout trusts `price`, never `compare_at_price`.
- `store_settings`: one row per store, primary key `store_id`, holding store name, tagline, description, logo URL, hero image URL, six-digit hex primary brand color, currency (`NGN`), bank details, and announcement. `delivery_fee` is deprecated (kept for now, no longer read by checkout).
- `delivery_zones`: `id`, `store_id` (references `stores`, cascade delete), `city` (`Abuja` | `Lagos`), `name`, `provider`, `fee`, `estimate`, `note`, `is_active`, `sort_order`, `created_at`, `updated_at`; unique on `(store_id, city, lower(btrim(name)))`, so a merchant may reuse a zone name across cities. Public and merchant zone lists order by `city`, then `sort_order`, then `name`.
- `orders`: `id`, `store_id`, `public_code`, `customer_name`, `customer_phone`, `customer_instagram`, `items` (jsonb), `subtotal`, `shipping_fee`, `total`, `status`, `shipping_address` (jsonb), `receipt_path`, `inventory_restocked`, `delivery_zone_id` (references `delivery_zones` `on delete set null`), `delivery_city`, `delivery_zone_name`, `delivery_provider`, `delivery_estimate`, `attribution` (bounded allowlisted jsonb, default `{}`), `created_at`, `updated_at`. Historical orders keep delivery snapshots null and have empty attribution by default.
- Each merchant (profile) belongs to exactly one store. Admin users are Supabase Auth users with a matching `profiles` row whose `role = 'admin'` and whose store is `active`.

## Tenant Security Model
- A merchant's store identity is derived from the session, never from client input. The `public.current_store_id()` SECURITY DEFINER helper returns the caller's active store UUID (null for anon, non-admin, or suspended stores); `public.current_store_slug()` returns its slug. `public.store_is_active(uuid)` and `public.store_slug_is_active(text)` let policies check store status without exposing the `stores` table.
- Row-level security is the enforcement boundary. `products`, `orders`, `store_settings`, and `delivery_zones` are all scoped to `store_id = public.current_store_id()` for authenticated merchants; `profiles` is limited to the caller's own row; `stores` is limited to the caller's own store.
- Anonymous and authenticated visitors may read active products and active delivery zones for any active store (for public storefronts), resolve active stores through `get_storefront_settings_by_slug()`, and read active store rows (`stores_public_active_select`). Draft products and suspended stores stay hidden.
- Product creation sets `store_id` from the authenticated profile; the form never accepts a store_id. Orders are inserted by `create_store_order()` and never written directly by the browser.
- Manual merchant provisioning: create a `stores` row, create its `store_settings` row (keyed by `store_id`), then set the merchant's `profiles.store_id`. There is no self-signup, store switching, or super-admin.

## Order State Machine
- Statuses: `Pending Verification`, `Processing`, `Shipped`, `Fulfilled`, `Cancelled`.
- Allowed transitions:
  - `Pending Verification` → `Processing` or `Cancelled`
  - `Processing` → `Shipped` or `Cancelled`
  - `Shipped` → `Fulfilled`
- `Fulfilled` and `Cancelled` are terminal; repeated same-status calls are idempotent.
- Cancellation restores reserved inventory exactly once (`inventory_restocked`) and only before shipment.

## Measurement and consent
- walkerOS is the structured storefront event model/collector; a local destination adapter forwards Analytics-consented events to an external Umami instance. Umami is not embedded or hosted by InstaStore.
- Public runtime configuration is optional: `PUBLIC_UMAMI_SCRIPT_URL`, `PUBLIC_UMAMI_WEBSITE_ID`, and optionally `PUBLIC_UMAMI_HOST_URL`. Missing configuration is a no-op.
- Necessary is always enabled. Analytics and Marketing default off; the versioned choice is stored in localStorage and can be reopened via the storefront footer. There is no Marketing destination in this batch.
- Tracked events: page view, product view, search submit, product add, cart view, checkout start, order submit. Every event includes `store_id` and `store_slug`; no customer identity, address, receipt path, or tracking code is sent. Order submit means order created, not verified payment.
- Migration `0015_measurement_foundation.sql` adds `orders.attribution`; its RPC accepts only landing/referrer, approved UTM/click-id fields, consent, and random store-scoped visitor/session IDs, with consent checks and maximum lengths. URL queries/hashes are stripped. No analytics-events table or Meta Pixel/CAPI is used.

## T09 real-integration launch gate
T09 must exercise a real, isolated Supabase project and real external Umami before launch. Verify GoTrue login/session, PostgREST queries and RPC calls, actual Storage HTTP uploads, receipt MIME/size limits, product image uploads, logo/hero uploads, signed private receipt reads, public image delivery, complete customer checkout, merchant payment verification, stock updates, and order tracking. Measurement checks must confirm the real Umami script loads only after Analytics consent, event receipt at Umami, no Umami request before consent, preference changes, and attribution stored on a real order. Disposable PostgreSQL migration tests do not replace these checks.

## Storage
- Receipts: private `receipts` bucket (5 MiB; JPEG/PNG/PDF). New uploads go to `receipts/<store-slug>/<random-id>.<ext>` and the slug must belong to an active store — unknown or suspended store namespaces are rejected by the storage policy. Historical `receipts/<random-id>.<ext>` paths remain readable by the default-store merchant only. Only admins can read. Handled by `uploadReceipt` in `src/lib/orders.ts`.
- Product images: public `product-images` bucket (5 MiB; JPEG/PNG/WebP). New uploads go to `products/<store-id>/<random-id>.<ext>`; historical `products/<random-id>.<ext>` paths remain and are deletable only by the default-store merchant. Store logos and hero images use `stores/<store-id>/logo/<random-id>.<ext>` and `stores/<store-id>/hero/<random-id>.<ext>`. Admin-only upload/delete via `src/lib/productImages.ts` and `src/lib/storeAssets.ts`; public URLs serve storefront images.

## Commerce Transaction Rules
- Orders are created through the `create_store_order` RPC, which trusts the server, not the client:
  - Requires the store slug and the selected delivery zone ID; rejects unknown or suspended stores.
  - Resolves the delivery zone, confirms it belongs to the store, and confirms it is active.
  - Requires a customer name, a valid phone (≥ 7 digits), a non-empty shipping address, and at least one item.
  - Rejects duplicate products in a single order.
  - Requires the uploaded receipt to already exist in the `receipts` bucket and to belong to the requested store's namespace.
  - Recalculates the subtotal from current product prices and reads the delivery fee from `delivery_zones`, then rejects a mismatched client total.
  - Decrements inventory under row locks and rejects orders that exceed stock.
  - Snapshots `delivery_city`, `delivery_zone_name`, `delivery_provider`, `delivery_estimate`, and `shipping_fee` onto the order, so later zone edits never change historical orders.
  - Is idempotent per receipt (same receipt + same phone returns the existing tracking code).
  - Never reads the deprecated `store_settings.delivery_fee`.
- Products referenced by any order cannot be hard-deleted; deactivate them instead.
- Status changes go through the `set_order_status` RPC (admin only) and are scoped to the caller's store.
- Order tracking uses the `get_order_status` RPC keyed on `public_code` + normalized phone + store slug; there are no global order lookups from new storefront routes.

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
- `pnpm build` — production build; Umami configuration is optional.
- `pnpm preview` — serve the production build.
- `pnpm check` — Astro type check.
- `pnpm clean` — clear `dist`/`.astro` caches.
