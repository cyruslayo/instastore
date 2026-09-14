'use client';
import { useStore } from '@nanostores/react';
import { cartCount } from '@/store/cart';
import { isApproved } from '@/store/access';
import { useHydrated } from '@/lib/useHydrated';

export default function BottomNav({ pathname }: { pathname: string }) {
  const isHydrated = useHydrated();
  const rawCount = useStore(cartCount);
  const rawApproved = useStore(isApproved);

  const approved = isHydrated && rawApproved;
  const count = isHydrated ? rawCount : 0;

  if (pathname.startsWith('/checkout')) return null;

  const active = 'bg-secondary-container text-on-secondary-container scale-95';
  const inactive = 'text-on-surface-variant hover:bg-surface-container-high';

  return (
    <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-xl bg-surface-container-low shadow-[0_-4px_30px_rgba(24,35,26,0.05)] border-t border-outline-variant/10 pb-safe">
      <div className="flex justify-around items-center px-4 py-3">
        <a href="/" aria-current={pathname === '/' ? 'page' : undefined} className={`touch-target flex flex-col items-center justify-center p-3 rounded-full transition-colors ${pathname === '/' ? active : inactive}`}>
          <HomeIcon />
          <span className="font-label-sm text-label-sm">Home</span>
        </a>

        {approved && (
          <>
            <a href="/shop" aria-current={pathname === '/shop' ? 'page' : undefined} className={`touch-target flex flex-col items-center justify-center p-3 rounded-full transition-colors ${pathname === '/shop' ? active : inactive}`}>
              <StoreIcon />
              <span className="font-label-sm text-label-sm">Shop</span>
            </a>
            <a href="/cart" aria-current={pathname === '/cart' ? 'page' : undefined} className={`touch-target flex flex-col items-center justify-center p-3 rounded-full transition-colors ${pathname === '/cart' ? active : inactive}`}>
              <div className="relative">
                <BasketIcon />
                {count > 0 && (
                  <span className="absolute -top-1 -right-2 bg-secondary text-on-secondary rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                    {count}
                  </span>
                )}
              </div>
              <span className="font-label-sm text-label-sm">Bag</span>
            </a>
          </>
        )}

        <a href="/invite" aria-current={pathname.startsWith('/invite') ? 'page' : undefined} className={`touch-target flex flex-col items-center justify-center p-3 rounded-full transition-colors ${pathname.startsWith('/invite') ? active : inactive}`}>
          <UserIcon />
          <span className="font-label-sm text-label-sm">{approved ? 'My Code' : 'Invite'}</span>
        </a>
      </div>
    </nav>
  );
}


function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mb-1">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function StoreIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mb-1">
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mb-1">
      <path d="m15 11-2-2-2 2" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7" />
      <path d="M3 7h18" />
      <path d="M16 11V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 mb-1">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
