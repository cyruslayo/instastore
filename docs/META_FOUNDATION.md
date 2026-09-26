# Meta foundation (T12 groundwork)

Status: foundation only. **Meta is not live.** No Pixel, no CAPI request, no token, no delivery table, no connection UI. Finishing this work does not mean the Meta integration is ready.

## What exists

| Piece | Where | Behavior |
|---|---|---|
| Event envelope | `src/lib/analytics/types.ts` | `schema_version` 1, random `event_id` per browser action, `occurred_at`, store identity, consent, allowlisted `data`. |
| Independent routing | `src/lib/analytics/events.ts` | Each destination has one purpose (`analytics` or `marketing`) and is checked against current consent at delivery. Umami loads inside its own delivery; its absence or failure affects only Umami. |
| Disabled Meta destination | `disabledMetaDestination` | Marketing purpose, no-op, no network. |
| Store-scoped consent | `src/lib/analytics/consent.ts` | Version `2`, key `instastore_consent:v2:<store_id>`. Version 1 host-wide choices are ignored. In-memory fallback when storage fails. Analytics and Marketing are independent. |
| Campaign snapshots | `src/lib/analytics/attribution.ts` | Coherent `first` and `latest` snapshots per store, 30-day expiry (product default, not a Meta window). Only an explicit UTM or `fbclid` replaces `latest`; direct visits never do. Withdrawn purposes are cleared. |
| Order consent metadata | migration `0017` | `orders.attribution` adds `consent_updated_at` (browser), `consent_received_at` (server), `consent_store_id` (must match the order's store). |
| Verified-payment fact | migration `0017` | First `Pending Verification → Processing` stamps `orders.payment_verified_at` and a stable `orders.payment_event_id` in the same transaction. No backfill. Cancellation keeps the fact. |
| Eligibility rules | `src/lib/marketing/server/eligibility.ts` | Pure server function. No connection table exists yet, so no production path can become eligible. |
| Sender boundary | `src/lib/marketing/server/sender.ts` | `disabledSender` (production) and an in-memory fake (tests only). |

## Future-only rules

An event qualifies for a later Meta delivery only when all hold:

1. The store is active.
2. The merchant connection is active.
3. The event belongs to that store and the current connection period (the server assigns the period; never the client).
4. The event occurred at or after activation (server clock).
5. The customer granted Marketing for that store under the **current** notice version.
6. The destination supports the event (`page view`, `product view`, `product add`, `checkout start`, `order payment_verified`).
7. The event passes age and timestamp checks.

Purchases also require the order to have been **created** after activation. An old order verified after activation is permanently excluded. Reconnection starts a new period; the previous period is never replayed. Retries of an eligible event reuse its event ID.

`order submit` means a pending order was created. It is never a purchase. `order payment_verified` (Purchase) is the merchant's first payment verification; its value will be the trusted order total in NGN, delivery included.

## Consent at activation

The current Marketing choice does **not** authorize Meta delivery. Activation must publish a notice describing actual Meta sharing, bump the notice version, and require fresh consent. The `fbc`/`fbp` fields stay empty until a Pixel sets those cookies.

## Left for the activation task

Merchant connection table with periods and server-held credential references; authorized activation path; delivery table for eligible events only (never a scan of historical orders); real CAPI sender with retries and age limits; Pixel only where useful, sharing event IDs with CAPI; operator diagnostics; Meta receipt tests per store.
