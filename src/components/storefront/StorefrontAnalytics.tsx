"use client";

import { useEffect, useRef } from "react";
import { readConsent } from "@/lib/analytics/consent";
import { captureStoreAttribution } from "@/lib/analytics/attribution";
import { pageTypeForPath, syncAnalyticsConsent, trackStoreEvent } from "@/lib/analytics/events";

export default function StorefrontAnalytics({ storeId, storeSlug, pathname }: { storeId: string; storeSlug: string; pathname: string }) {
  const pageviewSent = useRef(false);
  useEffect(() => {
    const sendPageviewIfConsented = () => {
      const consent = readConsent();
      if (!consent) return;
      captureStoreAttribution(storeSlug, consent);
      syncAnalyticsConsent(consent);
      if (!consent.analytics || pageviewSent.current) return;
      pageviewSent.current = true;
      trackStoreEvent("page view", { store_id: storeId, store_slug: storeSlug, page_type: pageTypeForPath(pathname), path: pathname });
    };
    sendPageviewIfConsented();
    window.addEventListener("instastore:consent", sendPageviewIfConsented);
    return () => window.removeEventListener("instastore:consent", sendPageviewIfConsented);
  }, [pathname, storeId, storeSlug]);
  return null;
}
