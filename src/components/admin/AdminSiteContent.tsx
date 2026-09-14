'use client';
import { useEffect, useState } from 'react';
import {
  getSiteSettings,
  saveSiteSettings,
  fetchLiveSiteSettings,
  type SiteSettings,
  DEFAULT_SITE_SETTINGS,
} from '@/lib/siteSettings';
import { CreditCard, Megaphone, Check } from 'lucide-react';

export default function AdminSiteContent() {
  const [activeTab, setActiveTab] = useState<'bank' | 'announcement'>('bank');
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSiteSettings(getSiteSettings());
    fetchLiveSiteSettings()
      .then(setSiteSettings)
      .catch((error) => {
        console.error('Error loading live site settings:', error);
        setSaveError('Live site settings could not be loaded from Supabase.');
      });
  }, []);

  const triggerSavedNotice = (message: string) => {
    setSavedNotice(message);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const save = async (event: React.FormEvent, settings: Partial<SiteSettings>, message: string) => {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await saveSiteSettings(settings);
      setSiteSettings(updated);
      triggerSavedNotice(message);
    } catch (error) {
      console.error('Error saving site settings:', error);
      setSaveError('Site settings could not be saved to Supabase.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 bg-surface-container-lowest border border-outline rounded-xl font-body-sm text-primary focus:border-secondary focus:outline-none';

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="font-label-sm text-[10px] sm:text-xs font-bold uppercase tracking-widest text-secondary block">Storefront CMS</span>
          <h2 className="font-headline-md text-xl sm:text-headline-md text-primary mt-0.5">Site Content</h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-0.5">Manage payment details and optional storefront announcements.</p>
        </div>
        {savedNotice && <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-secondary-container text-secondary text-xs font-mono font-bold"><Check className="w-4 h-4" />{savedNotice}</div>}
        {saveError && <div role="alert" className="px-3.5 py-1.5 rounded-xl bg-error/10 text-error text-xs font-mono font-bold">{saveError}</div>}
      </div>

      <div className="flex items-center gap-2 border-b border-outline-variant/40 pb-2">
        <button type="button" onClick={() => setActiveTab('bank')} className={`px-4 py-2.5 rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold flex items-center gap-2 ${activeTab === 'bank' ? 'bg-primary text-on-primary' : 'border border-outline-variant/60 text-primary'}`}><CreditCard className="w-4 h-4" />Payment &amp; Bank Transfer</button>
        <button type="button" onClick={() => setActiveTab('announcement')} className={`px-4 py-2.5 rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold flex items-center gap-2 ${activeTab === 'announcement' ? 'bg-primary text-on-primary' : 'border border-outline-variant/60 text-primary'}`}><Megaphone className="w-4 h-4" />Announcement</button>
      </div>

      {activeTab === 'bank' && <section className="bg-surface rounded-2xl border border-outline-variant/60 p-6 sm:p-8 botanical-shadow max-w-3xl">
        <h3 className="font-headline-sm text-headline-sm text-primary font-bold mb-1">Checkout Bank Transfer Details</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">These details appear on the checkout page.</p>
        <form onSubmit={(event) => save(event, { bank: siteSettings.bank }, 'Bank details updated.')} className="space-y-5">
          <label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Bank Name</span><input required value={siteSettings.bank.bankName} onChange={(event) => setSiteSettings({ ...siteSettings, bank: { ...siteSettings.bank, bankName: event.target.value } })} className={inputClass} /></label>
          <label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Account Holder / Beneficiary Name</span><input required value={siteSettings.bank.accountName} onChange={(event) => setSiteSettings({ ...siteSettings, bank: { ...siteSettings.bank, accountName: event.target.value } })} className={inputClass} /></label>
          <label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Account Number</span><input required value={siteSettings.bank.accountNumber} onChange={(event) => setSiteSettings({ ...siteSettings, bank: { ...siteSettings.bank, accountNumber: event.target.value } })} className={`${inputClass} font-mono`} /></label>
          <label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Dispatch Note</span><textarea rows={2} value={siteSettings.bank.dispatchNote} onChange={(event) => setSiteSettings({ ...siteSettings, bank: { ...siteSettings.bank, dispatchNote: event.target.value } })} className={inputClass} /></label>
          <button type="submit" disabled={saving} className="px-8 py-3 bg-primary text-on-primary rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold">{saving ? 'Saving...' : 'Save Bank Details'}</button>
        </form>
      </section>}

      {activeTab === 'announcement' && <section className="bg-surface rounded-2xl border border-outline-variant/60 p-6 sm:p-8 botanical-shadow max-w-3xl">
        <h3 className="font-headline-sm text-headline-sm text-primary font-bold mb-1">Storefront Announcement</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">Show an optional announcement at the top of the storefront.</p>
        <form onSubmit={(event) => save(event, { announcement: siteSettings.announcement }, 'Announcement settings updated.')} className="space-y-5">
          <label className="flex items-center gap-3"><input type="checkbox" checked={siteSettings.announcement.enabled} onChange={(event) => setSiteSettings({ ...siteSettings, announcement: { ...siteSettings.announcement, enabled: event.target.checked } })} className="w-5 h-5" /><span className="font-label-sm text-sm text-primary font-bold">Enable announcement</span></label>
          <label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Message</span><input value={siteSettings.announcement.message} onChange={(event) => setSiteSettings({ ...siteSettings, announcement: { ...siteSettings.announcement, message: event.target.value } })} className={inputClass} /></label>
          <div className="grid sm:grid-cols-2 gap-4"><label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Link Label</span><input value={siteSettings.announcement.linkText || ''} onChange={(event) => setSiteSettings({ ...siteSettings, announcement: { ...siteSettings.announcement, linkText: event.target.value } })} className={inputClass} /></label><label className="block space-y-1.5"><span className="font-label-sm text-xs uppercase tracking-wider text-primary font-bold">Link URL</span><input value={siteSettings.announcement.linkUrl || ''} onChange={(event) => setSiteSettings({ ...siteSettings, announcement: { ...siteSettings.announcement, linkUrl: event.target.value } })} className={`${inputClass} font-mono`} /></label></div>
          <button type="submit" disabled={saving} className="px-8 py-3 bg-primary text-on-primary rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold">{saving ? 'Saving...' : 'Save Announcement'}</button>
        </form>
      </section>}
    </div>
  );
}
