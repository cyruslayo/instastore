"use client";
import { useEffect, useRef, useState } from "react";
import { addItem } from "@/store/cart";
import { formatNaira } from "@/lib/utils";
import type { Product } from "@/lib/types";
import ProductDescription from "@/components/storefront/ProductDescription";
import { trackStoreEvent } from "@/lib/analytics/events";
import { readConsent } from "@/lib/analytics/consent";

export default function ProductDetailIsland({ product, storeId, storeSlug }: { product: Product; storeId: string; storeSlug: string }) {
  const [quantity, setQuantity] = useState(1);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState(false);
  const productViewSent = useRef(false);
  const available = product.inventory > 0 && product.is_active;
  const images = [...new Set([product.image, ...(product.gallery_images || [])].filter((image): image is string => Boolean(image?.trim())))];
  const [currentImage, setCurrentImage] = useState(images[0] || "");
  const salePrice = product.compare_at_price != null && product.compare_at_price > product.price;

  useEffect(() => {
    const reportProductView = () => {
      if (!readConsent()?.analytics || productViewSent.current) return;
      productViewSent.current = true;
      trackStoreEvent("product view", { store_id: storeId, store_slug: storeSlug, product_id: product.id, category: product.category, price: Number(product.price), in_stock: product.inventory > 0 });
    };
    reportProductView();
    window.addEventListener("instastore:consent", reportProductView);
    return () => window.removeEventListener("instastore:consent", reportProductView);
  }, [product.category, product.id, product.inventory, product.price, storeId, storeSlug]);

  const handleAddToCart = () => {
    if (!available) return;
    addItem(storeSlug, {
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      image: currentImage,
      category: product.category,
      sku: product.sku,
      inventory: product.inventory,
    });
    trackStoreEvent("product add", { store_id: storeId, store_slug: storeSlug, product_id: product.id, category: product.category, price: Number(product.price), quantity });
    setAddedNotice(true);
    setTimeout(() => setAddedNotice(false), 2500);
  };

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg md:py-section-gap pb-32 pt-24 md:pt-32">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter lg:gap-section-gap">
        <div className="md:col-span-7 space-y-stack-md">
          <div className="aspect-[4/5] bg-surface-container-low rounded-xl overflow-hidden relative botanical-shadow">
            {currentImage ? <img src={currentImage} alt={product.name} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain" /> : <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant">No image available</div>}
          </div>
          {images.length > 1 && <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Product images">{images.map((image, index) => <button key={image} type="button" onClick={() => setCurrentImage(image)} aria-label={`Show product image ${index + 1}`} aria-pressed={currentImage === image} className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 ${currentImage === image ? "border-store-primary" : "border-transparent"}`}><img src={image} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /></button>)}</div>}
        </div>

        <div className="md:col-span-5 flex flex-col">
          <div className="mb-stack-lg">
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">{product.category}</span>
            <h1 className="font-display-sm md:font-display-md text-display-sm md:text-display-md text-primary mb-stack-sm mt-2">{product.name}</h1>
            <div className="mb-stack-md flex flex-wrap items-center gap-3"><p className="font-body-lg text-body-lg font-semibold text-primary">{formatNaira(product.price)}</p>{salePrice && <><span className="text-body-md text-on-surface-variant line-through">{formatNaira(product.compare_at_price!)}</span><span className="rounded-full bg-store-primary px-3 py-1 text-xs font-bold text-store-on-primary">Sale</span></>}</div>
            <ProductDescription description={product.description || "Product details are managed by the storefront."} />
          </div>

          <div className="space-y-3 mb-stack-lg">
            <div className="flex gap-stack-sm">
              <div className="flex items-center border border-outline-variant rounded-full p-1 bg-surface">
                <button type="button" disabled={!available} onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity" className="touch-target w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container disabled:opacity-40"><MinusIcon /></button>
                <span className="w-12 text-center font-label-lg text-label-lg text-on-surface" aria-live="polite">{quantity}</span>
                <button type="button" disabled={!available || quantity >= product.inventory} onClick={() => setQuantity(Math.min(product.inventory, quantity + 1))} aria-label="Increase quantity" className="touch-target w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container disabled:opacity-40"><PlusIcon /></button>
              </div>
              <button type="button" disabled={!available} onClick={handleAddToCart} className="touch-target min-h-12 flex-1 bg-store-primary text-store-on-primary rounded-full font-label-lg text-label-lg flex items-center justify-center gap-2 hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><BagIcon />{available ? "Add to Bag" : "Sold Out"}</button>
            </div>
            {!available && <p className="font-body-sm text-body-sm text-error">Currently unavailable.</p>}
            {addedNotice && <p className="font-body-sm text-body-sm text-secondary flex items-center gap-1.5 animate-in fade-in"><CheckIcon /> Added to your bag.</p>}
          </div>

          <div className="border-t border-outline-variant/50 pt-stack-md mt-auto">
            <div className="border-b border-outline-variant/30">
              <button type="button" onClick={() => setOpenSection(openSection === "details" ? null : "details")} className="w-full py-4 flex justify-between items-center font-label-md text-label-md text-on-surface hover:text-primary transition-colors uppercase tracking-wider">Product Details <PlusIcon className={`w-4 h-4 transition-transform ${openSection === "details" ? "rotate-45" : ""}`} /></button>
              {openSection === "details" && <p className="pb-4 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">Product information is managed by the storefront.</p>}
            </div>
            <div className="border-b border-outline-variant/30">
              <button type="button" onClick={() => setOpenSection(openSection === "availability" ? null : "availability")} className="w-full py-4 flex justify-between items-center font-label-md text-label-md text-on-surface hover:text-primary transition-colors uppercase tracking-wider">Availability <PlusIcon className={`w-4 h-4 transition-transform ${openSection === "availability" ? "rotate-45" : ""}`} /></button>
              {openSection === "availability" && <p className="pb-4 font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{available ? `${product.inventory} available` : "Currently unavailable"}</p>}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) { return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="M12 5v14" /></svg>; }
function MinusIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>; }
function BagIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>; }
function CheckIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>; }
