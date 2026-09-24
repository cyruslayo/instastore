"use client";
import { useEffect, useRef, useState } from "react";
import {
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

export default function StorefrontFooter({ initialSettings }: { initialSettings: SiteSettings }) {
  const [settings] = useState<SiteSettings>(initialSettings);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const currentConsent = readConsent();
    setConsent(currentConsent);
    setAnalytics(currentConsent?.analytics ?? false);
    setMarketing(currentConsent?.marketing ?? false);
    setIsOpen(!currentConsent);
    syncAnalyticsConsent(currentConsent ?? { version: CONSENT_VERSION, analytics: false, marketing: false, updatedAt: new Date().toISOString() });
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);
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
        <a href="/privacy" className="underline underline-offset-4">Privacy</a>
        <a href="/terms" className="underline underline-offset-4">Terms</a>
        <a href="/" className="text-on-surface-variant/80 underline-offset-4 hover:text-primary hover:underline">Powered by InstaStore</a>
      </div>
      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        aria-labelledby="privacy-title"
        aria-describedby="privacy-description"
        className="fixed inset-x-3 bottom-3 top-auto m-auto max-h-[min(90dvh,42rem)] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-2xl border border-outline-variant bg-surface p-5 text-on-surface botanical-shadow backdrop:bg-primary/55 md:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="privacy-title" className="font-headline-sm text-on-surface">Your privacy choices</h2>
          <button type="button" onClick={() => setIsOpen(false)} className="touch-target rounded-full border border-outline-variant px-3 py-2 text-sm font-semibold text-primary">Close</button>
        </div>
        <p id="privacy-description" className="mt-3 max-w-prose text-sm leading-relaxed text-on-surface-variant">
          Necessary storage keeps this store and checkout working. Optional analytics and marketing stay off unless you choose them. Your choice does not affect shopping or ordering.
        </p>
        <p className="mt-4 text-sm text-on-surface-variant">Necessary <span className="font-semibold text-primary">Always on</span></p>
        <p className="mt-3 text-sm"><a href="/privacy" className="font-semibold text-primary underline underline-offset-4">Read the Privacy notice</a></p>
        {customize && <fieldset className="my-5 space-y-4 rounded-xl border border-outline-variant p-4">
          <legend className="px-1 font-semibold">Optional choices</legend>
          <label className="flex min-h-11 items-center justify-between gap-4"><span><span className="block font-semibold">Analytics</span><span className="text-sm text-on-surface-variant">Helps understand storefront use.</span></span><input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /></label>
          <label className="flex min-h-11 items-center justify-between gap-4"><span><span className="block font-semibold">Marketing</span><span className="text-sm text-on-surface-variant">Allows advertising-platform attribution identifiers when present. No advertising pixel is loaded.</span></span><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /></label>
        </fieldset>}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => choose(true, true)} className="touch-target rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-primary">Accept all</button>
          <button type="button" onClick={() => choose(false, false)} className="touch-target rounded-full border border-outline-variant px-4 py-3 text-sm font-semibold text-primary">Reject optional</button>
          {customize
            ? <button type="button" onClick={() => choose(analytics, marketing)} className="touch-target rounded-full bg-store-primary px-4 py-3 text-sm font-semibold text-store-on-primary">Save choices</button>
            : <button type="button" onClick={() => setCustomize(true)} className="touch-target rounded-full bg-store-primary px-4 py-3 text-sm font-semibold text-store-on-primary">Customize</button>}
        </div>
      </dialog>
    </footer>
  );
}
