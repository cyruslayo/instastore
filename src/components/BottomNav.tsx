'use client';
import { useStore } from '@nanostores/react';
import { cartCountFor } from '@/store/cart';
import { useHydrated } from '@/lib/useHydrated';
import { storePath } from '@/lib/storePaths';

export default function BottomNav({ pathname, storeSlug }: { pathname: string; storeSlug: string }) {
  const hydrated = useHydrated();
  const count = useStore(cartCountFor(storeSlug));
  if (pathname === storePath(storeSlug, 'checkout')) return null;
  const active = 'bg-secondary-container text-on-secondary-container scale-95';
  const inactive = 'text-on-surface-variant hover:bg-surface-container-high';
  const links = [
    [storePath(storeSlug), 'Home'],
    [storePath(storeSlug, 'shop'), 'Shop'],
    [storePath(storeSlug, 'track'), 'Track Order'],
    [storePath(storeSlug, 'cart'), 'Bag'],
  ] as const;
  return <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-xl bg-surface-container-low shadow-[0_-4px_30px_rgba(24,35,26,0.05)] border-t border-outline-variant/10 pb-safe"><div className="flex justify-around items-center px-2 py-3">{links.map(([href, label]) => <a href={href} aria-current={pathname === href ? 'page' : undefined} className={`touch-target flex flex-col items-center justify-center p-3 rounded-full transition-colors ${pathname === href ? active : inactive}`} key={href}><span className="font-label-sm text-label-sm">{label === 'Bag' && hydrated && count > 0 ? `${label} (${count})` : label}</span></a>)}</div></nav>;
}
