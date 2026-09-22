import type { Product } from "@/lib/types";
import { formatNaira } from "@/lib/utils";

export default function ProductCard({
  product,
  storeSlug,
}: {
  product: Product;
  storeSlug: string;
}) {
  const onSale = product.compare_at_price != null && product.compare_at_price > product.price;
  return (
    <a href={`/s/${storeSlug}/product/${product.slug}`} className="group block cursor-pointer">
      <div className="relative mb-stack-md aspect-[3/4] overflow-hidden rounded-xl bg-surface-container-low botanical-shadow transition-transform duration-500 group-hover:-translate-y-1">
        {product.image ? <img src={product.image} alt={product.name} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-surface-container-highest text-on-surface-variant">No Image</div>}
        {onSale && <span className="absolute left-3 top-3 rounded-full bg-store-primary px-3 py-1 font-label-sm text-xs font-bold text-store-on-primary">Sale</span>}
        {product.inventory < 1 && <span className="absolute bottom-3 left-3 rounded-full bg-surface px-3 py-1 font-label-sm text-xs font-bold text-on-surface">Sold out</span>}
      </div>
      <div className="px-2 text-center">
        <h3 className="mb-unit font-headline-sm text-headline-sm text-primary">{product.name}</h3>
        {product.description && <p className="mb-stack-sm truncate font-body-md text-body-md text-on-surface-variant">{product.description}</p>}
        <div className="flex flex-wrap items-center justify-center gap-2 font-body-lg text-body-lg">
          <span className="text-primary">{formatNaira(product.price)}</span>
          {onSale && <span className="text-sm text-on-surface-variant line-through">{formatNaira(product.compare_at_price!)}</span>}
        </div>
      </div>
    </a>
  );
}
