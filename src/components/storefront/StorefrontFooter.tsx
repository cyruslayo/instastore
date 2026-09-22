"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_SITE_SETTINGS,
  fetchLiveSiteSettings,
  type SiteSettings,
} from "@/lib/siteSettings";

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
  useEffect(() => {
    fetchLiveSiteSettings(storeSlug)
      .then(setSettings)
      .catch(() => undefined);
  }, [storeSlug]);
  const storeName = settings.storeName.trim() || "Your Store";
  const instagram = instagramUrl(settings.instagramHandle);
  const whatsapp = whatsappUrl(settings.whatsappNumber);
  if (!instagram && !whatsapp) return null;
  return (
    <footer
      className="max-w-container-max mx-auto w-full px-margin-mobile md:px-margin-desktop pb-section-gap"
      aria-label="Store contact links"
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
      </div>
    </footer>
  );
}
