"use client";
import { useEffect, useState } from "react";
import { Check, CreditCard, Megaphone, Store } from "lucide-react";
import {
  DEFAULT_SITE_SETTINGS,
  fetchLiveSiteSettings,
  getSiteSettings,
  saveSiteSettings,
  type SiteSettings,
} from "@/lib/siteSettings";

export default function AdminSiteContent() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [liveSettingsLoaded, setLiveSettingsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "store" | "commerce" | "announcement"
  >("store");
  const loadLiveSettings = () => {
    setLiveSettingsLoaded(false);
    setError(null);
    fetchLiveSiteSettings()
      .then((liveSettings) => {
        setSettings(liveSettings);
        setLiveSettingsLoaded(true);
      })
      .catch(() => {
        setLiveSettingsLoaded(false);
        setError("Live store settings could not be loaded.");
      });
  };
  useEffect(() => {
    setSettings(getSiteSettings());
    loadLiveSettings();
  }, []);
  const update = <K extends keyof SiteSettings>(
    key: K,
    value: SiteSettings[K],
  ) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!liveSettingsLoaded) {
      setError("Live store settings must load successfully before saving.");
      return;
    }
    setError(null);
    if (!Number.isFinite(settings.deliveryFee) || settings.deliveryFee < 0) {
      setError("Delivery fee must be a non-negative number.");
      return;
    }
    setSaving(true);
    try {
      setSettings(await saveSiteSettings(settings));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (saveError) {
      console.error(saveError);
      setError("Store settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const inputClass =
    "w-full px-4 py-2.5 bg-surface-container-lowest border border-outline rounded-xl font-body-sm text-primary focus:border-secondary focus:outline-none";
  const tabs = [
    { id: "store" as const, label: "Store", icon: Store },
    { id: "commerce" as const, label: "Commerce & Payment", icon: CreditCard },
    { id: "announcement" as const, label: "Announcement", icon: Megaphone },
  ];
  return (
    <form onSubmit={save} className="space-y-6 md:space-y-8">
      <header>
        <span className="font-label-sm text-[10px] sm:text-xs font-bold uppercase tracking-widest text-secondary">
          Storefront settings
        </span>
        <h2 className="font-headline-md text-xl sm:text-headline-md text-primary mt-0.5">
          Store Settings
        </h2>
        <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-0.5">
          Configure the identity and payment details customers see.
        </p>
      </header>
      <fieldset disabled={!liveSettingsLoaded || saving} className="space-y-6 md:space-y-8">
      <div className="flex flex-wrap gap-2 border-b border-outline-variant/40 pb-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2.5 rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold flex items-center gap-2 ${activeTab === id ? "bg-primary text-on-primary" : "border border-outline-variant/60 text-primary"}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
      {activeTab === "store" && (
        <section className="bg-surface rounded-2xl border border-outline-variant/60 p-6 sm:p-8 botanical-shadow max-w-3xl space-y-5">
          <Field
            label="Store name"
            value={settings.storeName}
            onChange={(value) => update("storeName", value)}
            inputClass={inputClass}
            required
          />
          <Field
            label="Tagline"
            value={settings.tagline}
            onChange={(value) => update("tagline", value)}
            inputClass={inputClass}
          />
          <Field
            label="Logo URL"
            value={settings.logoUrl}
            onChange={(value) => update("logoUrl", value)}
            inputClass={inputClass}
            type="url"
          />
          <Field
            label="Instagram handle"
            value={settings.instagramHandle}
            onChange={(value) => update("instagramHandle", value)}
            inputClass={inputClass}
          />
          <Field
            label="WhatsApp number"
            value={settings.whatsappNumber}
            onChange={(value) => update("whatsappNumber", value)}
            inputClass={inputClass}
          />
        </section>
      )}
      {activeTab === "commerce" && (
        <section className="bg-surface rounded-2xl border border-outline-variant/60 p-6 sm:p-8 botanical-shadow max-w-3xl space-y-5">
          <p className="font-body-sm text-xs text-on-surface-variant">
            Delivery pricing is managed under Delivery zones.
          </p>
          <label className="block space-y-1.5">
            <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">
              Currency
            </span>
            <input
              value="NGN"
              readOnly
              className={`${inputClass} opacity-70`}
            />
          </label>
          <Field
            label="Bank name"
            value={settings.bank.bankName}
            onChange={(value) =>
              update("bank", { ...settings.bank, bankName: value })
            }
            inputClass={inputClass}
          />
          <Field
            label="Account name"
            value={settings.bank.accountName}
            onChange={(value) =>
              update("bank", { ...settings.bank, accountName: value })
            }
            inputClass={inputClass}
          />
          <Field
            label="Account number"
            value={settings.bank.accountNumber}
            onChange={(value) =>
              update("bank", { ...settings.bank, accountNumber: value })
            }
            inputClass={`${inputClass} font-mono`}
          />
        </section>
      )}
      {activeTab === "announcement" && (
        <section className="bg-surface rounded-2xl border border-outline-variant/60 p-6 sm:p-8 botanical-shadow max-w-3xl space-y-5">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.announcement.enabled}
              onChange={(event) =>
                update("announcement", {
                  ...settings.announcement,
                  enabled: event.target.checked,
                })
              }
              className="w-5 h-5"
            />
            <span className="font-label-sm text-sm text-primary font-bold">
              Enable announcement
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">
              Announcement message
            </span>
            <textarea
              rows={3}
              value={settings.announcement.message}
              onChange={(event) =>
                update("announcement", {
                  ...settings.announcement,
                  message: event.target.value,
                })
              }
              className={inputClass}
            />
          </label>
        </section>
      )}
      </fieldset>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !liveSettingsLoaded}
          className="px-8 py-3 bg-primary text-on-primary rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold"
        >
          {saving ? "Saving..." : "Save Store Settings"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-2 text-secondary text-xs font-bold">
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
        {error && (
          <span role="alert" className="text-error text-xs font-bold">
            {error}
          </span>
        )}
        {!liveSettingsLoaded && (
          <button type="button" onClick={loadLiveSettings} disabled={saving} className="text-secondary text-xs font-bold underline">
            Retry loading settings
          </button>
        )}
      </div>
    </form>
  );
}
function Field({
  label,
  value,
  onChange,
  inputClass,
  type = "text",
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
  type?: string;
  [key: string]: unknown;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">
        {label}
      </span>
      <input
        {...props}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </label>
  );
}
