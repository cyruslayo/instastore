export const CONSENT_VERSION = "1";
export const CONSENT_STORAGE_KEY = "instastore_consent";

export interface ConsentRecord {
  version: string;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) || "null");
    if (!value || typeof value !== "object") return null;
    const record = value as Partial<ConsentRecord>;
    if (record.version !== CONSENT_VERSION || typeof record.analytics !== "boolean" || typeof record.marketing !== "boolean" || typeof record.updatedAt !== "string") return null;
    return { version: CONSENT_VERSION, analytics: record.analytics, marketing: record.marketing, updatedAt: record.updatedAt };
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean, marketing: boolean): ConsentRecord {
  const record: ConsentRecord = { version: CONSENT_VERSION, analytics, marketing, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Consent choices still apply for this page when storage is unavailable.
  }
  return record;
}
