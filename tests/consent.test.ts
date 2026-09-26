import { beforeEach, describe, expect, it, vi } from "vitest";

async function freshConsent() {
  vi.resetModules();
  return import("@/lib/analytics/consent");
}

describe("store-scoped consent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not leak a choice from store A to store B", async () => {
    const { saveConsent, readConsent } = await freshConsent();
    saveConsent("store-a", true, true);
    expect(readConsent("store-a")).toMatchObject({ storeId: "store-a", analytics: true, marketing: true });
    expect(readConsent("store-b")).toBeNull();
  });

  it("ignores the old host-wide v1 choice", async () => {
    localStorage.setItem("instastore_consent", JSON.stringify({ version: "1", analytics: true, marketing: true, updatedAt: new Date().toISOString() }));
    const { readConsent } = await freshConsent();
    expect(readConsent("store-a")).toBeNull();
  });

  it("rejects a stored record that names a different store", async () => {
    const { consentStorageKey, readConsent } = await freshConsent();
    localStorage.setItem(consentStorageKey("store-a"), JSON.stringify({ version: "2", storeId: "store-b", analytics: true, marketing: true, updatedAt: "x" }));
    expect(readConsent("store-a")).toBeNull();
  });

  it("keeps the page choice when storage is unavailable", async () => {
    const { saveConsent, readConsent, hasOptionalConsent } = await freshConsent();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    saveConsent("store-a", false, true);
    expect(readConsent("store-a")).toMatchObject({ analytics: false, marketing: true });
    expect(hasOptionalConsent("store-a")).toBe(true);
  });

  it("treats a missing choice as all optional purposes off", async () => {
    const { hasOptionalConsent } = await freshConsent();
    expect(hasOptionalConsent("store-a")).toBe(false);
  });

  it("announces the store whose choice changed", async () => {
    const { saveConsent, CONSENT_EVENT } = await freshConsent();
    const listener = vi.fn();
    window.addEventListener(CONSENT_EVENT, listener);
    saveConsent("store-a", true, false);
    window.removeEventListener(CONSENT_EVENT, listener);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ storeId: "store-a" });
  });
});
