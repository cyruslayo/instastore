/**
 * Global Site Settings Management
 * Supports Bank/Payment instructions, storewide announcements,
 * and storefront copy.
 */
import { getSupabase } from "./supabase";

export interface BankSettings {
  bankName: string;
  accountName: string;
  accountNumber: string;
  dispatchNote: string;
}

export interface AnnouncementSettings {
  enabled: boolean;
  message: string;
  linkText?: string;
  linkUrl?: string;
}

export interface SiteSettings {
  bank: BankSettings;
  announcement: AnnouncementSettings;
  landingInviteCode?: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  bank: {
    bankName: "",
    accountName: "",
    accountNumber: "",
    dispatchNote:
      "Orders are dispatched via private courier directly within Abuja (FCT).",
  },
  announcement: {
    enabled: false,
    message: "Autumn Harvest BT-2481 is now available for approved members.",
    linkText: "Shop Available Products",
    linkUrl: "/shop",
  },
  landingInviteCode: "",
};

const LOCAL_SITE_SETTINGS_KEY = "instastore_site_settings";
export const SITE_SETTINGS_EVENT = "instastore-site-settings-updated";

function isSupabaseConfigured(): boolean {
  try {
    // Astro injects ImportMeta.env; the fallback keeps this helper safe in non-Astro tooling.
    // @ts-ignore -- ImportMeta.env is provided by Astro/Vite.
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    // @ts-ignore -- ImportMeta.env is provided by Astro/Vite.
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return false;
    if (
      url.includes("your-project") ||
      url.includes("placeholder") ||
      anonKey === "your-anon-key"
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function mergeSiteSettings(
  value: Partial<SiteSettings> | null | undefined,
): SiteSettings {
  return {
    ...DEFAULT_SITE_SETTINGS,
    ...(value || {}),
    bank: { ...DEFAULT_SITE_SETTINGS.bank, ...(value?.bank || {}) },
    announcement: {
      ...DEFAULT_SITE_SETTINGS.announcement,
      ...(value?.announcement || {}),
    },
  };
}

function cacheSiteSettings(settings: SiteSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_SITE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // A cache failure must never change the persistence result.
  }
}

export function getSiteSettings(): SiteSettings {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(LOCAL_SITE_SETTINGS_KEY);
      if (stored) {
        return mergeSiteSettings(JSON.parse(stored));
      }
    } catch {
      // Ignore malformed cached settings and use defaults.
    }
  }
  return DEFAULT_SITE_SETTINGS;
}

export async function fetchLiveSiteSettings(): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured for live site settings.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_storefront_settings");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const merged = mergeSiteSettings(row ? {
    bank: {
      bankName: row.bank_name || "",
      accountName: row.account_name || "",
      accountNumber: row.account_number || "",
      dispatchNote: DEFAULT_SITE_SETTINGS.bank.dispatchNote,
    },
    announcement: {
      enabled: row.announcement_enabled ?? false,
      message: row.announcement_text || "",
    },
  } : null);
  cacheSiteSettings(merged);
  return merged;
}

export async function saveSiteSettings(
  settings: Partial<SiteSettings>,
): Promise<SiteSettings> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured for live site settings.");
  }

  const supabase = getSupabase();
  const { data, error: readError } = await supabase
    .from("store_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (readError) throw readError;

  const current = mergeSiteSettings({
    bank: {
      bankName: data.bank_name || "",
      accountName: data.account_name || "",
      accountNumber: data.account_number || "",
      dispatchNote: DEFAULT_SITE_SETTINGS.bank.dispatchNote,
    },
    announcement: {
      enabled: data.announcement_enabled ?? false,
      message: data.announcement_text || "",
    },
  });
  const updated = mergeSiteSettings({
    ...current,
    ...settings,
    bank: settings.bank ? { ...current.bank, ...settings.bank } : current.bank,
    announcement: settings.announcement
      ? { ...current.announcement, ...settings.announcement }
      : current.announcement,
  });

  const { error: writeError } = await supabase
    .from("store_settings")
    .update({
      bank_name: updated.bank.bankName,
      account_name: updated.bank.accountName,
      account_number: updated.bank.accountNumber,
      announcement_enabled: updated.announcement.enabled,
      announcement_text: updated.announcement.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);

  if (writeError) throw writeError;

  cacheSiteSettings(updated);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SITE_SETTINGS_EVENT, { detail: updated }),
    );
  }
  return updated;
}
