import { describe, expect, it, vi } from "vitest";
import type { ConsentRecord } from "@/lib/analytics/consent";
import { createUmamiDestination, disabledMetaDestination, routeEvent } from "@/lib/analytics/events";
import type { EventDestination, StoreEventEnvelope } from "@/lib/analytics/types";

function consent(analytics: boolean, marketing: boolean): ConsentRecord {
  return { version: "2", storeId: "store-a", analytics, marketing, updatedAt: "2026-09-26T00:00:00.000Z" };
}

function envelope(): StoreEventEnvelope {
  return {
    schema_version: 1, event_id: "11111111-1111-4111-8111-111111111111", event_name: "product add",
    occurred_at: "2026-09-26T00:00:00.000Z", store_id: "store-a", store_slug: "a", source: "browser",
    consent: consent(true, true), data: { product_id: "p1", quantity: 1 },
  };
}

function fakeDestination(name: string, purpose: "analytics" | "marketing", push = vi.fn()): EventDestination & { push: ReturnType<typeof vi.fn> } {
  return { name, purpose, push };
}

describe("destination routing", () => {
  it("sends nothing without optional consent", async () => {
    const analytics = fakeDestination("analytics", "analytics");
    const marketing = fakeDestination("marketing", "marketing");
    await routeEvent(envelope(), [analytics, marketing], () => null);
    expect(analytics.push).not.toHaveBeenCalled();
    expect(marketing.push).not.toHaveBeenCalled();
  });

  it("analytics-only permits analytics and blocks marketing", async () => {
    const analytics = fakeDestination("analytics", "analytics");
    const marketing = fakeDestination("marketing", "marketing");
    await routeEvent(envelope(), [analytics, marketing], () => consent(true, false));
    expect(analytics.push).toHaveBeenCalledOnce();
    expect(marketing.push).not.toHaveBeenCalled();
  });

  it("marketing-only permits marketing without analytics", async () => {
    const analytics = fakeDestination("analytics", "analytics");
    const marketing = fakeDestination("marketing", "marketing");
    await routeEvent(envelope(), [analytics, marketing], () => consent(false, true));
    expect(analytics.push).not.toHaveBeenCalled();
    expect(marketing.push).toHaveBeenCalledOnce();
  });

  it("a failing destination does not stop the others", async () => {
    const failing = fakeDestination("umami", "analytics", vi.fn().mockRejectedValue(new Error("offline")));
    const other = fakeDestination("fake", "marketing");
    await routeEvent(envelope(), [failing, other], () => consent(true, true));
    expect(other.push).toHaveBeenCalledWith(expect.objectContaining({ event_id: envelope().event_id }));
  });

  it("the same event ID reaches every destination", async () => {
    const first = fakeDestination("first", "analytics");
    const second = fakeDestination("second", "marketing");
    await routeEvent(envelope(), [first, second], () => consent(true, true));
    expect(first.push.mock.calls[0][0].event_id).toBe(second.push.mock.calls[0][0].event_id);
  });

  it("the disabled Meta destination makes no network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await routeEvent(envelope(), [disabledMetaDestination], () => consent(false, true));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelectorAll("script").length).toBe(0);
  });
});

describe("Umami destination", () => {
  it("skips delivery when Umami is unavailable", async () => {
    const destination = createUmamiDestination(async () => null, () => consent(true, false));
    await expect(destination.push(envelope())).resolves.toBeUndefined();
  });

  it("does not deliver when consent is withdrawn while the script loads", async () => {
    const track = vi.fn();
    let current = consent(true, false);
    let finishLoad: (tracker: { track: typeof track }) => void = () => undefined;
    const loader = () => new Promise<{ track: typeof track }>((resolve) => { finishLoad = resolve; });
    const destination = createUmamiDestination(loader, () => current);
    const pending = destination.push(envelope());
    current = consent(false, false);
    finishLoad({ track });
    await pending;
    expect(track).not.toHaveBeenCalled();
  });

  it("keeps the existing Umami event names and fields", async () => {
    const track = vi.fn();
    const destination = createUmamiDestination(async () => ({ track }), () => consent(true, false));
    await destination.push(envelope());
    expect(track).toHaveBeenCalledWith("product-add", { store_id: "store-a", store_slug: "a", product_id: "p1", quantity: 1 });
  });
});
