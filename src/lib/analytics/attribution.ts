import { CONSENT_VERSION, readConsent, type ConsentRecord } from "@/lib/analytics/consent";
import type { StoreIdentity } from "@/lib/analytics/types";

export interface OrderAttribution {
  landing_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  /** Meta browser cookies. They stay empty until a later Pixel activation sets them. */
  fbc?: string;
  fbp?: string;
  analytics_consent: boolean;
  marketing_consent: boolean;
  consent_version: string;
  consent_updated_at?: string;
  consent_store_id?: string;
  visitor_id?: string;
  session_id?: string;
}

/**
 * One coherent campaign touch. Fields are only ever captured together from a
 * single URL, so old campaign names never combine with a newer click ID.
 */
export interface CampaignSnapshot {
  captured_at: string;
  expires_at: string;
  landing_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
}

interface StoredAttribution {
  first?: CampaignSnapshot;
  latest?: CampaignSnapshot;
}

/** Product default for campaign memory; not a claim about any ad platform's window. */
export const ATTRIBUTION_TTL_DAYS = 30;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const ANALYTICS_SNAPSHOT_KEYS = ["landing_url", "referrer", ...UTM_KEYS] as const;
const MAX_URL_LENGTH = 1000;

function safeValue(value: string | null | undefined, limit = 200): string | undefined {
  const normalized = value?.trim().slice(0, limit);
  return normalized || undefined;
}

function safePageUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, MAX_URL_LENGTH);
  } catch {
    return undefined;
  }
}

function secureId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID().replaceAll("-", "") : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function idFor(storage: Storage, key: string, storeId: string): string {
  const scopedKey = `${key}:${storeId}`;
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

function clearIds(storeId: string): void {
  try {
    localStorage.removeItem(`instastore_visitor:${storeId}`);
    sessionStorage.removeItem(`instastore_session:${storeId}`);
  } catch { /* Optional identity storage may be unavailable. */ }
}

function cookieValue(name: string): string | undefined {
  const prefix = `${name}=`;
  const raw = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  try { return safeValue(raw ? decodeURIComponent(raw.slice(prefix.length)) : null, 500); } catch { return undefined; }
}

export function attributionStorageKey(storeId: string): string {
  return `instastore_attribution:v2:${storeId}`;
}

function isSnapshot(value: unknown): value is CampaignSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<CampaignSnapshot>;
  return typeof snapshot.captured_at === "string" && typeof snapshot.expires_at === "string";
}

/** Keep only fields the current consent permits; drop the snapshot if expired or empty. */
function permittedSnapshot(snapshot: unknown, consent: ConsentRecord | null, now: number): CampaignSnapshot | undefined {
  if (!isSnapshot(snapshot) || !(Date.parse(snapshot.expires_at) > now)) return undefined;
  const kept: CampaignSnapshot = { captured_at: snapshot.captured_at, expires_at: snapshot.expires_at };
  if (consent?.analytics) {
    for (const key of ANALYTICS_SNAPSHOT_KEYS) {
      const value = snapshot[key];
      if (typeof value === "string" && value) kept[key] = value.slice(0, key === "landing_url" || key === "referrer" ? MAX_URL_LENGTH : 200);
    }
  }
  if (consent?.marketing && typeof snapshot.fbclid === "string" && snapshot.fbclid) kept.fbclid = snapshot.fbclid.slice(0, 500);
  const hasCampaignField = [...UTM_KEYS, "fbclid" as const].some((key) => kept[key]);
  return hasCampaignField || kept.landing_url ? kept : undefined;
}

function readStored(storeId: string, consent: ConsentRecord | null, now: number): StoredAttribution {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(attributionStorageKey(storeId)) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const stored = value as Record<string, unknown>;
    return { first: permittedSnapshot(stored.first, consent, now), latest: permittedSnapshot(stored.latest, consent, now) };
  } catch {
    return {};
  }
}

