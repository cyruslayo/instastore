"use client";
import { useState, useEffect, useCallback } from "react";
import ProductFormModal from "@/components/admin/ProductFormModal";
import { formatNaira } from "@/lib/utils";
import { deleteManagedProductImage } from "@/lib/productImages";
import type { Product } from "@/lib/types";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<any | null>(null);

  async function handleDeleteConfirm() {
    if (!productToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      const { getSupabase } = await import("@/lib/supabase");
      const supabase = getSupabase();
      if (!productToDelete.id)
        throw new Error("The selected product has no database ID.");
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productToDelete.id);
      if (error) throw error;
      setProducts(products.filter((p) => p.id !== productToDelete.id));
      const imageUrl = productToDelete.image;
      setProductToDelete(null);
      if (imageUrl) {
        try {
          await deleteManagedProductImage(imageUrl);
        } catch (cleanupError) {
          console.warn(
            "Product deleted, but its managed image could not be cleaned up.",
            cleanupError,
          );
          setError("Product deleted, but its image cleanup failed.");
        }
      }
    } catch (error) {
      console.error("Error deleting product: ", error);
      setError("The product could not be deleted from Supabase.");
    } finally {
      setIsDeleting(false);
    }
  }

  const existingCategories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean)),
  );

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getSupabase } = await import("@/lib/supabase");
      const { getCurrentAdminProfile } = await import("@/lib/auth");
      const supabase = getSupabase();
      const profile = await getCurrentAdminProfile();
      if (!profile) throw new Error("No active merchant store.");
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", profile.store_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data ?? []);
    } catch (error) {
      console.error("Error fetching products: ", error);
      setProducts([]);
      setError("Products could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddClick = () => {
    setProductToEdit(null);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setProductToEdit(product);
    setIsFormModalOpen(true);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-xl sm:text-headline-md text-on-surface">
            Products
          </h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
            Manage your product catalog and stock levels.
          </p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-xs w-full sm:w-auto shrink-0 cursor-pointer"
        >
          <PlusIcon />
          <span>Add Product</span>
        </button>
      </div>

      {error && !loading && (
        <div className="p-8 text-center text-on-surface-variant bg-surface rounded-2xl border border-error/30">
          {error}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-outline-variant/60 botanical-shadow flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search products by title or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 focus:outline-none focus:border-primary text-primary placeholder:text-on-surface-variant/60"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedCategory === "All"
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            All ({products.length})
          </button>
          {existingCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-mono font-bold transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card List (< md screens) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm bg-surface rounded-2xl border border-outline-variant">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm bg-surface rounded-2xl border border-outline-variant">
            No products match your search.
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-surface rounded-2xl border border-outline-variant/70 p-4 botanical-shadow space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="relative w-14 h-14 rounded-xl bg-surface-container overflow-hidden shrink-0">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant text-[10px] font-mono">
                      No Img
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-surface-container text-secondary font-bold truncate">
                      {product.category || "General"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        product.is_active
                          ? "bg-secondary-container text-on-secondary-container"
                          : "bg-surface-variant text-on-surface-variant"
                      }`}
                    >
                      {product.is_active ? "Active" : "Draft"}
                    </span>
                  </div>

                  <h3 className="font-body-md font-bold text-primary text-sm mt-1 truncate">
                    {product.name}
                  </h3>

                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono font-bold text-primary text-sm">
                      {formatNaira(product.price)}
                    </span>
                    <span
                      className={`font-mono text-[11px] ${
                        product.inventory < 10
                          ? "text-error font-bold"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {product.inventory} in stock
                    </span>
                  </div>
                  <ProductMetadata product={product} />
                </div>
              </div>

              {/* Action Toolbar on Mobile Card */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/40">
                <button
                  onClick={() => handleEditClick(product)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high text-primary hover:bg-surface-container text-xs font-semibold transition-colors cursor-pointer"
                >
                  <EditIcon />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setProductToDelete(product)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <TrashIcon />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (>= md screens) */}
      <div className="hidden md:block bg-surface rounded-2xl border border-outline-variant overflow-hidden botanical-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr className="border-b border-outline-variant">
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                  Product
                </th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                  Category
                </th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                  Price
                </th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                  Inventory
                </th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">
                  Status
                </th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="font-body-md text-sm text-on-surface divide-y divide-outline-variant/50">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-on-surface-variant"
                  >
                    Loading products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-on-surface-variant"
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-xl bg-surface-container overflow-hidden shrink-0">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant font-label-sm">
                              No Img
                            </div>
                          )}
                        </div>
                        <span className="font-medium text-primary line-clamp-1">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-on-surface-variant font-mono text-xs">
                      <div>{product.category}</div>
                      <ProductMetadata product={product} />
                    </td>
                    <td className="p-4 font-mono font-medium">
                      {formatNaira(product.price)}
                    </td>
                    <td className="p-4 font-mono text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs ${product.inventory < 10 ? "bg-error/10 text-error font-bold" : "bg-surface-container-high text-on-surface-variant"}`}
                      >
                        {product.inventory} in stock
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${product.is_active ? "bg-secondary-container text-on-secondary-container" : "bg-surface-variant text-on-surface-variant"}`}
                      >
                        {product.is_active ? "Active" : "Draft"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(product)}
                          aria-label={`Edit ${product.name}`}
                          className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container cursor-pointer"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product)}
                          aria-label={`Delete ${product.name}`}
                          className="p-2 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error/10 cursor-pointer"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface p-6 rounded-xl border border-outline-variant botanical-shadow max-w-md w-full animate-in fade-in zoom-in duration-200">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">
              Delete Product
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              Are you sure you want to delete{" "}
              <strong>{productToDelete.name}</strong>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setProductToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-label-sm text-label-sm text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg font-label-sm text-label-sm bg-error text-on-error hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormModalOpen && (
        <ProductFormModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          product={productToEdit}
          onSaved={fetchProducts}
          existingCategories={existingCategories}
        />
      )}
    </div>
  );
}

function ProductMetadata({ product }: { product: Product }) {
  return (
    <div className="mt-1 text-[11px] font-mono text-on-surface-variant">
      SKU: {product.sku || "—"}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
