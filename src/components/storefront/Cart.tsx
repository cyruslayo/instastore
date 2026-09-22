'use client';
import { useStore } from '@nanostores/react';
import { cartCountFor, cartItemsFor, cartTotalFor, getCartLineKey, removeItem, updateQuantity } from '@/store/cart';
import { formatNaira } from '@/lib/utils';
import { storePath } from '@/lib/storePaths';
import { useHydrated } from '@/lib/useHydrated';

export default function Cart({ storeSlug }: { storeSlug: string }) {
  const hydrated = useHydrated();
  const items = useStore(cartItemsFor(storeSlug));
  const subtotal = useStore(cartTotalFor(storeSlug));
  const count = useStore(cartCountFor(storeSlug));

  const visibleItems = hydrated ? items : [];
  const visibleSubtotal = hydrated ? subtotal : 0;
  const checkoutHref = storePath(storeSlug, 'checkout');

  return (
    <main className="flex-1 w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-24 md:pt-32 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter lg:gap-margin-desktop">
        <div className="lg:col-span-7">
          <div className="flex items-baseline justify-between mb-stack-sm border-b border-surface-variant pb-stack-sm"><h1 className="font-headline-sm text-headline-sm text-on-surface">Your Bag ({hydrated ? count : 0} items)</h1></div>
          {visibleItems.length === 0 ? <p className="font-body-md text-on-surface-variant py-8">Your bag is empty.</p> : <div>{visibleItems.map((item) => <div key={getCartLineKey(item)} className="flex gap-stack-md py-stack-md border-b border-outline-variant/30">
            <div className="w-24 md:w-32 aspect-[3/4] shrink-0 bg-surface-container rounded-lg overflow-hidden">{item.image && <img src={item.image} alt={item.name} referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />}</div>
            <div className="flex-1"><div className="flex justify-between items-start"><h2 className="font-body-lg text-body-lg text-on-surface">{item.name}</h2><button type="button" onClick={() => removeItem(storeSlug, item.product_id)} aria-label={`Remove ${item.name} from bag`} className="touch-target text-on-surface-variant hover:text-error"><XIcon /></button></div>
              <p className="text-sm text-on-surface-variant">{item.category}{item.sku ? ` · SKU ${item.sku}` : ''}</p><p className="font-headline-sm text-headline-sm text-on-surface mt-2">{formatNaira(item.price)}</p>
              <div className="flex items-center border border-outline-variant rounded-full px-3 py-1 w-fit mt-4"><button type="button" onClick={() => updateQuantity(storeSlug, item.product_id, -1)} aria-label="Decrease quantity"><MinusIcon /></button><span className="w-8 text-center">{item.quantity}</span><button type="button" disabled={item.quantity >= (item.inventory ?? Infinity)} onClick={() => updateQuantity(storeSlug, item.product_id, 1)} aria-label="Increase quantity"><PlusIcon /></button></div>
            </div>
          </div>)}</div>}
        </div>
        <div className="lg:col-span-5 relative mt-section-gap lg:mt-0"><div className="sticky top-24 bg-surface-container-low rounded-xl p-stack-lg border border-surface-variant"><h2 className="font-headline-sm text-headline-sm text-on-surface mb-stack-lg border-b border-outline-variant pb-stack-sm">Order Summary</h2><div className="flex flex-col gap-stack-sm text-on-surface-variant mb-stack-lg"><div className="flex justify-between"><span>Subtotal</span><span>{formatNaira(visibleSubtotal)}</span></div><div className="flex justify-between"><span>Delivery</span><span>Calculated at checkout</span></div></div><a aria-disabled={visibleItems.length === 0} className={`w-full bg-primary text-on-primary py-4 rounded-full font-label-sm uppercase tracking-widest flex items-center justify-center gap-2 ${visibleItems.length === 0 ? 'pointer-events-none opacity-50' : ''}`} href={checkoutHref}>Checkout <ArrowRightIcon /></a></div></div>
      </div>
    </main>
  );
}
function XIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function MinusIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>; }
function PlusIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5v14" /></svg>; }
function ArrowRightIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>; }
