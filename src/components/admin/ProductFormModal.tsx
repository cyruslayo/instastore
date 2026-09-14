"use client";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: any;
  onSaved: () => void;
  existingCategories?: string[];
}

export default function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSaved,
  existingCategories = [],
}: ProductFormModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    price: 0,
    inventory: 0,
    category: "Oils",
    image: "",
    is_active: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Base list of categories merged with any from active products, minus duplicates
  const categoryOptions = Array.from(
    new Set(
      ["Oils", ...existingCategories.filter(Boolean), formData.category].filter(
        Boolean,
      ),
    ),
  );

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        slug: product.slug || "",
        description: product.description || "",
        price: product.price || 0,
        inventory: product.inventory || 0,
        category: product.category || "Oils",
        image: product.image || "",
        is_active: product.is_active ?? true,
      });
      setIsAddingNewCategory(false);
      setNewCategoryName("");
    } else {
      setFormData({
        name: "",
        slug: "",
        description: "",
        price: 0,
        inventory: 0,
        category: "Oils",
        image: "",
        is_active: true,
      });
      setIsAddingNewCategory(false);
      setNewCategoryName("");
    }
  }, [product, isOpen]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name,
      slug:
        prev.slug === generateSlug(prev.name) || prev.slug === ""
          ? generateSlug(name)
          : prev.slug,
    }));
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "number"
          ? Number(value)
          : value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const save = async () => {
    setError(null);
    setIsSaving(true);

    try {
      if (!formData.name || !formData.slug) {
        throw new Error("Name and Slug are required.");
      }

      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        price: Number(formData.price),
        inventory: Number(formData.inventory),
        category: formData.category,
        image: formData.image,
        is_active: formData.is_active,
        featured: product?.featured ?? false,
        sku: product?.sku || null,
      };

      const { getSupabase } = await import("@/lib/supabase");
      const supabase = getSupabase();

      if (product?.id) {
        // Update
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", product.id);
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error saving product: ", err);
      setError(err.message || "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl border border-outline-variant botanical-shadow max-w-2xl w-full flex flex-col max-h-[92dvh] animate-in fade-in sm:zoom-in duration-200">
        <div className="flex justify-between items-center px-5 py-4 sm:p-6 border-b border-outline-variant shrink-0">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-bold block">
              Catalog Management
            </span>
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
              {product ? "Edit Product" : "Add New Product"}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="touch-target flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="px-5 py-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5"
        >
          {error && (
            <div className="p-3.5 bg-error/10 text-error rounded-xl text-xs sm:text-sm font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleNameChange}
                className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>


            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Slug (URL)
              </label>
              <input
                type="text"
                name="slug"
                required
                value={formData.slug}
                onChange={handleChange}
                className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                Changing a published slug can break existing links.
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Description
              </label>
              <textarea
                name="description"
                rows={8}
                value={formData.description}
                onChange={handleChange}
                className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
              />
              <p className="font-body-sm text-[11px] text-on-surface-variant">
                Use blank lines for paragraphs. Start bullet items with &quot;-
                &quot;.
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Price (₦)
              </label>
              <input
                type="number"
                name="price"
                step="0.01"
                min="0"
                required
                value={formData.price}
                onChange={handleChange}
                className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Inventory Count
              </label>
              <input
                type="number"
                name="inventory"
                min="0"
                required
                value={formData.inventory}
                onChange={handleChange}
                className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-label-md text-on-surface-variant">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewCategory(!isAddingNewCategory);
                    if (!isAddingNewCategory) {
                      setNewCategoryName("");
                    }
                  }}
                  className="font-label-sm text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                >
                  {isAddingNewCategory
                    ? "Choose from existing"
                    : "+ Add new category"}
                </button>
              </div>

              {isAddingNewCategory ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Topicals, Accessories, Teas"
                    value={newCategoryName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewCategoryName(val);
                      setFormData((prev) => ({
                        ...prev,
                        category: val.trim(),
                      }));
                    }}
                    className="w-full p-3 bg-surface border border-primary rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  />
                  <span className="font-body-sm text-[11px] text-on-surface-variant">
                    Type a new category name. It will be saved with this product
                    and become available across your store.
                  </span>
                </div>
              ) : (
                <select
                  name="category"
                  value={formData.category}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setIsAddingNewCategory(true);
                      setNewCategoryName("");
                    } else {
                      handleChange(e);
                    }
                  }}
                  className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="__new__">+ New Custom Category...</option>
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Image URL
              </label>
              <input
                type="url"
                name="image"
                value={formData.image}
                onChange={handleChange}
                placeholder="https://..."
                className="w-full p-3 bg-surface border border-outline rounded-lg text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-2 md:col-span-2 pt-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleCheckboxChange}
                  className="w-5 h-5 rounded border-outline text-primary focus:ring-primary"
                />
                <span className="font-body-md text-on-surface">
                  Product is Active (Visible on store)
                </span>
              </label>
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-lg font-label-lg text-label-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}
