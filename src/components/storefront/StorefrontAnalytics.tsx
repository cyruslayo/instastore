"use client";

import { useEffect, useRef } from "react";
import { CONSENT_EVENT, readConsent } from "@/lib/analytics/consent";
import { captureStoreAttribution } from "@/lib/analytics/attribution";
import { pageTypeForPath, trackStoreEvent } from "@/lib/analytics/events";

export default function StorefrontAnalytics({ storeId, storeSlug, pathname }: { storeId: string; storeSlug: string; pathname: string }) {
  const pageviewSent = useRef(false);
  useEffect(() => {
    const sendPageviewIfConsented = () => {
      const consent = readConsent(storeId);
      if (!consent) return;
      captureStoreAttribution({ store_id: storeId, store_slug: storeSlug }, consent);
      if (!(consent.analytics || consent.marketing) || pageviewSent.current) return;
      pageviewSent.current = true;
      trackStoreEvent("page view", { store_id: storeId, store_slug: storeSlug, page_type: pageTypeForPath(pathname), path: pathname });
    };
    sendPageviewIfConsented();
    window.addEventListener(CONSENT_EVENT, sendPageviewIfConsented);
    return () => window.removeEventListener(CONSENT_EVENT, sendPageviewIfConsented);
  }, [pathname, storeId, storeSlug]);
  return null;
}
