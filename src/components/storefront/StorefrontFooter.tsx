"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_SETTINGS,
  fetchLiveSiteSettings,
  type SiteSettings,
} from "@/lib/siteSettings";
import { CONSENT_VERSION, readConsent, saveConsent, type ConsentRecord } from "@/lib/analytics/consent";
import { syncAnalyticsConsent } from "@/lib/analytics/events";

function instagramUrl(value: string): string | null {
  const handle = value
    .trim()
    .replace(/^@/, "")
    .replace(/[^a-zA-Z0-9._]/g, "");
  return handle ? `https://www.instagram.com/${handle}/` : null;
}
function whatsappUrl(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default function StorefrontFooter({ storeSlug }: { storeSlug: string }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => {
    const currentConsent = readConsent();
    setConsent(currentConsent);
    setAnalytics(currentConsent?.analytics ?? false);
    setMarketing(currentConsent?.marketing ?? false);
    setIsOpen(!currentConsent);
    syncAnalyticsConsent(currentConsent ?? { version: CONSENT_VERSION, analytics: false, marketing: false, updatedAt: new Date().toISOString() });
    fetchLiveSiteSettings(storeSlug)
      .then(setSettings)
      .catch(() => undefined);
  }, [storeSlug]);
  const storeName = settings.storeName.trim() || "Your Store";
  const instagram = instagramUrl(settings.instagramHandle);
  const whatsapp = whatsappUrl(settings.whatsappNumber);
  const choose = (allowAnalytics: boolean, allowMarketing: boolean) => {
    const nextConsent = saveConsent(allowAnalytics, allowMarketing);
    setConsent(nextConsent);
    setAnalytics(nextConsent.analytics);
    setMarketing(nextConsent.marketing);
    setIsOpen(false);
    setCustomize(false);
    syncAnalyticsConsent(nextConsent);
    window.dispatchEvent(new Event("instastore:consent"));
  };
  return (
    <footer
      className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop pb-section-gap"
      aria-label="Store information and privacy choices"
    >
      <div className="border-t border-outline-variant/30 pt-stack-md flex flex-wrap gap-5 font-label-sm text-label-sm text-store-primary">
        <span className="text-on-surface-variant">
          Connect with {storeName}
        </span>
        {instagram && (
          <a href={instagram} target="_blank" rel="noopener noreferrer">
            Instagram ↗
          </a>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp ↗
          </a>
        )}
        <button type="button" onClick={() => { setCustomize(Boolean(consent)); setIsOpen(true); }} className="underline underline-offset-4">Privacy choices</button>
      </div>
      {isOpen && <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-xl rounded-2xl border border-outline-variant bg-surface p-5 botanical-shadow md:bottom-5" role="region" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="font-headline-sm text-on-surface">Privacy choices</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Necessary storage keeps this store working. Optional analytics and marketing remain off unless you choose them.</p>
        <p className="mt-3 text-xs text-on-surface-variant">Necessary <span className="font-semibold text-primary">Always on</span></p>
        {customize && <div className="my-4 space-y-3 text-sm"><label className="flex items-center justify-between gap-4"><span>Analytics</span><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /></label><label className="flex items-center justify-between gap-4"><span>Marketing</span><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /></label></div>}
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => choose(true, true)} className="rounded-full bg-store-primary px-4 py-2 text-xs font-bold text-store-on-primary">Accept all</button><button type="button" onClick={() => choose(false, false)} className="rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-primary">Reject optional</button>{customize ? <button type="button" onClick={() => choose(analytics, marketing)} className="rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-primary">Save choices</button> : <button type="button" onClick={() => setCustomize(true)} className="rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-primary">Customize</button>}</div>
      </div>}
    </footer>
  );
}
