import { readConsent, type ConsentRecord } from "@/lib/analytics/consent";
import { captureStoreAttribution } from "@/lib/analytics/attribution";
import { loadUmamiAfterConsent, type UmamiTracker } from "@/lib/analytics/umamiDestination";
import {
  EVENT_SCHEMA_VERSION, STORE_EVENT_DATA_KEYS,
  type EventDestination, type StoreEventData, type StoreEventEnvelope, type StoreEventName,
  type StoreIdentity, type StorePageType,
} from "@/lib/analytics/types";

export type { StoreIdentity, StorePageType } from "@/lib/analytics/types";
export type StoreEvent = StoreIdentity & StoreEventData;

const umamiEventNames: Record<StoreEventName, string> = {
  "page view": "page-view", "product view": "product-view", "search submit": "search-submit",
  "product add": "product-add", "cart view": "cart-view", "checkout start": "checkout-start", "order submit": "order-submit",
};

function newEventId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Search text can contain a phone number or email; keep only the result count then. */
function looksPersonal(query: string): boolean {
  const digitCount = query.match(/\d/g)?.length ?? 0;
  return digitCount >= 7 || query.includes("@");
}

function allowlistedData(data: StoreEventData): StoreEventData {
  const safeData: Record<string, unknown> = {};
  for (const key of STORE_EVENT_DATA_KEYS) {
    if (data[key] !== undefined) safeData[key] = data[key];
  }
  if (typeof safeData.query === "string") {
    const query = safeData.query.trim().slice(0, 200);
    if (!query || looksPersonal(query)) delete safeData.query;
    else safeData.query = query;
  }
  return safeData as StoreEventData;
}

/**
 * Umami is an analytics destination. It loads lazily inside its own delivery,
 * so an unconfigured or unreachable Umami never blocks other destinations.
 * Consent is checked again after the script loads, so a withdrawal during a
 * pending load stops delivery.
 */
export function createUmamiDestination(
  loadTracker: () => Promise<UmamiTracker | null> = loadUmamiAfterConsent,
  currentConsent: (storeId: string) => ConsentRecord | null = readConsent,
): EventDestination {
  return {
    name: "umami",
    purpose: "analytics",
    async push(event) {
      const tracker = await loadTracker();
      if (!tracker || !currentConsent(event.store_id)?.analytics) return;
      tracker.track(umamiEventNames[event.event_name], { store_id: event.store_id, store_slug: event.store_slug, ...event.data });
    },
  };
}

/**
 * Placeholder for the later merchant-specific Meta destination. It is
 * deliberately inert: no script, no request, no storage.
 */
export const disabledMetaDestination: EventDestination = {
  name: "meta",
  purpose: "marketing",
  push() { /* Meta delivery is not active in the foundation. */ },
};

const destinations: EventDestination[] = [createUmamiDestination(), disabledMetaDestination];

/**
 * Deliver one event to each destination whose purpose the customer currently
 * permits. Destinations are independent: one failure never affects another.
 */
export async function routeEvent(
  event: StoreEventEnvelope,
  targets: EventDestination[] = destinations,
  currentConsent: (storeId: string) => ConsentRecord | null = readConsent,
): Promise<void> {
  await Promise.allSettled(targets.map(async (destination) => {
    const consent = currentConsent(event.store_id);
    if (!consent?.[destination.purpose]) return;
    try {
      await destination.push(event);
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`Optional ${destination.name} delivery failed`, error);
    }
  }));
}

// walkerOS remains the collector. Its single destination hands events back to
// routeEvent; if walkerOS cannot start, events are routed directly.
type WalkerElb = (name: string, data?: Record<string, unknown>) => unknown;
let walkerReady: Promise<WalkerElb | null> | null = null;

function envelopeFromWalker(name: string | undefined, data: Record<string, unknown> | undefined): StoreEventEnvelope | null {
  const payload = data?.__instastore as StoreEventEnvelope | undefined;
  if (!payload || !name || payload.event_name !== name) return null;
  return payload;
}

function getWalker(): Promise<WalkerElb | null> {
  walkerReady ??= Promise.all([import("@walkeros/collector"), import("@walkeros/web-source-browser")]).then(async ([collectorPackage, browserPackage]) => {
    const flow = await collectorPackage.startFlow({
      consent: { functional: true, required: true },
      sources: { browser: { code: browserPackage.sourceBrowser, config: { settings: { pageview: false, session: false, elb: false, elbLayer: false } } } },
      destinations: {
        router: {
          code: { type: "instastore-router", config: {}, push: (event: { name?: string; data?: Record<string, unknown> }) => {
            const envelope = envelopeFromWalker(event.name, event.data);
            if (envelope) void routeEvent(envelope);
          } },
        },
      },
    });
    return flow.elb as WalkerElb;
  }).catch((error) => {
    if (import.meta.env.DEV) console.warn("walkerOS initialization failed; routing directly", error);
    return null;
  });
  return walkerReady;
}

/** Warm consented destinations after a choice so the first event is not delayed. */
export function preloadConsentedDestinations(consent: ConsentRecord | null): void {
  if (consent?.analytics) void loadUmamiAfterConsent();
}

/**
 * Record one storefront action. Returns its event ID, or null when no optional
 * purpose is permitted for this store (nothing is collected then).
 */
export function trackStoreEvent(name: StoreEventName, data: StoreEvent): string | null {
  try {
    if (typeof window === "undefined") return null;
    const consent = readConsent(data.store_id);
    if (!consent?.analytics && !consent?.marketing) return null;
    const store: StoreIdentity = { store_id: data.store_id, store_slug: data.store_slug };
    captureStoreAttribution(store, consent);
    const envelope: StoreEventEnvelope = {
      schema_version: EVENT_SCHEMA_VERSION,
      event_id: newEventId(),
      event_name: name,
      occurred_at: new Date().toISOString(),
      ...store,
      source: "browser",
      consent,
      data: allowlistedData(data),
    };
    void getWalker().then((elb) => {
      if (elb) elb(name, { __instastore: envelope });
      else void routeEvent(envelope);
    });
    return envelope.event_id;
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Optional analytics capture failed", error);
    return null;
  }
}

export function pageTypeForPath(path: string): StorePageType {
  if (/\/product\//.test(path)) return "product";
  if (/\/shop\/?$/.test(path)) return "shop";
  if (/\/cart\/?$/.test(path)) return "cart";
  if (/\/checkout\/?$/.test(path)) return "checkout";
  if (/\/track\/?$/.test(path)) return "track";
  return "home";
}
