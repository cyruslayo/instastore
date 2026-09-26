import { describe, expect, it } from "vitest";
import { checkEligibility, type EligibilityContext, type MarketingEvent } from "@/lib/marketing/server/eligibility";
import { createFakeSender, disabledSender } from "@/lib/marketing/server/sender";

const activatedAt = "2026-10-01T00:00:00.000Z";
const HOUR = 3_600_000;

function context(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    store: { id: "store-a", status: "active" },
    connection: { store_id: "store-a", status: "active", connection_period_id: "period-2", activated_at: activatedAt },
    current_notice_version: "meta-1",
    now: new Date(Date.parse(activatedAt) + 2 * HOUR),
    max_event_age_ms: 7 * 24 * HOUR,
    ...overrides,
  };
}

function event(overrides: Partial<MarketingEvent> = {}): MarketingEvent {
  return {
    event_id: "e1", event_name: "product add",
    occurred_at: new Date(Date.parse(activatedAt) + HOUR).toISOString(),
    store_id: "store-a", connection_period_id: "period-2",
    consent: { store_id: "store-a", notice_version: "meta-1", marketing: true },
    ...overrides,
  };
}

const purchase = (orderCreatedAt: string) => event({ event_name: "order payment_verified", order_created_at: orderCreatedAt });

describe("future-only eligibility", () => {
  it("accepts a new event with current marketing consent", () => {
    expect(checkEligibility(event(), context())).toEqual({ eligible: true });
  });

  it("accepts a new order paid within the same period", () => {
    expect(checkEligibility(purchase(new Date(Date.parse(activatedAt) + 30 * 60_000).toISOString()), context()).eligible).toBe(true);
  });

  it.each([
    ["no connection (disconnected)", event(), context({ connection: null }), "connection_inactive"],
    ["disconnected connection", event(), context({ connection: { ...context().connection!, status: "disconnected" } }), "connection_inactive"],
    ["suspended store", event(), context({ store: { id: "store-a", status: "suspended" } }), "store_inactive"],
    ["another store's event", event({ store_id: "store-b" }), context(), "wrong_store"],
    ["earlier connection period", event({ connection_period_id: "period-1" }), context(), "wrong_period"],
    ["event before activation", event({ occurred_at: "2026-09-30T23:59:59.000Z" }), context(), "before_activation"],
    ["old order verified after activation", purchase("2026-09-20T00:00:00.000Z"), context(), "order_before_activation"],
    ["missing consent", event({ consent: null }), context(), "consent_missing"],
    ["marketing not granted", event({ consent: { store_id: "store-a", notice_version: "meta-1", marketing: false } }), context(), "consent_missing"],
    ["expired notice version", event({ consent: { store_id: "store-a", notice_version: "foundation-2", marketing: true } }), context(), "consent_missing"],
    ["consent from another store", event({ consent: { store_id: "store-b", notice_version: "meta-1", marketing: true } }), context(), "consent_missing"],
    ["internal-only event", event({ event_name: "search submit" }), context(), "unsupported_event"],
    ["pending order is not a purchase", event({ event_name: "order submit" }), context(), "unsupported_event"],
    ["too old for the sender", event(), context({ now: new Date(Date.parse(activatedAt) + 30 * 24 * HOUR) }), "too_old"],
    ["future timestamp", event({ occurred_at: new Date(Date.parse(activatedAt) + 5 * HOUR).toISOString() }), context(), "future_timestamp"],
  ] as const)("rejects %s", (_label, input, ctx, reason) => {
    expect(checkEligibility(input, ctx)).toEqual({ eligible: false, reason });
  });
});

describe("senders", () => {
  it("the production sender is disabled", async () => {
    await expect(disabledSender.send(event())).resolves.toBe("disabled");
  });

  it("the fake sender records events in memory only", async () => {
    const sender = createFakeSender();
    await expect(sender.send(event())).resolves.toBe("accepted");
    expect(sender.sent).toHaveLength(1);
  });
});