/** A snapshot from the current URL, containing only consented campaign fields. */
function snapshotFromLocation(consent: ConsentRecord | null, now: number): CampaignSnapshot {
  const params = new URLSearchParams(window.location.search);
  const snapshot: CampaignSnapshot = {
    captured_at: new Date(now).toISOString(),
    expires_at: new Date(now + ATTRIBUTION_TTL_DAYS * 86_400_000).toISOString(),
  };
  if (consent?.analytics) {
    for (const key of UTM_KEYS) {
      const value = safeValue(params.get(key));
      if (value) snapshot[key] = value;
    }
    snapshot.landing_url = safePageUrl(window.location.href);
    if (document.referrer) snapshot.referrer = safePageUrl(document.referrer);
  }
  if (consent?.marketing) {
    const fbclid = safeValue(params.get("fbclid"), 500);
    if (fbclid) snapshot.fbclid = fbclid;
  }
  return snapshot;
}

/**
 * Capture only consented campaign fields. An explicit campaign or click ID
 * replaces the latest snapshot whole; a direct visit never overwrites it.
 * Withdrawn purposes are removed from storage immediately.
 */
export function captureStoreAttribution(store: StoreIdentity, consent: ConsentRecord | null = readConsent(store.store_id), now = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    // Version 1 state was keyed by slug and mixed campaign fields; drop it.
    localStorage.removeItem(`instastore_attribution:${store.store_slug}`);
    localStorage.removeItem(`instastore_visitor:${store.store_slug}`);
    sessionStorage.removeItem(`instastore_session:${store.store_slug}`);
  } catch { /* Storage may be unavailable. */ }
  const stored = readStored(store.store_id, consent, now);
  const current = snapshotFromLocation(consent, now);
  const hasExplicitCampaign = [...UTM_KEYS, "fbclid" as const].some((key) => current[key]);
  const next: StoredAttribution = { ...stored };
  if (hasExplicitCampaign) {
    next.latest = current;
    next.first ??= current;
  } else if (!next.first && current.landing_url) {
    next.first = current;
  }
  if (consent?.analytics) {
    idFor(localStorage, "instastore_visitor", store.store_id);
    idFor(sessionStorage, "instastore_session", store.store_id);
  } else {
    clearIds(store.store_id);
  }
  try {
    if (next.first || next.latest) localStorage.setItem(attributionStorageKey(store.store_id), JSON.stringify(next));
    else localStorage.removeItem(attributionStorageKey(store.store_id));
  } catch { /* Attribution is optional and never blocks commerce. */ }
}

/** Order attribution uses the latest unexpired snapshot, falling back to the first visit. */
export function buildOrderAttribution(store: StoreIdentity, consent: ConsentRecord | null = readConsent(store.store_id), now = Date.now()): OrderAttribution {
  const record: OrderAttribution = {
    analytics_consent: consent?.analytics ?? false,
    marketing_consent: consent?.marketing ?? false,
    consent_version: CONSENT_VERSION,
  };
  if (consent) {
    record.consent_updated_at = consent.updatedAt;
    record.consent_store_id = consent.storeId;
  }
  if (typeof window === "undefined") return record;
  try {
    captureStoreAttribution(store, consent, now);
    const stored = readStored(store.store_id, consent, now);
    const snapshot = stored.latest ?? stored.first;
    if (snapshot) {
      for (const key of [...ANALYTICS_SNAPSHOT_KEYS, "fbclid"] as const) {
        if (snapshot[key]) record[key] = snapshot[key];
      }
    }
    if (consent?.analytics) {
      record.visitor_id = idFor(localStorage, "instastore_visitor", store.store_id);
      record.session_id = idFor(sessionStorage, "instastore_session", store.store_id);
    }
    if (consent?.marketing) {
      record.fbc = cookieValue("_fbc");
      record.fbp = cookieValue("_fbp");
    }
  } catch { /* Empty attribution is valid. */ }
  return record;
}
