'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { cartCount } from '@/store/cart';
import { useHydrated } from '@/lib/useHydrated';
import { DEFAULT_SITE_SETTINGS, fetchLiveSiteSettings, type SiteSettings } from '@/lib/siteSettings';

export default function Header({ pathname }: { pathname: string }) {
  const hydrated = useHydrated();
  const count = useStore(cartCount);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  useEffect(() => { fetchLiveSiteSettings().then(setSettings).catch(() => undefined); }, []);
  const isCheckout = pathname.startsWith('/checkout');
  const showBack = isCheckout || pathname.startsWith('/cart') || pathname.startsWith('/product');
  const brand = settings.storeName.trim() || 'Your Store';
  return <>
    {settings.announcement.enabled && settings.announcement.message.trim() && <div role="status" className="bg-primary text-on-primary text-center px-4 py-2 font-body-sm text-xs">{settings.announcement.message}</div>}
    <header className="sticky top-0 w-full z-50 backdrop-blur-xl bg-surface/80">
      <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 w-full max-w-container-max mx-auto">
        {showBack ? <button type="button" onClick={() => history.back()} aria-label="Go back" className="touch-target text-primary"><ArrowLeft /></button> : <div className="w-11 md:w-8" />}
        <a href="/" className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg tracking-tighter text-primary text-center flex-1 flex justify-center items-center">{settings.logoUrl.trim() ? <img src={settings.logoUrl} alt={brand} referrerPolicy="no-referrer" className="max-h-10 max-w-[180px] object-contain" /> : brand}</a>
        {isCheckout ? <div className="w-11 md:w-8" /> : <a href="/cart" aria-label={`Bag, ${hydrated ? count : 0} items`} className="touch-target flex items-center justify-center rounded-full text-on-surface-variant relative"><BagIcon />{hydrated && count > 0 && <span className="absolute top-2 right-2 bg-secondary text-on-secondary rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">{count}</span>}</a>}
      </div>
      {!isCheckout && !pathname.startsWith('/cart') && !pathname.startsWith('/product') && <nav className="hidden md:flex justify-center gap-8 py-4 border-t border-outline-variant/20">{[['/','Home'],['/shop','Shop'],['/track','Track Order'],['/cart','Bag']].map(([href,label]) => <a href={href} className={`font-label-sm text-label-sm uppercase tracking-widest ${pathname === href ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`} key={href}>{label}</a>)}</nav>}
    </header>
  </>;
}
function BagIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 0-8 0" /></svg>; }
function ArrowLeft() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7M19 12H5" /></svg>; }
