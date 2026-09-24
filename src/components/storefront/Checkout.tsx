"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@nanostores/react";
import { cartItemsFor, cartTotalFor, clearCart } from "@/store/cart";
import { formatNaira } from "@/lib/utils";
import { storePath } from "@/lib/storePaths";
import {
  fetchLiveSiteSettings,
  type SiteSettings,
  DEFAULT_SITE_SETTINGS,
} from "@/lib/siteSettings";
import { getActiveDeliveryZones } from "@/lib/deliveryZones";
import { createStoreOrder, uploadReceipt } from "@/lib/orders";
import { useHydrated } from "@/lib/useHydrated";
import type { DeliveryCity, DeliveryZone } from "@/lib/types";
import { buildOrderAttribution } from "@/lib/analytics/attribution";
import { trackStoreEvent } from "@/lib/analytics/events";
import { readConsent } from "@/lib/analytics/consent";

const RECEIPT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
const CITIES: DeliveryCity[] = ["Abuja", "Lagos"];
const CITY_STATES: Record<DeliveryCity, string> = { Abuja: "FCT", Lagos: "Lagos" };
const DELIVERY_FIELDS = [
  { name: "fullName", label: "Full name *", type: "text", autoComplete: "name", required: true },
  { name: "phone", label: "Phone number *", type: "tel", inputMode: "tel", autoComplete: "tel", required: true },
  { name: "instagramHandle", label: "Instagram handle (optional)", type: "text" },
  { name: "email", label: "Email (optional)", type: "email", inputMode: "email", autoComplete: "email" },
  { name: "address2", label: "Address line 2 (optional)", type: "text", autoComplete: "address-line2" },
  { name: "landmark", label: "Landmark (optional)", type: "text" },
] as const;

function hasBankDetails(settings: SiteSettings): boolean {
  return Boolean(
    settings.bank.bankName.trim() &&
      settings.bank.accountName.trim() &&
      settings.bank.accountNumber.trim(),
  );
}

