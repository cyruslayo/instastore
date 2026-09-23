export interface UmamiTracker {
  track: (name: string, data?: Record<string, unknown>) => void;
}

declare global {
  interface Window { umami?: UmamiTracker; umamiBeforeSend?: (type: string, payload: Record<string, unknown>) => Record<string, unknown> | false; }
}

let loadPromise: Promise<UmamiTracker | null> | null = null;

export function loadUmamiAfterConsent(): Promise<UmamiTracker | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const scriptUrl = import.meta.env.PUBLIC_UMAMI_SCRIPT_URL?.trim();
  const websiteId = import.meta.env.PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!scriptUrl || !websiteId) return Promise.resolve(null);
  if (window.umami) return Promise.resolve(window.umami);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    let script: HTMLScriptElement | null = document.querySelector('script[data-instastore-umami="true"]');
    if (!script) {
      script = document.createElement("script");
      script.defer = true;
      script.src = scriptUrl;
      script.dataset.websiteId = websiteId;
      script.dataset.autoTrack = "false";
      script.dataset.excludeSearch = "true";
      script.dataset.excludeHash = "true";
      script.dataset.instastoreUmami = "true";
      window.umamiBeforeSend = (_type, payload) => {
        const safePayload = { ...payload };
        for (const field of ["url", "referrer"]) {
          const value = safePayload[field];
          if (typeof value !== "string") continue;
          try {
            const url = new URL(value, window.location.origin);
            safePayload[field] = `${url.origin}${url.pathname}`;
          } catch {
            safePayload[field] = "";
          }
        }
        return safePayload;
      };
      script.dataset.beforeSend = "umamiBeforeSend";
      const hostUrl = import.meta.env.PUBLIC_UMAMI_HOST_URL?.trim();
      if (hostUrl) script.dataset.hostUrl = hostUrl;
      document.head.append(script);
    }
    const timeout = window.setTimeout(() => resolve(null), 8000);
    script.addEventListener("load", () => { window.clearTimeout(timeout); resolve(window.umami ?? null); }, { once: true });
    script.addEventListener("error", () => { window.clearTimeout(timeout); resolve(null); }, { once: true });
  });
  return loadPromise;
}
