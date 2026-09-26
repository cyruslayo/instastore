import { beforeEach, describe, expect, it } from "vitest";
import { attributionStorageKey, buildOrderAttribution, captureStoreAttribution } from "@/lib/analytics/attribution";
import type { ConsentRecord } from "@/lib/analytics/consent";

const store = { store_id: "store-a", store_slug: "a" };
const DAY = 86_400_000;
const start = Date.parse("2026-09-01T00:00:00.000Z");

function consent(analytics: boolean, marketing: boolean): ConsentRecord {
  return { version: "2", storeId: "store-a", analytics, marketing, updatedAt: "2026-09-01T00:00:00.000Z" };
}

function visit(search: string) {
  window.history.replaceState(null, "", `/s/a/shop${search}`);
}

describe("store attribution snapshots", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    visit("");
  });

  it("a new campaign replaces the latest snapshot whole", () => {
    const both = consent(true, true);
    visit("?utm_source=ig&utm_campaign=spring");
    captureStoreAttribution(store, both, start);
    visit("?fbclid=click-2");
    captureStoreAttribution(store, both, start + DAY);
    const order = buildOrderAttribution(store, both, start + DAY);
    expect(order.fbclid).toBe("click-2");
    expect(order.utm_campaign).toBeUndefined();
  });

  it("a direct visit does not overwrite the latest campaign", () => {
    const analytics = consent(true, false);
    visit("?utm_source=ig&utm_campaign=spring");
    captureStoreAttribution(store, analytics, start);
    visit("");
    captureStoreAttribution(store, analytics, start + DAY);
    expect(buildOrderAttribution(store, analytics, start + DAY).utm_campaign).toBe("spring");
  });

  it("keeps the first campaign separate from the latest", () => {
    const analytics = consent(true, false);
    visit("?utm_campaign=first");
    captureStoreAttribution(store, analytics, start);
    visit("?utm_campaign=second");
    captureStoreAttribution(store, analytics, start + DAY);
    const stored = JSON.parse(localStorage.getItem(attributionStorageKey("store-a"))!);
    expect(stored.first.utm_campaign).toBe("first");
    expect(stored.latest.utm_campaign).toBe("second");
  });

  it("expires snapshots after 30 days", () => {
    const analytics = consent(true, false);
    visit("?utm_campaign=old");
    captureStoreAttribution(store, analytics, start);
    visit("");
    expect(buildOrderAttribution(store, analytics, start + 31 * DAY).utm_campaign).toBeUndefined();
  });

  it("marketing withdrawal clears click identifiers", () => {
    visit("?fbclid=click-1&utm_campaign=spring");
    captureStoreAttribution(store, consent(true, true), start);
    visit("");
    captureStoreAttribution(store, consent(true, false), start + DAY);
    const stored = localStorage.getItem(attributionStorageKey("store-a"))!;
    expect(stored).not.toContain("click-1");
    expect(stored).toContain("spring");
  });

  it("marketing-only keeps click IDs but no campaign names or visitor IDs", () => {
    visit("?fbclid=click-1&utm_campaign=spring");
    const order = buildOrderAttribution(store, consent(false, true), start);
    expect(order).toMatchObject({ fbclid: "click-1", analytics_consent: false, marketing_consent: true });
    expect(order.utm_campaign).toBeUndefined();
    expect(order.visitor_id).toBeUndefined();
  });

  it("records consent version, choice time, and store on the order", () => {
    const order = buildOrderAttribution(store, consent(false, false), start);
    expect(order).toEqual({
      analytics_consent: false, marketing_consent: false, consent_version: "2",
      consent_updated_at: "2026-09-01T00:00:00.000Z", consent_store_id: "store-a",
    });
  });

  it("stores nothing without consent and removes legacy slug-keyed state", () => {
    localStorage.setItem("instastore_attribution:a", JSON.stringify({ fbclid: "legacy" }));
    visit("?utm_campaign=spring&fbclid=x");
    captureStoreAttribution(store, null, start);
    expect(localStorage.getItem(attributionStorageKey("store-a"))).toBeNull();
    expect(localStorage.getItem("instastore_attribution:a")).toBeNull();
  });
});
