/** Canonical settings shared by the public storefront and admin. */
import { getSupabase } from "./supabase";
import { getCurrentAdminProfile } from "./auth";
import { isValidStoreSlug, normalizeStoreSlug } from "./stores";

export interface BankSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface AnnouncementSettings {
  enabled: boolean;
  message: string;
}

export interface SiteSettings {
  storeName: string;
  tagline: string;
  logoUrl: string;
  instagramHandle: string;
  whatsappNumber: string;
  currency: "NGN";
  deliveryFee: number;
  bank: BankSettings;
  announcement: AnnouncementSettings;
}

export type StorefrontSettings = SiteSettings;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  storeName: "Your Store",
  tagline: "",
  logoUrl: "",
  instagramHandle: "",
  whatsappNumber: "",
  currency: "NGN",
  deliveryFee: 0,
  bank: { bankName: "", accountName: "", accountNumber: "" },
  announcement: { enabled: false, message: "" },
};

const LOCAL_SITE_SETTINGS_KEY = "InstaStore_site_settings";
export const SITE_SETTINGS_EVENT = "InstaStore-site-settings-updated";

function isSupabaseConfigured(): boolean {
  try {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    return Boolean(
      url &&
        anonKey &&
        !url.includes("your-project") &&
        !url.includes("placeholder") &&
        anonKey !== "your-anon-key",
    );
  } catch {
    return false;
  }
}

function normalise(
  value: Partial<SiteSettings> | null | undefined,
): SiteSettings {
  const fee = Number(value?.deliveryFee ?? DEFAULT_SITE_SETTINGS.deliveryFee);
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...(value || {}),
    currency: "NGN",
    deliveryFee: Number.isFinite(fee) && fee >= 0 ? fee : 0,
    bank: { ...DEFAULT_SITE_SETTINGS.bank, ...(value?.bank || {}) },
    announcement: {
      ...DEFAULT_SITE_SETTINGS.announcement,
      ...(value?.announcement || {}),
    },
  };
}

function fromRow(
  row: Record<string, unknown> | null | undefined,
): SiteSettings {
  return normalise(
    row
      ? {
          storeName: String(row.store_name ?? ""),
          tagline: String(row.tagline ?? ""),
          logoUrl: String(row.logo_url ?? ""),
          instagramHandle: String(row.instagram_handle ?? ""),
          whatsappNumber: String(row.whatsapp_number ?? ""),
          currency: "NGN",
          deliveryFee: Number(row.delivery_fee ?? 0),
          bank: {
            bankName: String(row.bank_name ?? ""),
            accountName: String(row.account_name ?? ""),
            accountNumber: String(row.account_number ?? ""),
          },
          announcement: {
            enabled: Boolean(row.announcement_enabled),
            message: String(row.announcement_text ?? ""),
          },
        }
      : null,
  );
}

function settingsCacheKey(storeSlug?: string): string {
  return storeSlug ? `${LOCAL_SITE_SETTINGS_KEY}:${storeSlug}` : LOCAL_SITE_SETTINGS_KEY;
}

function cacheSiteSettings(settings: SiteSettings, storeSlug?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(settingsCacheKey(storeSlug), JSON.stringify(settings));
  } catch {
    /* Cache is optional. */
  }
}

export function getSiteSettings(storeSlug?: string): SiteSettings {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(settingsCacheKey(storeSlug));
      if (stored) return normalise(JSON.parse(stored));
    } catch {
      /* Use safe defaults. */
    }
  }
  return DEFAULT_SITE_SETTINGS;
}

export async function fetchLiveSiteSettings(storeSlug?: string): Promise<SiteSettings> {
  if (!isSupabaseConfigured())
    throw new Error("Supabase is not configured for live site settings.");
  const normalizedSlug = storeSlug ? normalizeStoreSlug(storeSlug) : "";
  let data: unknown;
  if (normalizedSlug) {
    if (!isValidStoreSlug(normalizedSlug))
      throw new Error("Invalid store slug.");
    const result = await getSupabase().rpc("get_storefront_settings_by_slug", {
      p_slug: normalizedSlug,
    });
    if (result.error) throw result.error;
    data = result.data;
  } else {
    const result = await getSupabase().rpc("get_storefront_settings");
    if (result.error) throw result.error;
    data = result.data;
  }
  const settings = fromRow(
    (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null,
  );
  cacheSiteSettings(settings, normalizedSlug || undefined);
  return settings;
}

export async function saveSiteSettings(
  settings: SiteSettings,
): Promise<SiteSettings> {
  if (typeof settings.deliveryFee !== "number" || !Number.isFinite(settings.deliveryFee) || settings.deliveryFee < 0)
    throw new Error("Delivery fee must be a non-negative number.");
  if (!isSupabaseConfigured())
    throw new Error("Supabase is not configured for live site settings.");
  const profile = await getCurrentAdminProfile();
  if (!profile) {
    throw new Error("No active merchant store is associated with this account.");
  }
  const updated = normalise(settings);
  const { error } = await getSupabase()
    .from("store_settings")
    .update({
      store_name: updated.storeName,
      tagline: updated.tagline,
      logo_url: updated.logoUrl,
      instagram_handle: updated.instagramHandle,
      whatsapp_number: updated.whatsappNumber,
      currency: "NGN",
      delivery_fee: updated.deliveryFee,
      bank_name: updated.bank.bankName,
      account_name: updated.bank.accountName,
      account_number: updated.bank.accountNumber,
      announcement_enabled: updated.announcement.enabled,
      announcement_text: updated.announcement.message,
    })
    .eq("store_id", profile.store_id);
  if (error) throw error;
  cacheSiteSettings(updated);
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(SITE_SETTINGS_EVENT, { detail: updated }),
    );
  return updated;
}