export default function Checkout({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const hydrated = useHydrated();
  const items = useStore(cartItemsFor(storeSlug));
  const cartSubtotal = useStore(cartTotalFor(storeSlug));
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [zonesLoaded, setZonesLoaded] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    address: "",
    address2: "",
    landmark: "",
    city: "" as "" | DeliveryCity,
    zoneId: "",
    instagramHandle: "",
    email: "",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const checkoutStarted = useRef(false);

  useEffect(() => {
    fetchLiveSiteSettings(storeSlug)
      .then((value) => {
        setSettings(value);
        setSettingsLoaded(true);
      })
      .catch(() =>
        setSettingsError(
          "Store settings are unavailable. Please try again later.",
        ),
      );
  }, [storeSlug]);

  useEffect(() => {
    getActiveDeliveryZones(storeSlug)
      .then(setZones)
      .finally(() => setZonesLoaded(true));
  }, [storeSlug]);

  const visibleItems = hydrated ? items : [];
  const subtotal = hydrated ? cartSubtotal : 0;
  useEffect(() => {
    const reportCheckoutStart = () => {
      if (!hydrated || items.length === 0 || !readConsent()?.analytics || checkoutStarted.current) return;
      checkoutStarted.current = true;
      trackStoreEvent('checkout start', { store_id: storeId, store_slug: storeSlug, item_count: items.reduce((count, item) => count + item.quantity, 0), subtotal });
    };
    reportCheckoutStart();
    window.addEventListener('instastore:consent', reportCheckoutStart);
    return () => window.removeEventListener('instastore:consent', reportCheckoutStart);
  }, [checkoutStarted, hydrated, items, storeId, storeSlug, subtotal]);
  const cityZones = useMemo(
    () => (form.city ? zones.filter((zone) => zone.city === form.city) : []),
    [zones, form.city],
  );
  const selectedZone = useMemo(
    () => cityZones.find((zone) => zone.id === form.zoneId) ?? null,
    [cityZones, form.zoneId],
  );
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : null;
  const total = deliveryFee === null ? null : subtotal + deliveryFee;
  const settingsReady = settingsLoaded && !settingsError && hasBankDetails(settings);
  const detailsReady = Boolean(
    form.fullName.trim() &&
      form.phone.trim() &&
      form.address.trim() &&
      form.city,
  );
  const receiptReady = Boolean(receiptFile || receiptPath);
  const checkoutReady =
    settingsReady &&
    visibleItems.length > 0 &&
    Boolean(selectedZone) &&
    detailsReady &&
    receiptReady;
  const updateForm = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) =>
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));

  const handleCityChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const city = event.target.value as "" | DeliveryCity;
    setForm((current) => ({ ...current, city, zoneId: "" }));
  };

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (
      !RECEIPT_TYPES.includes(file.type as (typeof RECEIPT_TYPES)[number]) ||
      file.size > 5242880
    ) {
      setError(
        "Receipt must be a JPEG, PNG, or PDF file no larger than 5 MiB.",
      );
      return;
    }
    setReceiptFile(file);
    setReceiptPath(null);
    setPreviewUrl(
      file.type === "application/pdf" ? null : URL.createObjectURL(file),
    );
    setError(null);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const submit = async () => {
    if (!settingsReady) {
      setError(settingsError || "Store payment settings are unavailable.");
      return;
    }
    if (!visibleItems.length) {
      setError("Your bag is empty.");
      return;
    }
    if (!selectedZone) {
      setError("Please select a valid delivery zone.");
      return;
    }
    if (!detailsReady) {
      setError(
        "Please complete your full name, phone number, city, and delivery address.",
      );
      return;
    }
    if (total === null) {
      setError("Delivery could not be calculated for the selected zone.");
      return;
    }
    if (!receiptFile && !receiptPath) {
      setError("Please upload your payment receipt.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let uploadedPath = receiptPath;
      if (!uploadedPath && receiptFile) {
        uploadedPath = await uploadReceipt(receiptFile, storeSlug);
        setReceiptPath(uploadedPath);
      }
      if (!uploadedPath)
        throw new Error("Receipt upload did not return a path.");
      const code = await createStoreOrder({
        customerName: form.fullName.trim(),
        customerPhone: form.phone.trim(),
        customerInstagram: form.instagramHandle.trim() || undefined,
        items: visibleItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
        })),
        total,
        shippingAddress: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city,
          state: form.city ? CITY_STATES[form.city] : "",
          instagramHandle: form.instagramHandle.trim() || undefined,
          email: form.email.trim() || undefined,
          address2: form.address2.trim() || undefined,
          landmark: form.landmark.trim() || undefined,
        },
        receiptPath: uploadedPath,
        storeSlug,
        deliveryZoneId: selectedZone.id,
        attribution: buildOrderAttribution(storeSlug),
      });
      trackStoreEvent('order submit', { store_id: storeId, store_slug: storeSlug, item_count: visibleItems.reduce((count, item) => count + item.quantity, 0), subtotal });
      setTrackingCode(code);
      clearCart(storeSlug);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "We could not submit your order. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (trackingCode)
    return (
      <main className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop pt-32 pb-24 text-center">
        <h1 className="font-headline-md text-headline-md text-primary mb-4">
          Order received
        </h1>
        <p className="text-on-surface-variant mb-6">
          Save this tracking code to check your order status.
        </p>
        <p className="font-mono text-2xl font-bold text-primary mb-8">
          {trackingCode}
        </p>
        <a
          href={`${storePath(storeSlug, "track")}?order=${encodeURIComponent(trackingCode)}`}
          className="inline-flex px-6 py-3 bg-primary text-on-primary rounded-full"
        >
          Track Order
        </a>
      </main>
    );

  const noZones = zonesLoaded && zones.length === 0;
  const checkoutAvailabilityMessage = settingsError
    ? settingsError
    : !settingsLoaded || !zonesLoaded
      ? "Store settings are loading. Checkout will be available when they are ready."
      : noZones
        ? "Delivery is not configured for this store yet."
        : !hasBankDetails(settings)
          ? "Checkout is temporarily unavailable because payment details have not been configured."
          : null;

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-24 md:pt-32 pb-32">
      <h1 className="font-headline-lg text-headline-lg text-primary mb-stack-lg">
        Guest Checkout
      </h1>
      {checkoutAvailabilityMessage && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-error/30 bg-error/10 p-4 text-error"
        >
          {checkoutAvailabilityMessage}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30">
            <h2 className="font-headline-sm text-headline-sm mb-5">
              Delivery Details
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DELIVERY_FIELDS.map((field) => (
                <label
                  key={field.name}
                  htmlFor={`checkout-${field.name}`}
                  className="space-y-2 text-sm text-on-surface-variant"
                >
                  {field.label}
                  <input
                    id={`checkout-${field.name}`}
                    name={field.name}
                    type={field.type}
                    inputMode={"inputMode" in field ? field.inputMode : undefined}
                    autoComplete={"autoComplete" in field ? field.autoComplete : undefined}
                    required={"required" in field ? field.required : undefined}
                    value={form[field.name]}
                    onChange={updateForm}
                    className="w-full min-h-12 p-3 bg-surface border border-outline rounded-lg text-base sm:text-sm text-primary"
                  />
                </label>
              ))}
              <label htmlFor="checkout-city" className="space-y-2 text-sm text-on-surface-variant">
                City *
                <select
                  id="checkout-city"
                  name="city"
                  autoComplete="address-level2"
                  required
                  value={form.city}
                  onChange={handleCityChange}
                  className="w-full min-h-12 p-3 bg-surface border border-outline rounded-lg text-base sm:text-sm text-primary"
                >
                  <option value="">Select city</option>
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="checkout-zone" className="space-y-2 text-sm text-on-surface-variant">
                Delivery zone *
                <select
                  id="checkout-zone"
                  name="zoneId"
                  required
                  value={form.zoneId}
                  onChange={updateForm}
                  disabled={!form.city || cityZones.length === 0}
                  className="w-full min-h-12 p-3 bg-surface border border-outline rounded-lg text-base sm:text-sm text-primary disabled:opacity-60"
                >
                  <option value="">
                    {form.city
                      ? cityZones.length > 0
                        ? "Select delivery zone"
                        : "No zones for this city"
                      : "Select a city first"}
                  </option>
                  {cityZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {formatNaira(zone.fee)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label htmlFor="checkout-address" className="block space-y-2 text-sm text-on-surface-variant mt-4">
              Delivery address *
              <textarea
                id="checkout-address"
                name="address"
                rows={3}
                autoComplete="street-address"
                required
                value={form.address}
                onChange={updateForm}
                className="w-full min-h-24 p-3 bg-surface border border-outline rounded-lg text-base sm:text-sm text-primary"
              />
            </label>
            {selectedZone && (
              <div className="mt-4 rounded-lg bg-surface p-4 text-sm space-y-1">
                <p>Provider: {selectedZone.provider}</p>
                <p>Delivery fee: {formatNaira(selectedZone.fee)}</p>
                {selectedZone.estimate && (
                  <p>Estimated delivery: {selectedZone.estimate}</p>
                )}
                {selectedZone.note && <p>{selectedZone.note}</p>}
              </div>
            )}
          </section>
          <section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30">
            <h2 className="font-headline-sm text-headline-sm mb-5">
              Bank Transfer
            </h2>
            <p className="text-sm text-on-surface-variant mb-4">
              Transfer{" "}
              {total === null ? "the displayed total" : formatNaira(total)} to:
            </p>
            {settingsReady ? (
              <div className="space-y-2 bg-surface p-4 rounded-lg">
                <p>Bank: {settings.bank.bankName}</p>
                <p>Account name: {settings.bank.accountName}</p>
                <p>Account number: {settings.bank.accountNumber}</p>
              </div>
            ) : (
              <p className="text-sm text-error">
                Payment details are unavailable.
              </p>
            )}
            <label htmlFor="checkout-receipt" className="block mt-5 text-sm text-on-surface-variant">
              Payment receipt
              <input
                id="checkout-receipt"
                name="receipt"
                type="file"
                required
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFile}
                className="block min-h-12 w-full mt-2 text-base sm:text-sm"
              />
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Receipt preview"
                  className="max-h-48 mt-3 rounded"
                />
              )}
              {receiptFile?.type === "application/pdf" && (
                <p className="mt-3">PDF selected: {receiptFile.name}</p>
              )}
            </label>
          </section>
        </div>
        <aside className="lg:col-span-4 bg-surface-container rounded-xl p-6 h-fit sticky top-24">
          <h2 className="font-headline-sm mb-5">Order Summary</h2>
          {visibleItems.map((item) => (
            <div
              key={item.product_id}
              className="flex justify-between py-2 text-sm"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatNaira(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-outline-variant mt-4 pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatNaira(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>
                {deliveryFee === null
                  ? "Select a zone"
                  : formatNaira(deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{total === null ? "Unavailable" : formatNaira(total)}</span>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-error text-sm mt-4">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !checkoutReady}
            className="min-h-12 w-full mt-6 py-4 bg-primary text-on-primary rounded-full disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Order"}
          </button>
        </aside>
      </div>
    </main>
  );
}
