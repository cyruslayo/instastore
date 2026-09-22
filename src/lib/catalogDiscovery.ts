import type { Product } from "@/lib/types";

export type CatalogSort = "newest" | "price-asc" | "price-desc";

function newestFirst(a: Product, b: Product): number {
  return (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
}

export function searchProduct(product: Product, rawQuery: string): boolean {
  const terms = rawQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searchableText = `${product.name} ${product.category} ${product.description || ""}`.toLocaleLowerCase();
  return terms.every((term) => searchableText.includes(term));
}

export function filterCatalogProducts(
  products: Product[],
  options: { query: string; category: string; inStockOnly: boolean; sort: CatalogSort },
): Product[] {
  const filtered = products.filter((product) =>
    searchProduct(product, options.query) &&
    (options.category === "all" || product.category === options.category) &&
    (!options.inStockOnly || product.inventory > 0),
  );
  return filtered.sort((a, b) => {
    if (options.sort === "price-asc") return a.price - b.price;
    if (options.sort === "price-desc") return b.price - a.price;
    return newestFirst(a, b);
  });
}

export function getHomeProducts(products: Product[]): Product[] {
  const productsNewestFirst = [...products].sort(newestFirst);
  if (!productsNewestFirst.some((product) => product.featured)) return productsNewestFirst.slice(0, 4);
  return productsNewestFirst.sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 4);
}
