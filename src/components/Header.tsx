'use client';
import { useStore } from '@nanostores/react';
import { cartCount } from '@/store/cart';
import { isApproved } from '@/store/access';
import AccessStatusBanner from '@/components/storefront/AccessStatusBanner';
import { useHydrated } from '@/lib/useHydrated';

export default function Header({ pathname }: { pathname: string }) {
  const isHydrated = useHydrated();
  const rawCount = useStore(cartCount);
  const rawApproved = useStore(isApproved);

  const approved = isHydrated && rawApproved;
  const count = isHydrated ? rawCount : 0;

  const isCheckout = pathname.startsWith('/checkout');
  const isProduct = pathname.startsWith('/product');
  const isCart = pathname.startsWith('/cart');

  const showBackButton = isCheckout || isCart || isProduct;

  return (
    <header className="sticky top-0 w-full z-50 backdrop-blur-xl bg-surface/80">
      <AccessStatusBanner />
      <div className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 w-full max-w-container-max mx-auto">
        {showBackButton ? (
          <button
            type="button"
            onClick={() => history.back()}
            aria-label="Go back"
            className="touch-target flex items-center justify-center rounded-full text-primary hover:opacity-70 transition-opacity scale-102 active:scale-98 transition-transform duration-300"
          >
            <ArrowLeft />
          </button>
        ) : (
          <div className="w-11 md:w-8"></div>
        )}

        <a href="/" className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg tracking-tighter text-primary text-center flex-1">
          INSTASTORE
        </a>

        {isCheckout ? (
          <div className="w-11 md:w-8"></div>
        ) : approved ? (
          <a href="/cart" aria-label={`Cart, ${count} items`} className="touch-target flex items-center justify-center rounded-full text-on-surface-variant hover:scale-105 transition-transform duration-300 active:opacity-80 transition-opacity relative">
            <BagIcon />
            {count > 0 && (
              <span className="absolute top-2 right-2 bg-secondary text-on-secondary rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                {count}
              </span>
            )}
          </a>
        ) : (
          <div className="w-11 md:w-8"></div>
        )}
      </div>

      {!isCheckout && !isCart && !isProduct && (
        <nav className="hidden md:flex justify-center gap-8 py-4 border-t border-outline-variant/20">
          <a href="/" className={`font-label-sm text-label-sm uppercase tracking-widest transition-colors ${pathname === '/' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>
            Home
          </a>
          {approved && (
            <>
              <a href="/shop" className={`font-label-sm text-label-sm uppercase tracking-widest transition-colors ${pathname === '/shop' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>
                Shop
              </a>
            </>
          )}
          <a href="/invite" className={`font-label-sm text-label-sm uppercase tracking-widest transition-colors ${pathname.startsWith('/invite') ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>
            {approved ? 'My Referral' : 'Member Access'}
          </a>
        </nav>
      )}
    </header>
  );
}


function BagIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}
