import { CONSENT_VERSION, readConsent, type ConsentRecord } from "@/lib/analytics/consent";

export interface OrderAttribution {
  landing_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  analytics_consent: boolean;
  marketing_consent: boolean;
  consent_version: string;
  visitor_id?: string;
  session_id?: string;
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const ATTRIBUTION_FIELDS = ["landing_url", "referrer", ...UTM_KEYS, "visitor_id", "session_id"] as const;
const MAX_VALUE_LENGTH = 1000;

function safeValue(value: string | null, limit = 200): string | undefined {
  const normalized = value?.trim().slice(0, limit);
  return normalized || undefined;
}

function safePageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, MAX_VALUE_LENGTH);
  } catch {
    return undefined;
  }
}

function secureId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID().replaceAll("-", "") : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function idFor(storage: Storage, key: string, storeSlug: string): string {
  const scopedKey = `${key}:${storeSlug}`;
  try {
    let value = storage.getItem(scopedKey);
    if (!value) {
      value = secureId();
      storage.setItem(scopedKey, value);
    }
    return value.slice(0, 64);
  } catch {
    return secureId();
  }
}

function cookieValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const raw = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  try { return safeValue(raw ? decodeURIComponent(raw.slice(prefix.length)) : null, 500); } catch { return undefined; }
}

function storageKey(storeSlug: string): string {
  return `instastore_attribution:${storeSlug}`;
}

/** Capture only allowlisted fields and only after the relevant consent is granted. */
export function captureStoreAttribution(storeSlug: string, consent: ConsentRecord | null = readConsent()): void {
  if (typeof window === "undefined") return;
  const key = storageKey(storeSlug);
  let existing: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "{}");
    if (value && typeof value === "object" && !Array.isArray(value)) existing = value as Record<string, unknown>;
  } catch { /* Replace malformed state with a fresh allowlisted record. */ }
  const next: Record<string, string> = {};
  if (consent?.analytics) {
    for (const field of ATTRIBUTION_FIELDS) {
      const value = existing[field];
      if (typeof value !== "string" || !value.trim()) continue;
      if (field === "landing_url" || field === "referrer") next[field] = safePageUrl(value) || "";
      else next[field] = value.slice(0, field === "visitor_id" || field === "session_id" ? 64 : 200);
    }
    if (!next.landing_url) next.landing_url = safePageUrl(window.location.href) || "";
    if (!next.referrer && document.referrer) next.referrer = safePageUrl(document.referrer) || "";
    const params = new URLSearchParams(window.location.search);
    for (const field of UTM_KEYS) next[field] ||= safeValue(params.get(field), 200) || "";
    next.visitor_id ||= idFor(localStorage, "instastore_visitor", storeSlug);
    next.session_id ||= idFor(sessionStorage, "instastore_session", storeSlug);
  }
  if (consent?.marketing) {
    const params = new URLSearchParams(window.location.search);
    next.fbclid = safeValue(params.get("fbclid"), 500) || String(existing.fbclid || "").slice(0, 500);
    next.fbc = cookieValue("_fbc") || String(existing.fbc || "").slice(0, 500);
    next.fbp = cookieValue("_fbp") || String(existing.fbp || "").slice(0, 500);
  }
  if (!consent?.analytics) {
    try {
      localStorage.removeItem(`instastore_visitor:${storeSlug}`);
      sessionStorage.removeItem(`instastore_session:${storeSlug}`);
    } catch { /* Optional identity storage may be unavailable. */ }
  }
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch { /* Attribution is optional and never blocks commerce. */ }
}

export function buildOrderAttribution(storeSlug: string, consent: ConsentRecord | null = readConsent()): OrderAttribution {
  const record: OrderAttribution = {
    analytics_consent: consent?.analytics ?? false,
    marketing_consent: consent?.marketing ?? false,
    consent_version: CONSENT_VERSION,
  };
  if (typeof window === "undefined") return record;
  try {
    captureStoreAttribution(storeSlug, consent);
    const saved = JSON.parse(localStorage.getItem(storageKey(storeSlug)) || "{}") as Record<string, unknown>;
    const keys = consent?.analytics ? ATTRIBUTION_FIELDS : [];
    for (const key of keys) {
      const value = saved[key];
      if (typeof value === "string" && value) record[key as keyof OrderAttribution] = value as never;
    }
    if (consent?.marketing) {
      for (const key of ["fbclid", "fbc", "fbp"] as const) {
        const value = saved[key];
        if (typeof value === "string" && value) record[key] = value.slice(0, 500);
      }
    }
  } catch { /* Empty attribution is valid. */ }
  return record;
}
