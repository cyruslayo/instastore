"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "@/components/storefront/ProductCard";
import { filterCatalogProducts, type CatalogSort } from "@/lib/catalogDiscovery";
import type { Product } from "@/lib/types";
import { trackStoreEvent } from "@/lib/analytics/events";
import { readConsent } from "@/lib/analytics/consent";


export default function StoreCatalog({
  storeSlug,
  storeId,
  products,
}: {
  storeSlug: string;
  storeId: string;
  products: Product[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<CatalogSort>("newest");
  const categories = useMemo(() => [...new Set(products.map((p) => p.category.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products]);
  const filtered = useMemo(() => filterCatalogProducts(products, { query, category, inStockOnly, sort }), [category, inStockOnly, products, query, sort]);
  const hasFilters = Boolean(query.trim() || category !== "all" || inStockOnly || sort !== "newest");
  const lastSearch = useRef("");
  const resultCount = useRef(filtered.length);
  resultCount.current = filtered.length;
  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;
    const sendSearch = () => {
      if (!readConsent()?.analytics) return;
      const resultCountValue = resultCount.current;
      const dedupeKey = `${normalizedQuery.toLocaleLowerCase()}|${resultCountValue}`;
      if (lastSearch.current === dedupeKey) return;
      lastSearch.current = dedupeKey;
      trackStoreEvent("search submit", { store_id: storeId, store_slug: storeSlug, query: normalizedQuery.slice(0, 200), result_count: resultCountValue });
    };
    let timer = window.setTimeout(sendSearch, 600);
    const scheduleSearch = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sendSearch, 600);
    };
    window.addEventListener("instastore:consent", scheduleSearch);
    return () => { window.clearTimeout(timer); window.removeEventListener("instastore:consent", scheduleSearch); };
  }, [query, storeId, storeSlug]);

  return (
    <section aria-label="Product catalog" className="space-y-stack-md">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-outline-variant/50 bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-label-sm text-on-surface-variant">
          <span>Search products</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, category, or details" className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-primary focus:border-store-primary focus:outline-none" />
        </label>
        <label className="space-y-1 text-label-sm text-on-surface-variant">
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-primary focus:border-store-primary focus:outline-none"><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        </label>
        <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-outline-variant px-3 py-2.5 text-body-md text-primary">
          <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} className="accent-[var(--store-primary)]" />
          In stock only
        </label>
        <label className="space-y-1 text-label-sm text-on-surface-variant">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)} className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-md text-primary focus:border-store-primary focus:outline-none"><option value="newest">Newest</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option></select>
        </label>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
        <h2 className="font-headline-sm text-headline-sm text-primary">Available Products</h2>
        <span aria-live="polite" className="font-body-sm text-body-sm text-on-surface-variant">{filtered.length} {filtered.length === 1 ? "product" : "products"}</span>
      </div>
      {filtered.length ? <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] items-start gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-gutter">{filtered.map((product) => <ProductCard key={product.id} product={product} storeSlug={storeSlug} />)}</div> : <div className="py-16 text-center"><p className="font-body-md text-body-md text-on-surface-variant">{products.length ? "No products match your search." : "There are no products available right now. Please check back soon."}</p>{products.length > 0 && hasFilters && <button type="button" onClick={() => { setQuery(""); setCategory("all"); setInStockOnly(false); setSort("newest"); }} className="mt-4 min-h-12 rounded-full bg-store-primary px-5 py-2.5 font-label-sm text-sm font-bold text-store-on-primary">Clear filters</button>}</div>}
    </section>
  );
}
