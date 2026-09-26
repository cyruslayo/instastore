// Version 2 scopes optional choices to one store. Each merchant is a separate
// controller, so a choice made on one storefront never applies to another.
// Version 1 host-wide choices are intentionally ignored, not migrated.
export const CONSENT_VERSION = "2";
export const CONSENT_EVENT = "instastore:consent";

export interface ConsentRecord {
  version: string;
  storeId: string;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

// This page's latest choice per store. It keeps choices working when browser
// storage is unavailable and wins over storage written by an older save.
const pageChoices = new Map<string, ConsentRecord>();

export function consentStorageKey(storeId: string): string {
  return `instastore_consent:v${CONSENT_VERSION}:${storeId}`;
}

export function readConsent(storeId: string): ConsentRecord | null {
  if (typeof window === "undefined" || !storeId) return null;
  const pageChoice = pageChoices.get(storeId);
  if (pageChoice) return pageChoice;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(consentStorageKey(storeId)) || "null");
    if (!value || typeof value !== "object") return null;
    const record = value as Partial<ConsentRecord>;
    const isValidRecord = record.version === CONSENT_VERSION && record.storeId === storeId
      && typeof record.analytics === "boolean" && typeof record.marketing === "boolean" && typeof record.updatedAt === "string";
    if (!isValidRecord) return null;
    return { version: CONSENT_VERSION, storeId, analytics: record.analytics!, marketing: record.marketing!, updatedAt: record.updatedAt! };
  } catch {
    return null;
  }
}

export function saveConsent(storeId: string, analytics: boolean, marketing: boolean): ConsentRecord {
  const record: ConsentRecord = { version: CONSENT_VERSION, storeId, analytics, marketing, updatedAt: new Date().toISOString() };
  pageChoices.set(storeId, record);
  try {
    localStorage.setItem(consentStorageKey(storeId), JSON.stringify(record));
  } catch {
    // The page choice above still applies when storage is unavailable.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { storeId } }));
  return record;
}

/** True when at least one optional destination may receive this store's events. */
export function hasOptionalConsent(storeId: string): boolean {
  const consent = readConsent(storeId);
  return Boolean(consent?.analytics || consent?.marketing);
}
