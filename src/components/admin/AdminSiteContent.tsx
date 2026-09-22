"use client";
import { useEffect, useState } from "react";
import { Check, CreditCard, Megaphone, Store } from "lucide-react";
import { deleteManagedStoreAsset, uploadStoreHero, uploadStoreLogo } from "@/lib/storeAssets";
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeHero, setRemoveHero] = useState(false);
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
    if (!/^#[0-9a-fA-F]{6}$/.test(settings.primaryColor)) {
      setError("Primary color must be a six-digit hex value, such as #18231a.");
      return;
    }
    setSaving(true);
    const uploadedAssets: string[] = [];
    try {
      const nextSettings = { ...settings };
      if (logoFile) { nextSettings.logoUrl = await uploadStoreLogo(logoFile); uploadedAssets.push(nextSettings.logoUrl); }
      else if (removeLogo) nextSettings.logoUrl = "";
      if (heroFile) { nextSettings.heroImageUrl = await uploadStoreHero(heroFile); uploadedAssets.push(nextSettings.heroImageUrl); }
      else if (removeHero) nextSettings.heroImageUrl = "";
      const savedSettings = await saveSiteSettings(nextSettings);
      const removedAssets = [settings.logoUrl !== savedSettings.logoUrl ? settings.logoUrl : "", settings.heroImageUrl !== savedSettings.heroImageUrl ? settings.heroImageUrl : ""].filter(Boolean);
      let cleanupFailed = false;
      for (const asset of removedAssets) {
        try { await deleteManagedStoreAsset(asset); } catch (cleanupError) { cleanupFailed = true; console.warn("Settings saved, but an old managed store image could not be cleaned up.", cleanupError); }
      }
      setSettings(savedSettings);
      setLogoFile(null); setHeroFile(null); setRemoveLogo(false); setRemoveHero(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
      if (cleanupFailed) setError("Settings saved, but one or more old images could not be cleaned up.");
    } catch (saveError) {
      for (const asset of uploadedAssets) {
        try { await deleteManagedStoreAsset(asset); } catch (cleanupError) { console.warn("Unable to clean up an uncommitted store image.", cleanupError); }
      }
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Store settings could not be saved.");
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
          <label className="block space-y-1.5">
            <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Store description</span>
            <textarea rows={4} value={settings.description} onChange={(event) => update("description", event.target.value)} className={inputClass} />
          </label>
          <AssetField label="Logo" value={settings.logoUrl} removed={removeLogo} file={logoFile} onFile={setLogoFile} onRemove={() => { setRemoveLogo(true); setLogoFile(null); }} onUndoRemove={() => setRemoveLogo(false)} inputClass={inputClass} />
          <AssetField label="Hero image" value={settings.heroImageUrl} removed={removeHero} file={heroFile} onFile={setHeroFile} onRemove={() => { setRemoveHero(true); setHeroFile(null); }} onUndoRemove={() => setRemoveHero(false)} inputClass={inputClass} />
          <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
            <label className="block space-y-1.5">
              <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Primary brand color</span>
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(settings.primaryColor) ? settings.primaryColor : "#18231a"} onChange={(event) => update("primaryColor", event.target.value.toLowerCase())} className="h-11 w-20 cursor-pointer rounded-lg border border-outline bg-surface p-1" />
            </label>
            <Field label="Hex value" value={settings.primaryColor} onChange={(value) => update("primaryColor", value)} inputClass={inputClass} maxLength={7} placeholder="#18231a" />
          </div>
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

function AssetField({ label, value, removed, file, onFile, onRemove, onUndoRemove, inputClass }: {
  label: string; value: string; removed: boolean; file: File | null;
  onFile: (file: File | null) => void; onRemove: () => void; onUndoRemove: () => void; inputClass: string;
}) {
  return <div className="space-y-3">
    <span className="block font-label-sm text-xs uppercase tracking-wider text-primary font-bold">{label}</span>
    {value && !removed && <img src={value} alt={`${label} preview`} referrerPolicy="no-referrer" className="max-h-32 max-w-56 rounded-xl border border-outline-variant object-contain" />}
    {file && <p className="text-xs text-on-surface-variant">Selected: {file.name}</p>}
    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onFile(event.target.files?.[0] || null)} className={`${inputClass} file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container file:px-3 file:py-1`} />
    <p className="text-label-sm text-on-surface-variant">JPEG, PNG, or WebP. Maximum 5 MiB.</p>
    {removed ? <button type="button" onClick={onUndoRemove} className="text-xs text-secondary underline">Keep existing {label.toLowerCase()}</button> : value && <button type="button" onClick={onRemove} className="text-xs text-error underline">Remove {label.toLowerCase()}</button>}
  </div>;
}
