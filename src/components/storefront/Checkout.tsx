'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartItems, cartTotal, clearCart } from '@/store/cart';
import { formatNaira } from '@/lib/utils';
import { fetchLiveSiteSettings, type SiteSettings, DEFAULT_SITE_SETTINGS } from '@/lib/siteSettings';
import { createStoreOrder, uploadReceipt } from '@/lib/orders';
import { useHydrated } from '@/lib/useHydrated';

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;

function hasBankDetails(settings: SiteSettings): boolean {
  return Boolean(settings.bank.bankName.trim() && settings.bank.accountName.trim() && settings.bank.accountNumber.trim());
}

export default function Checkout() {
  const hydrated = useHydrated();
  const items = useStore(cartItems);
  const cartSubtotal = useStore(cartTotal);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', address: '', address2: '', landmark: '', city: '', state: '', instagramHandle: '', email: '' });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);

  useEffect(() => {
    fetchLiveSiteSettings().then((value) => { setSettings(value); setSettingsLoaded(true); }).catch(() => setSettingsError('Store settings are unavailable. Please try again later.'));
  }, []);

  const visibleItems = hydrated ? items : [];
  const subtotal = hydrated ? cartSubtotal : 0;
  const deliveryFee = settingsLoaded ? settings.deliveryFee : null;
  const total = deliveryFee === null ? null : subtotal + deliveryFee;
  const updateForm = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!RECEIPT_TYPES.includes(file.type as (typeof RECEIPT_TYPES)[number]) || file.size > 5242880) { setError('Receipt must be a JPEG, PNG, or PDF file no larger than 5 MiB.'); return; }
    setReceiptFile(file); setReceiptPath(null); setPreviewUrl(file.type === 'application/pdf' ? null : URL.createObjectURL(file)); setError(null);
  };

  const submit = async () => {
    if (!settingsLoaded || !hasBankDetails(settings) || total === null) { setError(settingsError || 'Store payment settings are unavailable.'); return; }
    if (!visibleItems.length) { setError('Your bag is empty.'); return; }
    if (!form.fullName.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim() || !form.state.trim()) { setError('Please complete your full name, phone, address, city, and state.'); return; }
    if (!receiptFile && !receiptPath) { setError('Please upload your payment receipt.'); return; }
    setSubmitting(true); setError(null);
    try {
      let uploadedPath = receiptPath;
      if (!uploadedPath && receiptFile) { uploadedPath = await uploadReceipt(receiptFile); setReceiptPath(uploadedPath); }
      if (!uploadedPath) throw new Error('Receipt upload did not return a path.');
      const code = await createStoreOrder({ customerName: form.fullName.trim(), customerPhone: form.phone.trim(), customerInstagram: form.instagramHandle.trim() || undefined, items: visibleItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity })), total, shippingAddress: { ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), instagramHandle: form.instagramHandle.trim() || undefined, email: form.email.trim() || undefined, address2: form.address2.trim() || undefined, landmark: form.landmark.trim() || undefined }, receiptPath: uploadedPath });
      setTrackingCode(code); clearCart();
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'We could not submit your order. Please try again.'); }
    finally { setSubmitting(false); }
  };

  if (trackingCode) return <main className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop pt-32 pb-24 text-center"><h1 className="font-headline-md text-headline-md text-primary mb-4">Order received</h1><p className="text-on-surface-variant mb-6">Save this tracking code to check your order status.</p><p className="font-mono text-2xl font-bold text-primary mb-8">{trackingCode}</p><a href={`/track?order=${encodeURIComponent(trackingCode)}`} className="inline-flex px-6 py-3 bg-primary text-on-primary rounded-full">Track Order</a></main>;

  return <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-24 md:pt-32 pb-32"><h1 className="font-headline-lg text-headline-lg text-primary mb-stack-lg">Guest Checkout</h1><div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter"><div className="lg:col-span-8 space-y-6"><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30"><h2 className="font-headline-sm text-headline-sm mb-5">Delivery Details</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[['fullName','Full name *'],['phone','Phone number *'],['city','City *'],['state','State *'],['instagramHandle','Instagram handle (optional)'],['email','Email (optional)'],['address2','Address line 2 (optional)'],['landmark','Landmark (optional)']].map(([name,label]) => <label key={name} className="space-y-2 text-sm text-on-surface-variant">{label}<input name={name} value={form[name as keyof typeof form]} onChange={updateForm} className="w-full min-h-11 p-3 bg-surface border border-outline rounded-lg text-primary" /></label>)}</div><label className="block space-y-2 text-sm text-on-surface-variant mt-4">Delivery address *<textarea name="address" rows={3} value={form.address} onChange={updateForm} className="w-full p-3 bg-surface border border-outline rounded-lg text-primary" /></label></section><section className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/30"><h2 className="font-headline-sm text-headline-sm mb-5">Bank Transfer</h2><p className="text-sm text-on-surface-variant mb-4">Transfer {total === null ? 'the displayed total' : formatNaira(total)} to:</p><div className="space-y-2 bg-surface p-4 rounded-lg"><p>Bank: {settings.bank.bankName}</p><p>Account name: {settings.bank.accountName}</p><p>Account number: {settings.bank.accountNumber}</p></div><label className="block mt-5 text-sm text-on-surface-variant">Payment receipt<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleFile} className="block mt-2" />{previewUrl && <img src={previewUrl} alt="Receipt preview" className="max-h-48 mt-3 rounded" />}{receiptFile?.type === 'application/pdf' && <p className="mt-3">PDF selected: {receiptFile.name}</p>}</label></section></div><aside className="lg:col-span-4 bg-surface-container rounded-xl p-6 h-fit sticky top-24"><h2 className="font-headline-sm mb-5">Order Summary</h2>{visibleItems.map((item) => <div key={item.product_id} className="flex justify-between py-2 text-sm"><span>{item.name} × {item.quantity}</span><span>{formatNaira(item.price * item.quantity)}</span></div>)}<div className="border-t border-outline-variant mt-4 pt-4 space-y-2"><div className="flex justify-between"><span>Subtotal</span><span>{formatNaira(subtotal)}</span></div><div className="flex justify-between"><span>Delivery</span><span>{deliveryFee === null ? 'Unavailable' : formatNaira(deliveryFee)}</span></div><div className="flex justify-between font-bold text-lg"><span>Total</span><span>{total === null ? 'Unavailable' : formatNaira(total)}</span></div></div>{error && <p role="alert" className="text-error text-sm mt-4">{error}</p>}<button type="button" onClick={submit} disabled={submitting || total === null} className="w-full mt-6 py-4 bg-primary text-on-primary rounded-full disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit Order'}</button></aside></div></main>;
}
