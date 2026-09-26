// Server-only. Future-only eligibility rules for a later merchant-specific
// marketing destination (see docs/META_FOUNDATION.md). Nothing in the browser
// imports this module, and no production path can create an active connection:
// there is no connection table until the activation task adds one.
import type { StoreEventName } from "@/lib/analytics/types";

export type MarketingEventName = StoreEventName | "order payment_verified";

/** Internal name -> Meta standard event. Unmapped events stay internal. */
export const META_EVENT_NAMES: Partial<Record<MarketingEventName, string>> = {
  "page view": "PageView",
  "product view": "ViewContent",
  "product add": "AddToCart",
  "checkout start": "InitiateCheckout",
  "order payment_verified": "Purchase",
};

export interface MarketingConnection {
  store_id: string;
  status: "active" | "disconnected";
  /** New ID for every activation or reconnection; set by the server, never the client. */
  connection_period_id: string;
  /** Server database time the period started. */
  activated_at: string;
}

export interface MarketingConsent {
  store_id: string;
  notice_version: string;
  marketing: boolean;
}

export interface MarketingEvent {
  event_id: string;
  event_name: MarketingEventName;
  occurred_at: string;
  store_id: string;
  /** Period the server receiver assigned when the event arrived. */
  connection_period_id: string | null;
  consent: MarketingConsent | null;
  /** Purchases only: when the order was created (database time). */
  order_created_at?: string;
}

export interface EligibilityContext {
  store: { id: string; status: "active" | "suspended" };
  connection: MarketingConnection | null;
  current_notice_version: string;
  now: Date;
  max_event_age_ms: number;
}

export type IneligibleReason =
  | "store_inactive" | "connection_inactive" | "wrong_store" | "wrong_period"
  | "before_activation" | "consent_missing" | "unsupported_event"
  | "too_old" | "future_timestamp" | "order_before_activation";

export type EligibilityResult = { eligible: true } | { eligible: false; reason: IneligibleReason };

const CLOCK_SKEW_MS = 5 * 60_000;

function ineligible(reason: IneligibleReason): EligibilityResult {
  return { eligible: false, reason };
}

/**
 * Only new events inside the current active connection period qualify.
 * There is no replay: events outside the period are ineligible permanently.
 */
export function checkEligibility(event: MarketingEvent, context: EligibilityContext): EligibilityResult {
  const { store, connection, now } = context;
  if (store.status !== "active") return ineligible("store_inactive");
  if (!connection || connection.status !== "active") return ineligible("connection_inactive");
  if (event.store_id !== store.id || connection.store_id !== store.id) return ineligible("wrong_store");
  if (event.connection_period_id !== connection.connection_period_id) return ineligible("wrong_period");

  const occurredAt = Date.parse(event.occurred_at);
  const activatedAt = Date.parse(connection.activated_at);
  if (!Number.isFinite(occurredAt) || !Number.isFinite(activatedAt) || occurredAt < activatedAt) return ineligible("before_activation");

  const consent = event.consent;
  const hasCurrentMarketingConsent = Boolean(consent?.marketing)
    && consent?.store_id === store.id
    && consent?.notice_version === context.current_notice_version;
  if (!hasCurrentMarketingConsent) return ineligible("consent_missing");

  if (!META_EVENT_NAMES[event.event_name]) return ineligible("unsupported_event");
  if (occurredAt > now.getTime() + CLOCK_SKEW_MS) return ineligible("future_timestamp");
  if (now.getTime() - occurredAt > context.max_event_age_ms) return ineligible("too_old");

  if (event.event_name === "order payment_verified") {
    const orderCreatedAt = Date.parse(event.order_created_at ?? "");
    if (!Number.isFinite(orderCreatedAt) || orderCreatedAt < activatedAt) return ineligible("order_before_activation");
  }
  return { eligible: true };
}
