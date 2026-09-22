import { readConsent, type ConsentRecord } from "@/lib/analytics/consent";
import { captureStoreAttribution } from "@/lib/analytics/attribution";
import { loadUmamiAfterConsent, type UmamiTracker } from "@/lib/analytics/umamiDestination";

export type StorePageType = "home" | "shop" | "product" | "cart" | "checkout" | "track";
export interface StoreIdentity { store_id: string; store_slug: string; }
export interface StoreEvent extends StoreIdentity { page_type?: StorePageType; path?: string; product_id?: string; category?: string; price?: number; quantity?: number; in_stock?: boolean; query?: string; result_count?: number; item_count?: number; subtotal?: number; }

type WalkerElb = (name: string, data?: Record<string, unknown>) => unknown;
let walkerReady: Promise<WalkerElb | null> | null = null;
let tracker: UmamiTracker | null = null;

const eventNames: Record<string, string> = {
  "page view": "page-view", "product view": "product-view", "search submit": "search-submit",
  "product add": "product-add", "cart view": "cart-view", "checkout start": "checkout-start", "order submit": "order-submit",
};

async function getWalker(consent: ConsentRecord, loadTracker: boolean): Promise<WalkerElb | null> {
  if (loadTracker) {
    const loadedTracker = await loadUmamiAfterConsent();
    if (!loadedTracker) return null;
    tracker = loadedTracker;
  }
  if (!walkerReady) {
    walkerReady = Promise.all([import("@walkeros/collector"), import("@walkeros/web-source-browser")]).then(async ([collectorPackage, browserPackage]) => {
      const flow = await collectorPackage.startFlow({
        consent: { functional: true, required: true, analytics: consent.analytics, marketing: consent.marketing },
        sources: { browser: { code: browserPackage.sourceBrowser, config: { settings: { pageview: false, session: false, elb: false, elbLayer: false } } } },
        destinations: {
          umami: {
            code: { type: "umami", config: {}, push: (event: { name?: string; data?: Record<string, unknown> }) => {
              if (!tracker || !event.name) return;
              const mappedName = eventNames[event.name];
              if (mappedName) tracker.track(mappedName, event.data || {});
            } },
            config: { consent: { analytics: true } },
          },
        },
      });
      return flow.elb as WalkerElb;
  }).catch((error) => {
      if (import.meta.env.DEV) console.warn("walkerOS analytics initialization failed", error);
      return null;
    });
  }
  return walkerReady;
}

export function syncAnalyticsConsent(consent: ConsentRecord): void {
  if (consent.analytics) {
    void getWalker(consent, true).then((elb) => elb?.("walker consent", { functional: true, required: true, analytics: true, marketing: consent.marketing })).catch((error) => {
      if (import.meta.env.DEV) console.warn("walkerOS consent update failed", error);
    });
  } else {
    void getWalker(consent, false).then((elb) => elb?.("walker consent", { functional: true, required: true, analytics: false, marketing: consent.marketing })).catch(() => undefined);
  }
}

export function trackStoreEvent(name: keyof typeof eventNames, data: StoreEvent): void {
  try {
    const consent = readConsent();
    if (!consent?.analytics || typeof window === "undefined") return;
    captureStoreAttribution(data.store_slug, consent);
    void getWalker(consent, true).then((elb) => {
      if (!elb) return;
      const safeData: Record<string, unknown> = { store_id: data.store_id, store_slug: data.store_slug };
      for (const key of ["page_type", "path", "product_id", "category", "price", "quantity", "in_stock", "query", "result_count", "item_count", "subtotal"] as const) {
        if (data[key] !== undefined) safeData[key] = data[key];
      }
      elb(name, safeData);
    }).catch((error) => {
      if (import.meta.env.DEV) console.warn("walkerOS analytics event failed", error);
    });
  } catch (error) {
    if (import.meta.env.DEV) console.warn("Optional analytics capture failed", error);
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
